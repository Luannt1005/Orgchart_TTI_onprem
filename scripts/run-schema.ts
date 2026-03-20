import { getDbConnection } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runSchema() {
    console.log('Connecting to database...');
    let pool;
    try {
        pool = await getDbConnection();
        const sqlPath = path.join(process.cwd(), 'scripts', 'create_tables_pg.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
        console.log('Running schema creation script...');
        await pool.query(sqlContent);
        console.log('✅ Successfully created all tables in PostgreSQL.');
    } catch (err: any) {
        fs.writeFileSync('error-log.json', JSON.stringify({ message: err.message, stack: err.stack, details: err }, null, 2));
    } finally {
        if (pool) {
            try { await pool.end(); } catch (e) { }
        }
        process.exit();
    }
}
runSchema();
