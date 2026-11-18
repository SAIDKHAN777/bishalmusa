-- =============================================================================
-- Least-Privilege PostgreSQL Role Separation Strategy
-- 1. portfolio_migrator: Used for CI/CD, migration deploy, and schema changes (DDL)
-- 2. portfolio_app: Used exclusively by the runtime application (DML only, NO DDL)
-- =============================================================================

-- Step 1: Create Migration Role (Admin/DDL privileges)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'portfolio_migrator') THEN
    CREATE ROLE portfolio_migrator WITH LOGIN PASSWORD 'change_this_migrator_password_in_prod';
  END IF;
END $$;

-- Grant database ownership / schema privileges to migrator
GRANT ALL PRIVILEGES ON DATABASE portfolio_backend_db TO portfolio_migrator;
GRANT ALL ON SCHEMA public TO portfolio_migrator;

-- Step 2: Create Runtime Application Role (Least-Privilege DML Only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'portfolio_app') THEN
    CREATE ROLE portfolio_app WITH LOGIN PASSWORD 'change_this_app_password_in_prod';
  END IF;
END $$;

-- Step 3: Grant Connection & Schema Usage
GRANT CONNECT ON DATABASE portfolio_backend_db TO portfolio_app;
GRANT USAGE ON SCHEMA public TO portfolio_app;

-- Step 4: Grant Data Manipulation Privileges (SELECT, INSERT, UPDATE, DELETE)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portfolio_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO portfolio_app;

-- Step 5: Configure Default Privileges for future tables created by migrations
ALTER DEFAULT PRIVILEGES FOR ROLE portfolio_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portfolio_app;

ALTER DEFAULT PRIVILEGES FOR ROLE portfolio_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO portfolio_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portfolio_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO portfolio_app;

-- Step 6: Explicitly REVOKE Schema Modification (DDL) Rights from Runtime User
REVOKE CREATE ON SCHEMA public FROM portfolio_app;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM portfolio_app;
