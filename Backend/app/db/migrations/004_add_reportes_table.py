"""
Migration: Add reportes table for user reports system

This migration creates the reportes table with all necessary fields, constraints,
and indexes to support the user reports system. The table tracks reports of
inappropriate user behavior with full audit trail.

Usage:
    python -m app.db.migrations.004_add_reportes_table upgrade
    python -m app.db.migrations.004_add_reportes_table downgrade
"""

import sys
from sqlalchemy import text

from app.db.database import engine, database_url


def is_sqlite():
    """Check if the database is SQLite"""
    return database_url.startswith("sqlite")


def upgrade():
    """Create reportes table with constraints and indexes"""
    print("Running migration: Add reportes table")
    
    with engine.begin() as conn:
        if is_sqlite():
            print("Detected SQLite database")
            
            # Check if table already exists
            result = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='reportes'"
            ))
            if result.fetchone():
                print("reportes table already exists, skipping migration")
                return
            
            # Create reportes table
            conn.execute(text("""
                CREATE TABLE reportes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reportante_id INTEGER,
                    reportado_id INTEGER,
                    reportado_username_snapshot TEXT NOT NULL,
                    motivo TEXT NOT NULL,
                    descripcion TEXT,
                    estado TEXT NOT NULL DEFAULT 'pendiente',
                    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    fecha_resolucion TIMESTAMP,
                    resuelto_por INTEGER,
                    accion_tomada TEXT,
                    notas_admin TEXT,
                    FOREIGN KEY (reportante_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                    FOREIGN KEY (reportado_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                    FOREIGN KEY (resuelto_por) REFERENCES usuarios(id) ON DELETE SET NULL,
                    CHECK (estado IN ('pendiente', 'en_revision', 'resuelto', 'descartado')),
                    CHECK (accion_tomada IS NULL OR accion_tomada IN ('ninguna', 'advertencia', 'suspension', 'eliminacion'))
                )
            """))
            print("✓ reportes table created (SQLite)")
            
            # Create indexes
            conn.execute(text("CREATE INDEX idx_reportes_reportado_id ON reportes(reportado_id)"))
            print("✓ Index on reportado_id created")
            
            conn.execute(text("CREATE INDEX idx_reportes_estado ON reportes(estado)"))
            print("✓ Index on estado created")
            
            conn.execute(text("CREATE INDEX idx_reportes_fecha_creacion ON reportes(fecha_creacion)"))
            print("✓ Index on fecha_creacion created")
            
            # Partial unique index for active reports (SQLite doesn't support partial indexes directly,
            # so we create a regular unique index on the combination)
            conn.execute(text("""
                CREATE UNIQUE INDEX idx_active_reports 
                ON reportes(reportante_id, reportado_id, estado)
                WHERE estado IN ('pendiente', 'en_revision')
            """))
            print("✓ Partial unique index on active reports created")
            
        else:
            print("Detected PostgreSQL database")
            
            # Check if table already exists
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'reportes'
                )
            """))
            if result.scalar():
                print("reportes table already exists, skipping migration")
                return
            
            # Create reportes table
            conn.execute(text("""
                CREATE TABLE reportes (
                    id SERIAL PRIMARY KEY,
                    reportante_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                    reportado_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                    reportado_username_snapshot VARCHAR(25) NOT NULL,
                    motivo VARCHAR(100) NOT NULL,
                    descripcion TEXT,
                    estado VARCHAR(15) NOT NULL DEFAULT 'pendiente',
                    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    fecha_resolucion TIMESTAMP,
                    resuelto_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                    accion_tomada VARCHAR(15),
                    notas_admin TEXT,
                    CONSTRAINT reportes_estado_check CHECK (estado IN ('pendiente', 'en_revision', 'resuelto', 'descartado')),
                    CONSTRAINT reportes_accion_check CHECK (accion_tomada IS NULL OR accion_tomada IN ('ninguna', 'advertencia', 'suspension', 'eliminacion'))
                )
            """))
            print("✓ reportes table created (PostgreSQL)")
            
            # Create indexes
            conn.execute(text("CREATE INDEX idx_reportes_reportado_id ON reportes(reportado_id)"))
            print("✓ Index on reportado_id created")
            
            conn.execute(text("CREATE INDEX idx_reportes_estado ON reportes(estado)"))
            print("✓ Index on estado created")
            
            conn.execute(text("CREATE INDEX idx_reportes_fecha_creacion ON reportes(fecha_creacion)"))
            print("✓ Index on fecha_creacion created")
            
            # Partial unique index for active reports
            conn.execute(text("""
                CREATE UNIQUE INDEX idx_active_reports 
                ON reportes(reportante_id, reportado_id, estado)
                WHERE estado IN ('pendiente', 'en_revision')
            """))
            print("✓ Partial unique index on active reports created")
    
    print("Migration completed successfully!")


def downgrade():
    """Drop reportes table and all related indexes"""
    print("Running rollback: Drop reportes table")
    
    with engine.begin() as conn:
        if is_sqlite():
            print("Detected SQLite database")
            
            # Check if table exists
            result = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='reportes'"
            ))
            if not result.fetchone():
                print("reportes table doesn't exist, nothing to rollback")
                return
            
            # Drop indexes first
            conn.execute(text("DROP INDEX IF EXISTS idx_reportes_reportado_id"))
            conn.execute(text("DROP INDEX IF EXISTS idx_reportes_estado"))
            conn.execute(text("DROP INDEX IF EXISTS idx_reportes_fecha_creacion"))
            conn.execute(text("DROP INDEX IF EXISTS idx_active_reports"))
            print("✓ Indexes dropped")
            
            # Drop table
            conn.execute(text("DROP TABLE IF EXISTS reportes"))
            print("✓ reportes table dropped (SQLite)")
            
        else:
            print("Detected PostgreSQL database")
            
            # Check if table exists
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'reportes'
                )
            """))
            if not result.scalar():
                print("reportes table doesn't exist, nothing to rollback")
                return
            
            # Drop indexes first
            conn.execute(text("DROP INDEX IF EXISTS idx_reportes_reportado_id"))
            conn.execute(text("DROP INDEX IF EXISTS idx_reportes_estado"))
            conn.execute(text("DROP INDEX IF EXISTS idx_reportes_fecha_creacion"))
            conn.execute(text("DROP INDEX IF EXISTS idx_active_reports"))
            print("✓ Indexes dropped")
            
            # Drop table
            conn.execute(text("DROP TABLE IF EXISTS reportes"))
            print("✓ reportes table dropped (PostgreSQL)")
    
    print("Rollback completed successfully!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.db.migrations.004_add_reportes_table [upgrade|downgrade]")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "upgrade":
        upgrade()
    elif command == "downgrade":
        downgrade()
    else:
        print(f"Unknown command: {command}")
        print("Usage: python -m app.db.migrations.004_add_reportes_table [upgrade|downgrade]")
        sys.exit(1)
