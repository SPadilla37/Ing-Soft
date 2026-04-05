"""
Migration: Remove 'advertencia' option from reportes accion_tomada

This migration updates the CHECK constraint on the accion_tomada column
to remove the 'advertencia' option, leaving only: 'ninguna', 'suspension', 'eliminacion'

Usage:
    python -m app.db.migrations.006_remove_advertencia_from_reportes upgrade
    python -m app.db.migrations.006_remove_advertencia_from_reportes downgrade
"""

import sys
from sqlalchemy import text

from app.db.database import engine, database_url


def is_sqlite():
    """Check if the database is SQLite"""
    return database_url.startswith("sqlite")


def upgrade():
    """Update CHECK constraint to remove 'advertencia' option"""
    print("Running migration: Remove 'advertencia' from reportes accion_tomada")
    
    with engine.begin() as conn:
        if is_sqlite():
            print("Detected SQLite database")
            print("Note: SQLite doesn't support ALTER TABLE to modify constraints.")
            print("The constraint will be enforced at the application level via Pydantic schemas.")
            print("Existing 'advertencia' values in the database will remain but cannot be created via API.")
            
        else:
            print("Detected PostgreSQL database")
            
            # Drop the old constraint
            conn.execute(text("""
                ALTER TABLE reportes 
                DROP CONSTRAINT IF EXISTS reportes_accion_check
            """))
            print("✓ Old constraint dropped")
            
            # Add the new constraint without 'advertencia'
            conn.execute(text("""
                ALTER TABLE reportes 
                ADD CONSTRAINT reportes_accion_check 
                CHECK (accion_tomada IS NULL OR accion_tomada IN ('ninguna', 'suspension', 'eliminacion'))
            """))
            print("✓ New constraint added (without 'advertencia')")
    
    print("Migration completed successfully!")


def downgrade():
    """Restore CHECK constraint with 'advertencia' option"""
    print("Running rollback: Restore 'advertencia' to reportes accion_tomada")
    
    with engine.begin() as conn:
        if is_sqlite():
            print("Detected SQLite database")
            print("Note: SQLite doesn't support ALTER TABLE to modify constraints.")
            print("No rollback needed for SQLite.")
            
        else:
            print("Detected PostgreSQL database")
            
            # Drop the current constraint
            conn.execute(text("""
                ALTER TABLE reportes 
                DROP CONSTRAINT IF EXISTS reportes_accion_check
            """))
            print("✓ Current constraint dropped")
            
            # Restore the old constraint with 'advertencia'
            conn.execute(text("""
                ALTER TABLE reportes 
                ADD CONSTRAINT reportes_accion_check 
                CHECK (accion_tomada IS NULL OR accion_tomada IN ('ninguna', 'advertencia', 'suspension', 'eliminacion'))
            """))
            print("✓ Old constraint restored (with 'advertencia')")
    
    print("Rollback completed successfully!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.db.migrations.006_remove_advertencia_from_reportes [upgrade|downgrade]")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "upgrade":
        upgrade()
    elif command == "downgrade":
        downgrade()
    else:
        print(f"Unknown command: {command}")
        print("Usage: python -m app.db.migrations.006_remove_advertencia_from_reportes [upgrade|downgrade]")
        sys.exit(1)
