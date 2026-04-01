"""
Migration: Add is_suspended field to usuarios table

This migration adds an is_suspended column to the usuarios table with:
- Boolean field to track suspension status
- Default value of False (not suspended)
- Index for performance on login queries

Usage:
    python -m app.db.migrations.002_add_is_suspended_to_usuarios upgrade
    python -m app.db.migrations.002_add_is_suspended_to_usuarios downgrade
"""

import sys
from sqlalchemy import text, Boolean

from app.db.database import engine, database_url


def is_sqlite():
    """Check if the database is SQLite"""
    return database_url.startswith("sqlite")


def upgrade():
    """Add is_suspended column to usuarios table"""
    print("Running migration: Add is_suspended column to usuarios table")
    
    with engine.begin() as conn:
        if is_sqlite():
            print("Detected SQLite database - using table recreation strategy")
            
            result = conn.execute(text("PRAGMA table_info(usuarios)"))
            columns = [row[1] for row in result]
            
            if 'is_suspended' in columns:
                print("is_suspended column already exists, skipping migration")
                return
            
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
                    is_suspended BOOLEAN NOT NULL DEFAULT 0
                )
            """))
            
            conn.execute(text("""
                INSERT INTO usuarios_new 
                (id, username, email, password_hash, clerk_id, nombre, apellido, 
                 foto_url, biografia, ultimo_login, fecha_registro, role, is_suspended)
                SELECT id, username, email, password_hash, clerk_id, nombre, apellido,
                       foto_url, biografia, ultimo_login, fecha_registro, role, 0
                FROM usuarios
            """))
            
            conn.execute(text("DROP TABLE usuarios"))
            conn.execute(text("ALTER TABLE usuarios_new RENAME TO usuarios"))
            conn.execute(text("CREATE INDEX idx_usuarios_is_suspended ON usuarios(is_suspended)"))
            
            print("✓ is_suspended column added successfully (SQLite)")
            
        else:
            print("Detected PostgreSQL database")
            
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'usuarios' AND column_name = 'is_suspended'
            """))
            
            if result.fetchone():
                print("is_suspended column already exists, skipping migration")
                return
            
            conn.execute(text("""
                ALTER TABLE usuarios 
                ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT false
            """))
            
            conn.execute(text("CREATE INDEX idx_usuarios_is_suspended ON usuarios(is_suspended)"))
            
            print("✓ is_suspended column added successfully (PostgreSQL)")
    
    print("Migration completed successfully!")


def downgrade():
    """Remove is_suspended column from usuarios table"""
    print("Running rollback: Remove is_suspended column from usuarios table")
    
    with engine.begin() as conn:
        if is_sqlite():
            print("Detected SQLite database - using table recreation strategy")
            
            result = conn.execute(text("PRAGMA table_info(usuarios)"))
            columns = [row[1] for row in result]
            
            if 'is_suspended' not in columns:
                print("is_suspended column doesn't exist, nothing to rollback")
                return
            
            conn.execute(text("DROP INDEX IF EXISTS idx_usuarios_is_suspended"))
            
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
                    role VARCHAR(10) NOT NULL DEFAULT 'user'
                )
            """))
            
            conn.execute(text("""
                INSERT INTO usuarios_new 
                (id, username, email, password_hash, clerk_id, nombre, apellido,
                 foto_url, biografia, ultimo_login, fecha_registro, role)
                SELECT id, username, email, password_hash, clerk_id, nombre, apellido,
                       foto_url, biografia, ultimo_login, fecha_registro, role
                FROM usuarios
            """))
            
            conn.execute(text("DROP TABLE usuarios"))
            conn.execute(text("ALTER TABLE usuarios_new RENAME TO usuarios"))
            
            print("✓ is_suspended column removed successfully (SQLite)")
            
        else:
            print("Detected PostgreSQL database")
            
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'usuarios' AND column_name = 'is_suspended'
            """))
            
            if not result.fetchone():
                print("is_suspended column doesn't exist, nothing to rollback")
                return
            
            conn.execute(text("DROP INDEX IF EXISTS idx_usuarios_is_suspended"))
            conn.execute(text("ALTER TABLE usuarios DROP COLUMN is_suspended"))
            
            print("✓ is_suspended column removed successfully (PostgreSQL)")
    
    print("Rollback completed successfully!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.db.migrations.002_add_is_suspended_to_usuarios [upgrade|downgrade]")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "upgrade":
        upgrade()
    elif command == "downgrade":
        downgrade()
    else:
        print(f"Unknown command: {command}")
        print("Usage: python -m app.db.migrations.002_add_is_suspended_to_usuarios [upgrade|downgrade]")
        sys.exit(1)
