#!/usr/bin/env python3
"""
Database Migration Runner

This script runs database migrations for the SkillSwap application.

Usage:
    python migrate.py upgrade    # Apply all pending migrations
    python migrate.py downgrade  # Rollback the last migration

Available migrations:
    001_add_role_to_usuarios - Adds role column to usuarios table
    002_add_is_suspended_to_usuarios - Adds is_suspended column to usuarios table
    003_add_username_unique_constraint - Adds unique constraint on username
    004_add_reportes_table - Creates reportes table for user reports system
"""

import sys
import os
import importlib

# Add the Backend directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import migrations dynamically
migration_001 = importlib.import_module('app.db.migrations.001_add_role_to_usuarios')
migration_002 = importlib.import_module('app.db.migrations.002_add_is_suspended_to_usuarios')
migration_003 = importlib.import_module('app.db.migrations.003_add_username_unique_constraint')
migration_004 = importlib.import_module('app.db.migrations.004_add_reportes_table')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command not in ["upgrade", "downgrade"]:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)
    
    print("=" * 60)
    print("SkillSwap Database Migration Runner")
    print("=" * 60)
    print()
    
    # Run migrations in order
    migrations = [
        ("001_add_role_to_usuarios", migration_001),
        ("002_add_is_suspended_to_usuarios", migration_002),
        ("003_add_username_unique_constraint", migration_003),
        ("004_add_reportes_table", migration_004),
    ]
    
    if command == "upgrade":
        print("Running migrations...")
        for name, module in migrations:
            print(f"\n[{name}]")
            try:
                module.upgrade()
            except Exception as e:
                print(f"✗ Migration failed: {e}")
                sys.exit(1)
    
    elif command == "downgrade":
        print("Rolling back migrations...")
        # Rollback in reverse order
        for name, module in reversed(migrations):
            print(f"\n[{name}]")
            try:
                module.downgrade()
            except Exception as e:
                print(f"✗ Rollback failed: {e}")
                sys.exit(1)
    
    print()
    print("=" * 60)
    print("All operations completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()