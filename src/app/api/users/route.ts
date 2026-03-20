import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth-server";

/**
 * GET /api/users
 * Fetch all users ordered by full_name
 */
export async function GET() {
    if (!await isAuthenticated()) {
        return unauthorizedResponse();
    }
    try {
        const pool = await getDbConnection();
        const result = await pool.query("SELECT id, username, full_name, role, created_at FROM users ORDER BY full_name ASC");

        return NextResponse.json({
            success: true,
            data: result.rows
        });
    } catch (error: any) {
        console.error("API Fetch Users Error:", error);
        return NextResponse.json({
            success: false,
            message: error.message || "Failed to fetch users"
        }, { status: 500 });
    }
}
