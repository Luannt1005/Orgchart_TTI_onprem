import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

/**
 * GET /api/orgcharts
 * Fetch custom orgcharts for a specific user
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ orgcharts: [] });
  }

  try {
    const pool = await getDbConnection();
    const result = await pool.query(
      "SELECT id, username, orgchart_name, description, org_data, is_public FROM custom_orgcharts WHERE username = $1 OR is_public = true",
      [username]
    );

    const orgcharts = (result.rows || []).map(doc => ({
      orgchart_id: doc.id,
      orgchart_name: doc.orgchart_name,
      describe: doc.description,
      org_data: JSON.parse(doc.org_data || '{"data": []}'), // Parse JSON
      is_public: doc.is_public || false,
      username: doc.username,
    }));

    return NextResponse.json({ orgcharts });
  } catch (err) {
    console.error("GET orgcharts error:", err);
    return NextResponse.json(
      { orgcharts: [], error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgcharts
 * Create a new custom orgchart
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { username, orgchart_name, describe, org_data, is_public } = data;

    if (!username || !orgchart_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();
    const result = await pool.query(`
            INSERT INTO custom_orgcharts (username, orgchart_name, description, org_data, is_public)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [
      username, orgchart_name, describe || "", JSON.stringify(org_data || { data: [] }), is_public ? true : false
    ]);

    const newOrgchartId = result.rows[0].id;

    return NextResponse.json({
      success: true,
      orgchart_id: newOrgchartId,
      message: "Orgchart created successfully"
    });
  } catch (err) {
    console.error("Error creating orgchart:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
