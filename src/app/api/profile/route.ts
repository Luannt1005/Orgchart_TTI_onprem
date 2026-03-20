import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get("auth")?.value;
        if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

        const payload = await decrypt(session);
        if (!payload || !payload.user) return NextResponse.json({ success: false, message: "Invalid session" }, { status: 401 });

        const userId = payload.user.id;
        const pool = await getDbConnection();

        const result = await pool.query("SELECT id, username, full_name, role FROM users WHERE id = $1", [userId]);

        if (result.rows.length === 0) throw new Error("User not found");

        return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
        console.error("Profile GET Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get("auth")?.value;
        if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

        const payload = await decrypt(session);
        if (!payload || !payload.user) return NextResponse.json({ success: false, message: "Invalid session" }, { status: 401 });

        const userId = payload.user.id;
        const body = await req.json();

        // Updates allowed fields
        // Note: employee_id and title were in Supabase query but NOT in scripts/migrate-to-azure.ts table definition for 'users'
        // If they need to be updated, the schema must support them.
        // Based on migrate-to-azure.ts: users(id, username, password, full_name, role, created_at, updated_at)
        // So I will only update full_name for now.

        const pool = await getDbConnection();
        await pool.query(
            "UPDATE users SET full_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [body.full_name, userId]
        );

        return NextResponse.json({ success: true, data: { full_name: body.full_name } });
    } catch (error: any) {
        console.error("Profile PUT Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
