import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getCachedData } from "@/lib/cache";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth-server";

// Cache TTL: 15 minutes for orgchart data
const ORGCHART_CACHE_TTL = 15 * 60 * 1000;
const IMAGE_BASE_URL = "/uploads/";

interface Employee {
  id: string;
  emp_id: string;
  full_name: string | null;
  job_title: string | null;
  dept: string | null;
  bu: string | null;
  bu_org_3: string | null;
  dl_idl_staff: string | null;
  location: string | null;
  employee_type: string | null;
  is_direct: string | null;
  line_manager: string | null;
  joining_date: string | null;
  last_working_day: string | null;
  [key: string]: any;
}

// --- Helper Functions ---

// Trim leading zeros from ID
const trimLeadingZeros = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = String(value).replace(/^0+/, '') || '0';
  return trimmed === '0' ? null : trimmed;
};

// Format date to DD/MM/YYYY
const formatDate = (value: any): string => {
  if (!value) return "";
  try {
    // Handle Excel serial number
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
      const excelSerial = Number(value);
      if (excelSerial > 0) {
        const date = new Date((excelSerial - 1) * 86400000 + new Date(1900, 0, 1).getTime());
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
    // Handle ISO string
    if (typeof value === 'string' && value.includes('T')) {
      const date = new Date(value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    // Handle DD/MM/YYYY format
    if (typeof value === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      return value;
    }
    return String(value);
  } catch (e) {
    return String(value);
  }
};

// Check if employee is in probation period (60 days)
const isProbationPeriod = (joiningDateStr: string): boolean => {
  if (!joiningDateStr) return false;
  try {
    const [day, month, year] = joiningDateStr.split('/').map(Number);
    const joiningDate = new Date(year, month - 1, day);
    const now = new Date();
    const diffTime = now.getTime() - joiningDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= 60 && diffDays >= 0;
  } catch (e) {
    return false;
  }
};

/**
 * GET /api/orgchart
 * Fetch employees directly and transform to orgchart nodes on-the-fly.
 */
export async function GET(req: Request) {
  if (!await isAuthenticated()) {
    return unauthorizedResponse();
  }
  try {
    const { searchParams } = new URL(req.url);
    const dept = searchParams.get("dept");

    // Build cache key based on department filter
    const cacheKey = dept && dept !== "all" ? `orgchart_direct_dept_${dept}` : 'orgchart_direct_all';

    const data = await getCachedData(
      cacheKey,
      async () => {
        console.log(`📡 [Cache MISS] Fetching employees from Azure SQL (dept: ${dept || 'all'})...`);

        const pool = await getDbConnection();
        const queryValues: any[] = [];
        let queryStr = "SELECT * FROM employees WHERE emp_id IS NOT NULL AND emp_id <> ''";

        if (dept && dept !== "all") {
          queryStr += " AND dept = $1";
          queryValues.push(dept);
        }

        const result = await pool.query(queryStr, queryValues);
        const employees = result.rows;

        if (!employees || employees.length === 0) {
          return [];
        }

        // 2. Transform to Orgchart Nodes
        const output: any[] = [];
        const deptMap = new Map();

        // 1.5 Create ID Set for lookup
        const empIds = new Set(employees.map((e: Employee) => trimLeadingZeros(e.emp_id) || ""));

        employees.forEach((emp: Employee) => {
          const rawId = String(emp.emp_id || "").trim();
          if (!rawId) return;

          const empId = trimLeadingZeros(rawId) || rawId;

          // Get manager ID
          const managerRaw = emp.line_manager;
          let managerPart = managerRaw ? String(managerRaw).split(":")[0].trim() : null;

          let isIndirectManager = false;
          let managerId: string | null = null;
          let deptManagerId: string | null = null;

          if (managerPart) {
            // Logic for indirect managers
            if (emp.is_direct && String(emp.is_direct).toUpperCase() === 'NO') {
              isIndirectManager = true;
              managerId = trimLeadingZeros(managerPart);
              deptManagerId = "i-" + managerId;
            } else {
              managerId = trimLeadingZeros(managerPart);
              deptManagerId = managerId;
            }
          }

          const currentDept = emp.dept || "";
          // Create a unique key for the department node based on dept name + manager
          const deptKey = `dept:${currentDept}:${deptManagerId}`;

          // Store department info to create department nodes later
          deptMap.set(deptKey, { dept: currentDept, managerId, isIndirectManager });

          const joiningDate = formatDate(emp.joining_date) || "";
          const tags = ["emp"];
          let imageUrl = `${IMAGE_BASE_URL}${empId}.webp`;

          // Handle Headcount Open
          if (emp.employee_type === 'hc_open') {
            tags.push("headcount_open");
            imageUrl = "/headcount_open.png"; // Assuming local asset
          }

          if (joiningDate && isProbationPeriod(joiningDate)) {
            tags.push("Emp_probation");
          }

          // Check if manager exists in current dataset
          const isManagerPresent = managerId && empIds.has(managerId);

          // If manager is missing (filtered out or not in DB), attach to Department Group
          const effectivePid = isManagerPresent ? managerId : null;

          // Create Employee Node
          output.push({
            id: empId,
            pid: effectivePid,
            stpid: deptKey,
            name: emp.full_name || "",
            title: emp.job_title || "",
            image: imageUrl,
            tags: JSON.stringify(tags),
            orig_pid: managerId,
            dept: currentDept || null,
            bu: emp.bu || null,
            type: emp.dl_idl_staff || null,
            location: emp.location || null,
            description: emp.employee_type || "",
            joining_date: joiningDate
          });
        });

        // 3. Add Department Nodes
        deptMap.forEach((v, deptKey) => {
          const deptTags = v.isIndirectManager ? ["indirect_group"] : ["group"];

          // Check if manager is present in the dataset
          const isManagerPresent = v.managerId && empIds.has(v.managerId);
          // If manager is missing, this Group Node becomes a Root
          const effectivePid = isManagerPresent ? v.managerId : null;

          output.push({
            id: deptKey,
            pid: effectivePid,
            stpid: null,
            name: v.dept || "",
            title: "Department",
            image: null,
            tags: JSON.stringify(deptTags),
            orig_pid: v.managerId,
            dept: v.dept || "",
            bu: null,
            type: "group",
            location: null,
            description: `Dept under manager ${v.managerId}`,
            joining_date: null
          });
        });

        console.log(`✅ Transformed ${employees.length} employees into ${output.length} nodes`);
        return output;
      },
      ORGCHART_CACHE_TTL
    );

    const response = NextResponse.json(
      {
        data,
        success: true,
        timestamp: new Date().toISOString(),
        cached: true
      },
      { status: 200 }
    );

    // Cache headers
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );

    return response;
  } catch (err: any) {
    console.error("Error loading orgchart:", err);
    return NextResponse.json(
      {
        data: [],
        success: false,
        error: err.message || "Failed to load data",
      },
      { status: 500 }
    );
  }
}
