import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

/**
 * POST /api/add-Department
 * Add a new department node to orgchart
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.pid) {
      console.warn("Missing required fields in add-Department:", {
        name: !!body.name,
        pid: !!body.pid,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name and pid are required",
        },
        { status: 400 }
      );
    }

    console.log("Adding department to Azure SQL:", {
      name: body.name,
      pid: body.pid,
    });

    // Create department object
    const departmentId = body.id || `dept:${body.name}:${body.pid}`;
    const departmentData = {
      id: departmentId,
      pid: body.pid,
      stpid: null,
      name: body.name,
      title: "Department",
      image: null,
      tags: JSON.stringify(["group"]),
      orig_pid: body.pid,
      dept: body.name,
      bu: null,
      type: "group",
      location: null,
      description: body.description || `Department under manager ${body.pid}`,
      joining_date: null
    };

    const pool = await getDbConnection();

    // Check if exists
    const check = await pool.query("SELECT id FROM orgchart_nodes WHERE id = $1", [departmentId]);

    if (check.rows.length > 0) {
      // Update
      await pool.query(`
                UPDATE orgchart_nodes 
                SET pid = $2, name = $3, description = $4, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [departmentData.id, departmentData.pid, departmentData.name, departmentData.description]);
    } else {
      // Insert
      await pool.query(`
                INSERT INTO orgchart_nodes (id, pid, stpid, name, title, tags, orig_pid, dept, type, description)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
        departmentData.id, departmentData.pid, departmentData.stpid, departmentData.name,
        departmentData.title, departmentData.tags, departmentData.orig_pid, departmentData.dept,
        departmentData.type, departmentData.description
      ]);
    }

    console.log("Department added successfully:", departmentId);

    return NextResponse.json(
      {
        success: true,
        data: departmentData,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to add department";
    console.error("POST /api/add-Department failed:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
