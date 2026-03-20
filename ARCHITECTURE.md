# System Architecture

## Overview
This document outlines the current system architecture for the OrgChart application. The system has migrated from a cloud-based infrastructure (Azure SQL & Supabase) to a fully **on-premises / local** setup using **PostgreSQL** for data management and the **Local File System** for image storage.

## Architecture Diagram

```mermaid
graph TD
    User(("👤 User / Admin")) -->|HTTP/HTTPS| UI[Next.js Client (React)]
    
    subgraph "Next.js Application (Port 3000)"
        UI --> MW[Edge Middleware / Auth]
        MW --> API[API Routes (/api/*)]
        
        subgraph "Internal Services"
            AuthService["🔐 Auth Service (JWT)"]
            CacheService["⚡ Memory Cache"]
            Transformer["⚙️ Data Transformer"]
        end
        
        subgraph "Local Storage"
            FS[("📁 public/uploads<br/>(Local Images)")]
        end
    end

    API --> AuthService
    API --> CacheService
    API --> Transformer
    
    subgraph "Data Tier"
        PostgresDB[("🛢️ PostgreSQL Database<br/>(Local On-Premises)")]
    end

    API -->|pg client| PostgresDB
    API -->|fs.write| FS
    UI -.->|Static Fetch| FS
    
    PostgresDB -.->|Auth Data| AuthService
```

## System Connectivity & Services

The following table maps the various components, services, and protocols used across the application.

| Application / Component | Service Type | Protocol | Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Next.js Web App** | Web Server | HTTP / HTTPS | 3000 | Main application logic and UI shell |
| **PostgreSQL** | Database | TCP/IP | 5432 | Primary data storage (employees, users, configs) |
| **File System** | Local Storage | File IO (fs) | N/A | Storage for profile images in `public/uploads` |
| **JWT Service** | Authentication | JSON Web Token | Stateless | Session management via HttpOnly cookies |
| **Memory Cache** | Key-Value Store | In-process Map | N/A | 15-minute TTL cache for API responses |

## Key Components

### 1. Client (Next.js Frontend)
- **Framework**: Next.js 15+ (App Router).
- **Communication**: Communicates with Backend via standard HTTP/Fetch calls using the **SWR** library for data synchronization.
- **Port**: Typically runs on **Port 3000** during development.

### 2. API Layer (Next.js Server)
- **API Routes**: Handle application logic (`/api/orgchart`, `/api/sheet`, etc.).
- **Authentication**: Custom JWT-based security. Tokens are stored in secure, HttpOnly cookies.
- **Data Access**: Uses the `pg` (node-postgres) driver to connect to the local database.

### 3. Backend Services (Local Infrastructure)
- **PostgreSQL Database**:
  - **Host**: `localhost` (default)
  - **Port**: `5432`
  - **Scope**: Manages all relational data including employee profiles and user credentials.
- **Local Storage**:
  - **Path**: `src/public/uploads`
  - **Scope**: Serves employee avatars and chart assets directly through Next.js static file serving.

## Data Flow Summary

| Feature | Protocol | Destination |
| :--- | :--- | :--- |
| **Data Fetching** | REST / JSON | `/api/*` |
| **Database Query** | SQL (Postgres) | `localhost:5432` |
| **Image Upload** | Multipart/FormData | `fs.writeFile` |
| **Authentication** | JWT / Cookies | Header/Cookie based |

## Authentication Flow
1. **Login**: POST credentials to `/api/login`.
2. **Verification**: Backend checks password hash against PostgreSQL `users` table.
3. **Session**: On success, a JWT is signed and issued as an HttpOnly `auth` cookie.
4. **Validation**: API routes use `isAuthenticated()` helper to verify the JWT on every request.

---
**Version**: 2.0 (On-Premises Architecture)  
**Updated**: 2026-02-25
