#!/bin/bash
set -e

# Automatically create test database alongside the primary database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE portfolio_test_db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'portfolio_test_db')\gexec
EOSQL
