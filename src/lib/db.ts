
import { Pool } from 'pg';

const dbServer = process.env.DB_SERVER || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'Orgchart_TTI_Mil';

console.log(`[DB Config] Server: ${dbServer}, Port: ${dbPort}, User: ${dbUser ? '***' : 'missing'}, DB: ${dbName}`);

const pool = new Pool({
    user: dbUser,
    password: dbPassword,
    host: dbServer,
    port: dbPort,
    database: dbName,
    ssl: false, // Disabled for local on-prem
    max: 20, // max number of connection can be open to database
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

export async function getDbConnection() {
    try {
        // Test connection
        const client = await pool.connect();
        client.release();
        return pool;
    } catch (err: any) {
        console.error('Database connection failed:', err.message);
        console.error('Connection config:', {
            host: dbServer,
            port: dbPort,
            database: dbName,
            user: dbUser ? '***' : 'missing',
        });
        throw err;
    }
}

// Export a generic query object for compatibility if needed, but typically we return the pool
export { pool as sql };
