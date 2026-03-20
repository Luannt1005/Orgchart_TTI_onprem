import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
    try {
        const { username, password, full_name } = await req.json();

        if (!username || !password || !full_name) {
            return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
        }

        if (!username.endsWith('@ttigroup.com.vn')) {
            return NextResponse.json({ success: false, error: "Email must end with @ttigroup.com.vn" }, { status: 400 });
        }

        const pool = await getDbConnection();

        // Check if user exists
        const check = await pool.query("SELECT username FROM users WHERE username = $1", [username]);

        if (check.rows.length > 0) {
            return NextResponse.json({ success: false, error: "Tên đăng nhập đã tồn tại" }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);

        await pool.query(
            "INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4)",
            [username, hashedPassword, full_name, 'user']
        );

        return NextResponse.json({ success: true, message: "User created" });

    } catch (error: any) {
        console.error("Signup API Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
