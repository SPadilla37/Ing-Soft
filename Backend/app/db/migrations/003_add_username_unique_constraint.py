"""
Migration: Add unique constraint on username column

This migration adds a unique index on the username column to ensure
username uniqueness at the database level.

Usage:
    python -m app.db.migrations.003_add_username_unique_constraint upgrade
    python -m app.db.migrations.003_add_username_unique_constraint downgrade
"""

import sys
from sqlalchemy import text

from app.db.database import engine, database_url


def is_sqlite():
    """Check if the database is SQLite"""
    return database_url.startswith("sqlite")


def upgrade():
    """Add unique index on username column"""
    print("Running migration: Add unique constraint on username column")
    
    with engine.begin() as conn:
        if is_sqlite():
            print("Detected SQLite database")
            
            result = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_usuarios_username_unique'"
            ))
            if result.fetchone():
                print("Unique index on username already exists, skipping migration")
                return
            
            result = conn.execute(text("PRAGMA table_info(usuarios)"))
            columns = [row[1] for row in result]
            
            if 'username' not in columns:
                print("username column doesn't exist, skipping migration")
                return
            
            conn.execute(text("CREATE UNIQUE INDEX idx_usuarios_username_unique ON usuarios(username)"))
            print("✓ Unique index on username added successfully (SQLite)")
            
        else:
            print("Detected PostgreSQL database")
            
            result = conn.execute(text("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'usuarios' AND indexname = 'idx_usuarios_username_unique'
            """))
            
            if result.fetchone():
                print("Unique index on username already exists, skipping migration")
                return
            
            conn.execute(text("CREATE UNIQUE INDEX idx_usuarios_username_unique ON usuarios(username)"))
            print("✓ Unique index on username added successfully (PostgreSQL)")
    
    print("Migration completed successfully!")


def downgrade():
    """Remove unique index on username column"""
    print("Running rollback: Remove unique index on username column")
    
    with engine.begin() as conn:
        if is_sqlite():
            print("Detected SQLite database")
            
            result = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_usuarios_username_unique'"
            ))
            if not result.fetchone():
                print("Unique index on username doesn't exist, nothing to rollback")
                return
            
            conn.execute(text("DROP INDEX IF EXISTS idx_usuarios_username_unique"))
            print("✓ Unique index on username removed successfully (SQLite)")
            
        else:
            print("Detected PostgreSQL database")
            
            result = conn.execute(text("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'usuarios' AND indexname = 'idx_usuarios_username_unique'
            """))
            
            if not result.fetchone():
                print("Unique index on username doesn't exist, nothing to rollback")
                return
            
            conn.execute(text("DROP INDEX IF EXISTS idx_usuarios_username_unique"))
            print("✓ Unique index on username removed successfully (PostgreSQL)")
    
    print("Rollback completed successfully!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.db.migrations.003_add_username_unique_constraint [upgrade|downgrade]")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "upgrade":
        upgrade()
    elif command == "downgrade":
        downgrade()
    else:
        print(f"Unknown command: {command}")
        print("Usage: python -m app.db.migrations.003_add_username_unique_constraint [upgrade|downgrade]")
        sys.exit(1)