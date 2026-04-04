import os
import importlib
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.habilidades import router as habilidades_router
from app.api.routes.matches import router as matches_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.requests import router as requests_router
from app.api.routes.users import router as users_router
from app.api.routes.websocket import router as websocket_router
from app.core.skills_seed import seed_default_habilidades
from app.core.security import hash_password
from app.db.database import Base, engine
from app.db.database import SessionLocal
from app.db.models.entities import Usuario


app = FastAPI(title="Skill Exchange Messaging API", version="1.0.0")

allowed_origins = [
    "https://spadilla37.github.io",
    "http://localhost:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def run_startup_migrations() -> None:
    """Run idempotent DB migrations required by runtime code."""
    migration_modules = [
        "app.db.migrations.001_add_role_to_usuarios",
        "app.db.migrations.002_add_is_suspended_to_usuarios",
    ]

    for module_name in migration_modules:
        try:
            module = importlib.import_module(module_name)
            module.upgrade()
        except Exception as exc:
            # Keep startup alive, but print enough context for Render logs.
            print(f"[startup-migration] Failed: {module_name} -> {exc}")


def ensure_bootstrap_superadmin(session) -> None:
    """Create or update a superadmin account from environment variables."""
    enabled = os.getenv("BOOTSTRAP_SUPERADMIN_ENABLED", "true").lower() == "true"
    if not enabled:
        return

    email = os.getenv("BOOTSTRAP_SUPERADMIN_EMAIL", "superadmin@ingsoft.app").strip().lower()
    username = os.getenv("BOOTSTRAP_SUPERADMIN_USERNAME", "superadmin").strip()
    password = os.getenv("BOOTSTRAP_SUPERADMIN_PASSWORD", "SuperAdmin123!")

    if not email or not username or not password:
        print("[startup-superadmin] Skipped: missing email/username/password")
        return

    username = username[:25]
    now = datetime.now(timezone.utc)

    existing = session.execute(select(Usuario).where(Usuario.email == email)).scalars().first()
    if not existing:
        existing = Usuario(
            username=username,
            email=email,
            password_hash=hash_password(password),
            clerk_id="bootstrap-superadmin",
            nombre="Super",
            apellido="Admin",
            fecha_registro=now,
            ultimo_login=now,
            role="superadmin",
            is_suspended=False,
        )
        session.add(existing)
    else:
        existing.username = username
        existing.password_hash = hash_password(password)
        existing.role = "superadmin"
        existing.is_suspended = False
        if not existing.clerk_id:
            existing.clerk_id = "bootstrap-superadmin"
        if not existing.nombre:
            existing.nombre = "Super"
        if not existing.apellido:
            existing.apellido = "Admin"
        if not existing.fecha_registro:
            existing.fecha_registro = now


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    run_startup_migrations()
    with SessionLocal() as session:
        ensure_bootstrap_superadmin(session)
        seed_default_habilidades(session)
        session.commit()


app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(habilidades_router)
app.include_router(matches_router)
app.include_router(requests_router)
app.include_router(users_router)
app.include_router(websocket_router)
app.include_router(conversations_router)
app.include_router(notifications_router)
