import { NextResponse } from "next/server";
import { isAuthenticated, unauthorizedResponse, getCurrentUser } from "@/lib/auth-server";
import { promises as fs } from "fs";
import * as path from "path";

export async function POST(req: Request) {
    if (!await isAuthenticated()) {
        return unauthorizedResponse();
    }
    const currentUser = await getCurrentUser();
    console.log(`🔐 POST /api/upload-image accessed by: ${currentUser}`);

    try {
        const formData = await req.formData();
        const file = formData.get("file") as Blob | null;
        const filename = formData.get("filename") as string | null;

        if (!file || !filename) {
            return NextResponse.json(
                { success: false, error: "File and filename are required" },
                { status: 400 }
            );
        }

        // Convert Blob to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Ensure the directory exists
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        try {
            await fs.access(uploadDir);
        } catch {
            await fs.mkdir(uploadDir, { recursive: true });
        }

        // Save file locally to public/uploads
        const filePath = path.join(uploadDir, `${filename}.webp`);
        await fs.writeFile(filePath, buffer);

        // Calculate public URL
        const publicUrl = `/uploads/${filename}.webp`;

        return NextResponse.json({
            success: true,
            message: "Image uploaded successfully",
            url: publicUrl,
            path: publicUrl
        });

    } catch (error: any) {
        console.error("Upload handler error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Unknown server error" },
            { status: 500 }
        );
    }
}
