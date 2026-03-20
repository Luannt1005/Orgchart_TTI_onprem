import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 });
        }

        const pool = await getDbConnection();

        // Find user
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: "Sai tài khoản hoặc mật khẩu" }, { status: 401 });
        }

        const user = result.rows[0];

        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return NextResponse.json({ success: false, error: "Sai tài khoản hoặc mật khẩu" }, { status: 401 });
        }

        const userInfo = {
            id: user.id,
            username: user.username,
            full_name: user.full_name || user.username,
            role: user.role || "user"
        };

        // Create Session
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        const session = await encrypt({ user: userInfo, expires });

        const cookieStore = await cookies();
        cookieStore.set("auth", session, {
            expires,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax",
        });

        return NextResponse.json({
            success: true,
            user: userInfo
        });

    } catch (error: any) {
        console.error("Login API Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
