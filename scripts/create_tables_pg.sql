-- Run this script in your local PostgreSQL Database (`Orgchart_TTI_Mil`) to create the necessary tables.

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emp_id VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(200),
    job_title VARCHAR(200),
    dept VARCHAR(200),
    bu VARCHAR(100),
    dl_idl_staff VARCHAR(50),
    location VARCHAR(200),
    employee_type VARCHAR(100),
    line_manager VARCHAR(200),
    joining_date VARCHAR(50),
    raw_data TEXT,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employees_emp_id ON employees(emp_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(dept);

CREATE TABLE IF NOT EXISTS orgchart_nodes (
    id VARCHAR(200) PRIMARY KEY,
    pid VARCHAR(200),
    stpid VARCHAR(200),
    name VARCHAR(300),
    title VARCHAR(200),
    image TEXT,
    tags TEXT,
    orig_pid VARCHAR(200),
    dept VARCHAR(200),
    bu VARCHAR(100),
    type VARCHAR(50),
    location VARCHAR(200),
    description TEXT,
    joining_date VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orgchart_nodes_pid ON orgchart_nodes(pid);

CREATE TABLE IF NOT EXISTS custom_orgcharts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    orgchart_name VARCHAR(200) NOT NULL,
    description TEXT,
    org_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_custom_orgcharts_username ON custom_orgcharts(username);
