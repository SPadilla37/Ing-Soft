"""
Migration: Consolidate superadmin role into admin

This migration:
- Updates all users with 'superadmin' role to 'admin'
- Updates CHECK constraint to only allow 'user' and 'admin'
- Removes 'superadmin' from valid roles

Usage:
    python -m app.db.migrations.005_consolidate_superadmin_to_admin upgrade
    python -m app.db.migrations.005_consolidate_superadmin_to_admin downgrade
"""

import sys
from sqlalchemy import text

from app.db.database import engine, database_url


def is_sqlite():
    """Check if the database is SQLite"""
    return database_url.startswith("sqlite")


def upgrade():
    """Consolidate superadmin role into admin"""
    print("Running migration: Consolidate superadmin to admin")
    
    with engine.begin() as conn:
        # Step 1: Update all superadmin users to admin
        print("Updating all superadmin users to admin role...")
        result = conn.execute(text("""
            UPDATE usuarios 
            SET role = 'admin' 
            WHERE role = 'superadmin'
        """))
        print(f"Updated {result.rowcount} users from superadmin to admin")
        
        if is_sqlite():
            print("Detected SQLite database - recreating table with new constraint")
            
            # SQLite requires table recreation for constraint changes
            conn.execute(text("""
                CREATE TABLE usuarios_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(25) NOT NULL,
                    email VARCHAR(50) NOT NULL,
                    password_hash VARCHAR(100) NOT NULL,
                    clerk_id VARCHAR(35) NOT NULL,
                    nombre VARCHAR(35) NOT NULL,
                    apellido VARCHAR(35) NOT NULL,
                    foto_url VARCHAR(50),
                    biografia TEXT,
                    ultimo_login TIMESTAMP,
                    fecha_registro TIMESTAMP,
                    role VARCHAR(10) NOT NULL DEFAULT 'user',
                    is_suspended BOOLEAN NOT NULL DEFAULT 0,
                    CHECK (role IN ('user', 'admin')),
                    UNIQUE(username)
                )
            """))
            
            # Copy data from old table
            conn.execute(text("""
                INSERT INTO usuarios_new 
                SELECT id, username, email, password_hash, clerk_id, nombre, apellido,
                       foto_url, biografia, ultimo_login, fecha_registro, role, is_suspended
                FROM usuarios
            """))
            
            # Drop old table and rename new one
            conn.execute(text("DROP TABLE usuarios"))
            conn.execute(text("ALTER TABLE usuarios_new RENAME TO usuarios"))
            
            # Recreate indexes
            conn.execute(text("CREATE INDEX idx_usuarios_role ON usuarios(role)"))
            conn.execute(text("CREATE INDEX idx_usuarios_is_suspended ON usuarios(is_suspended)"))
            
        else:
            # PostgreSQL/MySQL can alter constraints directly
            print("Updating CHECK constraint for PostgreSQL/MySQL...")
            
            # Drop old constraint
            conn.execute(text("""
                ALTER TABLE usuarios 
                DROP CONSTRAINT IF EXISTS usuarios_role_check
            """))
            
            # Add new constraint
            conn.execute(text("""
                ALTER TABLE usuarios 
                ADD CONSTRAINT usuarios_role_check 
                CHECK (role IN ('user', 'admin'))
            """))
        
        print("Migration completed successfully")


def downgrade():
    """Revert consolidation - restore superadmin role capability"""
    print("Running downgrade: Restore superadmin role")
    
    with engine.begin() as conn:
        if is_sqlite():
            print("Detected SQLite database - recreating table with old constraint")
            
            conn.execute(text("""
                CREATE TABLE usuarios_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(25) NOT NULL,
                    email VARCHAR(50) NOT NULL,
                    password_hash VARCHAR(100) NOT NULL,
                    clerk_id VARCHAR(35) NOT NULL,
                    nombre VARCHAR(35) NOT NULL,
                    apellido VARCHAR(35) NOT NULL,
                    foto_url VARCHAR(50),
                    biografia TEXT,
                    ultimo_login TIMESTAMP,
                    fecha_registro TIMESTAMP,
                    role VARCHAR(10) NOT NULL DEFAULT 'user',
                    is_suspended BOOLEAN NOT NULL DEFAULT 0,
                    CHECK (role IN ('user', 'admin', 'superadmin')),
                    UNIQUE(username)
                )
            """))
            
            conn.execute(text("""
                INSERT INTO usuarios_new 
                SELECT id, username, email, password_hash, clerk_id, nombre, apellido,
                       foto_url, biografia, ultimo_login, fecha_registro, role, is_suspended
                FROM usuarios
            """))
            
            conn.execute(text("DROP TABLE usuarios"))
            conn.execute(text("ALTER TABLE usuarios_new RENAME TO usuarios"))
            
            # Recreate indexes
            conn.execute(text("CREATE INDEX idx_usuarios_role ON usuarios(role)"))
            conn.execute(text("CREATE INDEX idx_usuarios_is_suspended ON usuarios(is_suspended)"))
            
        else:
            # PostgreSQL/MySQL
            conn.execute(text("""
                ALTER TABLE usuarios 
                DROP CONSTRAINT IF EXISTS usuarios_role_check
            """))
            
            conn.execute(text("""
                ALTER TABLE usuarios 
                ADD CONSTRAINT usuarios_role_check 
                CHECK (role IN ('user', 'admin', 'superadmin'))
            """))
        
        print("Downgrade completed successfully")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.db.migrations.005_consolidate_superadmin_to_admin [upgrade|downgrade]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "upgrade":
        upgrade()
    elif command == "downgrade":
        downgrade()
    else:
        print(f"Unknown command: {command}")
        print("Usage: python -m app.db.migrations.005_consolidate_superadmin_to_admin [upgrade|downgrade]")
        sys.exit(1)
