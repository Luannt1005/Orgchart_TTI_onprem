import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

/**
 * GET /api/orgcharts/[id]
 * Fetch a single custom orgchart by ID
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Validate ID
        if (!id || typeof id !== 'string') {
            return NextResponse.json(
                { error: "Invalid orgchart ID" },
                { status: 400 }
            );
        }

        const pool = await getDbConnection();
        const result = await pool.query("SELECT * FROM custom_orgcharts WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            return NextResponse.json({
                error: "Orgchart not found",
                orgchart_id: id,
                org_data: { data: [] }
            }, { status: 404 });
        }

        const data = result.rows[0];

        return NextResponse.json({
            orgchart_id: data.id,
            orgchart_name: data.orgchart_name,
            describe: data.description,
            org_data: JSON.parse(data.org_data || '{"data": []}'),
            is_public: data.is_public || false,
            username: data.username,
            created_at: data.created_at,
            updated_at: data.updated_at
        });
    } catch (err) {
        const error = err as Error;
        console.error("GET Orgchart Error:", error.message, error.stack);
        return NextResponse.json({
            error: error.message || "Unknown error occurred",
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

/**
 * PUT /api/orgcharts/[id]
 * Update an existing custom orgchart
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const data = await request.json();
        const { org_data, orgchart_name, describe, is_public } = data;

        const pool = await getDbConnection();

        let setClauses = ["updated_at = CURRENT_TIMESTAMP"];
        let queryValues: any[] = [id];
        let vIndex = 2;

        if (org_data !== undefined) {
            queryValues.push(JSON.stringify(org_data));
            setClauses.push(`org_data = $${vIndex++}`);
        }
        if (orgchart_name) {
            queryValues.push(orgchart_name);
            setClauses.push(`orgchart_name = $${vIndex++}`);
        }
        if (describe !== undefined) {
            queryValues.push(describe);
            setClauses.push(`description = $${vIndex++}`);
        }
        if (is_public !== undefined) {
            queryValues.push(is_public ? true : false);
            setClauses.push(`is_public = $${vIndex++}`);
        }

        await pool.query(`UPDATE custom_orgcharts SET ${setClauses.join(', ')} WHERE id = $1`, queryValues);

        return NextResponse.json({
            success: true,
            message: "Updated successfully"
        });
    } catch (err) {
        console.error("PUT Orgchart Error:", err);
        return NextResponse.json(
            { error: (err as Error).message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/orgcharts/[id]
 * Delete a custom orgchart
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const pool = await getDbConnection();

        await pool.query("DELETE FROM custom_orgcharts WHERE id = $1", [id]);

        return NextResponse.json({
            success: true,
            message: "Deleted successfully"
        });
    } catch (err) {
        console.error("DELETE Orgchart Error:", err);
        return NextResponse.json(
            { error: (err as Error).message },
            { status: 500 }
        );
    }
}
