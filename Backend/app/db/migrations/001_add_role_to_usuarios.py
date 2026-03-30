"""
Migration: Add role column to usuarios table

This migration adds a role column to the usuarios table with:
- CHECK constraint for values: 'user', 'admin', 'superadmin'
- Default value of 'user'
- Index on the role column
- Updates existing NULL roles to 'user'

Usage:
    python -m app.db.migrations.001_add_role_to_usuarios upgrade
    python -m app.db.migrations.001_add_role_to_usuarios downgrade
"""

import sys
from sqlalchemy import text

from app.db.database import engine, database_url


def is_sqlite():
    """Check if the database is SQLite"""
    return database_url.startswith("sqlite")


def upgrade():
    """Add role column to usuarios table"""
    print("Running migration: Add role column to usuarios table")
    
    with engine.begin() as conn:
        if is_sqlite():
            # SQLite doesn't support ALTER TABLE ADD COLUMN with CHECK constraints
            # We need to recreate the table
            print("Detected SQLite database - using table recreation strategy")
            
            # Check if role column already exists
            result = conn.execute(text("PRAGMA table_info(usuarios)"))
            columns = [row[1] for row in result]
            
            if 'role' in columns:
                print("Role column already exists, skipping migration")
                return
            
            # Create new table with role column
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
                    CHECK (role IN ('user', 'admin', 'superadmin'))
                )
            """))
            
            # Copy data from old table
            conn.execute(text("""
                INSERT INTO usuarios_new 
                (id, username, email, password_hash, clerk_id, nombre, apellido, 
                 foto_url, biografia, ultimo_login, fecha_registro, role)
                SELECT id, username, email, password_hash, clerk_id, nombre, apellido,
                       foto_url, biografia, ultimo_login, fecha_registro, 'user'
                FROM usuarios
            """))
            
            # Drop old table
            conn.execute(text("DROP TABLE usuarios"))
            
            # Rename new table
            conn.execute(text("ALTER TABLE usuarios_new RENAME TO usuarios"))
            
            # Create index
            conn.execute(text("CREATE INDEX idx_usuarios_role ON usuarios(role)"))
            
            print("✓ Role column added successfully (SQLite)")
            
        else:
            # PostgreSQL supports ALTER TABLE with constraints
            print("Detected PostgreSQL database")
            
            # Check if role column already exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'usuarios' AND column_name = 'role'
            """))
            
            if result.fetchone():
                print("Role column already exists, skipping migration")
                return
            
            # Add role column with default value
            conn.execute(text("""
                ALTER TABLE usuarios 
                ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'user'
            """))
            
            # Add CHECK constraint
            conn.execute(text("""
                ALTER TABLE usuarios 
                ADD CONSTRAINT usuarios_role_check 
                CHECK (role IN ('user', 'admin', 'superadmin'))
            """))
            
            # Update existing NULL values (if any)
            conn.execute(text("""
                UPDATE usuarios 
                SET role = 'user' 
                WHERE role IS NULL
            """))
            
            # Create index
            conn.execute(text("CREATE INDEX idx_usuarios_role ON usuarios(role)"))
            
            print("✓ Role column added successfully (PostgreSQL)")
    
    print("Migration completed successfully!")


def downgrade():
    """Remove role column from usuarios table"""
    print("Running rollback: Remove role column from usuarios table")
    
    with engine.begin() as conn:
        if is_sqlite():
            # SQLite doesn't support DROP COLUMN, need to recreate table
            print("Detected SQLite database - using table recreation strategy")
            
            # Check if role column exists
            result = conn.execute(text("PRAGMA table_info(usuarios)"))
            columns = [row[1] for row in result]
            
            if 'role' not in columns:
                print("Role column doesn't exist, nothing to rollback")
                return
            
            # Drop index first
            conn.execute(text("DROP INDEX IF EXISTS idx_usuarios_role"))
            
            # Create table without role column
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
                    fecha_registro TIMESTAMP
                )
            """))
            
            # Copy data (excluding role column)
            conn.execute(text("""
                INSERT INTO usuarios_new 
                (id, username, email, password_hash, clerk_id, nombre, apellido,
                 foto_url, biografia, ultimo_login, fecha_registro)
                SELECT id, username, email, password_hash, clerk_id, nombre, apellido,
                       foto_url, biografia, ultimo_login, fecha_registro
                FROM usuarios
            """))
            
            # Drop old table
            conn.execute(text("DROP TABLE usuarios"))
            
            # Rename new table
            conn.execute(text("ALTER TABLE usuarios_new RENAME TO usuarios"))
            
            print("✓ Role column removed successfully (SQLite)")
            
        else:
            # PostgreSQL
            print("Detected PostgreSQL database")
            
            # Check if role column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'usuarios' AND column_name = 'role'
            """))
            
            if not result.fetchone():
                print("Role column doesn't exist, nothing to rollback")
                return
            
            # Drop index
            conn.execute(text("DROP INDEX IF EXISTS idx_usuarios_role"))
            
            # Drop constraint
            conn.execute(text("""
                ALTER TABLE usuarios 
                DROP CONSTRAINT IF EXISTS usuarios_role_check
            """))
            
            # Drop column
            conn.execute(text("ALTER TABLE usuarios DROP COLUMN role"))
            
            print("✓ Role column removed successfully (PostgreSQL)")
    
    print("Rollback completed successfully!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.db.migrations.001_add_role_to_usuarios [upgrade|downgrade]")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "upgrade":
        upgrade()
    elif command == "downgrade":
        downgrade()
    else:
        print(f"Unknown command: {command}")
        print("Usage: python -m app.db.migrations.001_add_role_to_usuarios [upgrade|downgrade]")
        sys.exit(1)
