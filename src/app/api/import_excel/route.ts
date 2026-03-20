import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDbConnection } from "@/lib/db";
import { invalidateCachePrefix } from "@/lib/cache";
import { isAuthenticated, unauthorizedResponse, getCurrentUser } from "@/lib/auth-server";

/**
 * Get existing Emp IDs from database
 */
async function getExistingEmpIds(client: any): Promise<Map<string, string>> {
  const result = await client.query("SELECT id, emp_id FROM employees");

  const empIds = new Map<string, string>();
  result.rows.forEach((row: any) => {
    if (row.emp_id) {
      empIds.set(row.emp_id, row.id);
    }
  });

  return empIds;
}

/**
 * POST /api/import_excel
 * Import employees from Excel file to Azure SQL
 */
export async function POST(req: Request) {
  if (!await isAuthenticated()) {
    return unauthorizedResponse();
  }
  const currentUser = await getCurrentUser();
  console.log(`🔐 POST /api/import_excel accessed by: ${currentUser}`);

  let client: any = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { error: "Invalid Excel file" },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: true
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Excel file is empty" },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();
    client = await pool.connect();
    await client.query('BEGIN');

    // Get existing Emp IDs
    const existingEmpIds = await getExistingEmpIds(client);

    // Get Emp IDs from import file for "Full Sync" check
    const newEmpIds = new Set(
      rows
        .map((row: any) => row["Emp ID"])
        .filter((id: any) => id !== null && id !== undefined && String(id).trim() !== '')
        .map((id: any) => String(id).trim())
    );

    // Find Emp IDs to delete (in database but not in new file)
    const dbIdsToDelete: string[] = [];
    existingEmpIds.forEach((dbId, empId) => {
      if (!newEmpIds.has(empId)) {
        dbIdsToDelete.push(dbId);
      }
    });

    let savedCount = 0;
    let deletedCount = 0;

    // 1. Process Insert/Update
    for (const row of rows as any[]) {
      const rawId = row["Emp ID"];
      if (rawId === null || rawId === undefined || String(rawId).trim() === '') continue;

      const empId = String(rawId).trim();
      const dbId = existingEmpIds.get(empId);

      const safeString = (val: any) => (val === null || val === undefined) ? null : String(val);

      const full_name = safeString(row["FullName "] || row["FullName"] || row["Full Name"]);
      const job_title = safeString(row["Job Title"]);
      const dept = safeString(row["Dept"]);
      const bu = safeString(row["BU"]);
      const bu_org_3 = safeString(row["BU Org 3"] || row["BU Org 3 "]);
      const dl_idl_staff = safeString(row["DL/IDL/Staff"]);
      const location = safeString(row["Location"]);
      const employee_type = safeString(row["Employee Type"]);
      const line_manager = safeString(row["Line Manager"]);
      const is_direct = safeString(row["Is Direct"] || "YES");
      const joining_date = safeString(row["Joining\r\n Date"] || row["Joining Date"]);

      const last_working_day = safeString(
        row["Last Working\r\nDay"] ||
        row["Last Working Day"] ||
        row["Last Working\r\n Day"] ||
        row["last_working_day"] ||
        row["Resignation Date"] ||
        row["LWD"]
      );

      if (dbId) {
        // UPDATE
        await client.query(`
          UPDATE employees SET
            full_name = $1,
            job_title = $2,
            dept = $3,
            bu = $4,
            bu_org_3 = $5,
            dl_idl_staff = $6,
            location = $7,
            employee_type = $8,
            line_manager = $9,
            is_direct = $10,
            joining_date = $11,
            last_working_day = $12,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $13
        `, [
          full_name, job_title, dept, bu, bu_org_3, dl_idl_staff, location, employee_type, line_manager, is_direct, joining_date, last_working_day, dbId
        ]);
      } else {
        // INSERT
        await client.query(`
          INSERT INTO employees (
            emp_id, full_name, job_title, dept, bu, bu_org_3, dl_idl_staff, 
            location, employee_type, line_manager, is_direct, joining_date, last_working_day
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          )
        `, [
          empId, full_name, job_title, dept, bu, bu_org_3, dl_idl_staff, location, employee_type, line_manager, is_direct, joining_date, last_working_day
        ]);
      }
      savedCount++;
    }

    // 2. Delete removed employees
    if (dbIdsToDelete.length > 0) {
      // Chunk deletions to avoid parameter limits (2100 params max)
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < dbIdsToDelete.length; i += CHUNK_SIZE) {
        const chunk = dbIdsToDelete.slice(i, i + CHUNK_SIZE);
        const listStr = chunk.map(id => `'${id}'`).join(',');
        await client.query(`DELETE FROM employees WHERE id IN (${listStr})`);
        deletedCount += chunk.length;
      }
    }

    await client.query('COMMIT');
    client.release();

    // Invalidate cache
    invalidateCachePrefix('employees');

    return NextResponse.json({
      success: true,
      total: rows.length,
      saved: savedCount,
      deleted: deletedCount
    });

  } catch (err: any) {
    console.error("Import error:", err);
    if (client) {
      try { await client.query('ROLLBACK'); client.release(); } catch (e) { console.error("Rollback failed:", e); }
    }
    return NextResponse.json(
      { error: err.message || "Failed to import file" },
      { status: 500 }
    );
  }
}