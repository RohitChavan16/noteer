#!/bin/sh
set -e

# Create log directory with proper permissions
mkdir -p /var/log/supervisor
chown -R root:root /var/log/supervisor
chmod 755 /var/log/supervisor

# Create Noteer data directory for JWT secret and uploads
mkdir -p /var/lib/noteer
chmod 755 /var/lib/noteer

# Initialize PostgreSQL if not already done
if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
    echo "📦 Initializing PostgreSQL database..."
    
    # Ensure proper ownership
    chown -R postgres:postgres /var/lib/postgresql
    chmod 700 /var/lib/postgresql/data
    
    # Initialize the database cluster
    su postgres -c "initdb -D /var/lib/postgresql/data"
    
    # Update pg_hba.conf for local connections
    echo "local all all trust" > /var/lib/postgresql/data/pg_hba.conf
    echo "host all all 127.0.0.1/32 trust" >> /var/lib/postgresql/data/pg_hba.conf
    echo "host all all ::1/128 trust" >> /var/lib/postgresql/data/pg_hba.conf
    
    # Start PostgreSQL temporarily
    su postgres -c "pg_ctl -D /var/lib/postgresql/data -l /tmp/pg_init.log start"
    
    # Wait for PostgreSQL to start
    sleep 5
    
    # Create database and user
    su postgres -c "psql -c \"CREATE USER noteer WITH PASSWORD 'noteer';\""
    su postgres -c "psql -c \"CREATE DATABASE noteer OWNER noteer;\""
    su postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE noteer TO noteer;\""
    
    # Stop PostgreSQL (supervisord will start it)
    su postgres -c "pg_ctl -D /var/lib/postgresql/data stop"
    
    echo "✅ PostgreSQL initialized"
fi

# Set proper permissions
chown -R postgres:postgres /var/lib/postgresql
chown -R postgres:postgres /run/postgresql

echo "🚀 Starting Noteer..."
exec "$@"
