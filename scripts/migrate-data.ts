import * as mssql from 'mssql';
import { Pool } from 'pg';

const azureConfig = {
    user: 'app_user',
    password: 'StrongPassword!123',
    server: 'ttivn-management.database.windows.net',
    database: 'Orgchart_Mil_VN_database',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

const pgPool = new Pool({
    user: 'postgres',
    password: 'Luannt_1005',
    host: 'localhost',
    port: 5432,
    database: 'Orgchart_TTI_Mil',
    ssl: false
});

async function addMissingCols() {
    console.log('Adding missing columns to Postgres schema based on recent app discoverings...');
    await pgPool.query(`
        ALTER TABLE custom_orgcharts ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_direct VARCHAR(50);
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_working_day VARCHAR(50);
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS line_manager_status VARCHAR(50);
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS pending_line_manager VARCHAR(200);
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS requester VARCHAR(100);
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS bu_org_3 VARCHAR(100);
    `);
}

async function migrateData() {
    let mssqlPool;
    try {
        console.log('Connecting to Azure SQL...');
        mssqlPool = await mssql.connect(azureConfig);
        console.log('Connected to Azure SQL.');

        console.log('Connecting to Postgres...');
        await pgPool.query('SELECT 1');
        console.log('Connected to Postgres.');

        await addMissingCols();

        async function migrateTable(tableName: string) {
            console.log(`Reading ${tableName} from Azure...`);
            const result = await mssqlPool!.request().query(`SELECT * FROM ${tableName}`);
            const rows = result.recordset;
            if (rows.length === 0) {
                console.log(`ℹ️ No data in ${tableName}.`);
                return;
            }

            console.log(`Migrating ${rows.length} rows to ${tableName}...`);
            const cols = Object.keys(rows[0]);
            for (const row of rows) {
                const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
                const values = cols.map(c => row[c]);
                try {
                    await pgPool.query(`
                        INSERT INTO ${tableName} (${cols.join(', ')})
                        VALUES (${placeholders})
                        ON CONFLICT (id) DO NOTHING
                    `, values);
                } catch (e: any) {
                    console.error(`Failed to insert into ${tableName}:`, e.message);
                }
            }
            console.log(`✅ Finished ${tableName}.`);
        }

        await migrateTable('users');
        await migrateTable('custom_orgcharts');
        await migrateTable('orgchart_nodes');
        await migrateTable('employees');

        console.log('🎉 All data migrated successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (mssqlPool) await mssqlPool.close();
        await pgPool.end();
        process.exit(0);
    }
}

migrateData();
