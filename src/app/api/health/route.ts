import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

/**
 * Health check endpoint to keep Azure SQL connection alive
 */
export async function GET() {
    try {
        const pool = await getDbConnection();
        const result = await pool.query("SELECT 1 as status");

        if (result.rows[0].status !== 1) {
            throw new Error("Database query failed");
        }

        return NextResponse.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            connected: true
        });
    } catch (error) {
        console.error('Health check failed:', error);
        return NextResponse.json(
            {
                status: 'error',
                timestamp: new Date().toISOString(),
                connected: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 503 }
        );
    }
}
