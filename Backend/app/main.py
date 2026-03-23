import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.api.routes.auth import router as auth_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.habilidades import router as habilidades_router
from app.api.routes.matches import router as matches_router
from app.api.routes.requests import router as requests_router
from app.api.routes.users import router as users_router
from app.api.routes.websocket import router as websocket_router
from app.db.database import Base, engine, SessionLocal
from app.db.models.entities import Habilidad


app = FastAPI(title="Skill Exchange Messaging API", version="1.0.0", docs_url="/docs", redoc_url="/redoc")

allowed_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)

    # Seed de habilidades para que el onboarding funcione aunque la BD esté vacía.
    # Se ejecuta solo si la tabla `habilidades` no tiene registros.
    seed_enabled = os.getenv("SEED_HABILIDADES", "true").lower() not in {"0", "false", "no"}
    if seed_enabled:
        with SessionLocal() as session:
            count = session.execute(select(func.count(Habilidad.id))).scalar_one()
            if count == 0:
                defaults: list[tuple[str, str]] = [
                    ("Python", "Programación"),
                    ("JavaScript", "Programación"),
                    ("React", "Programación"),
                    ("Inglés conversacional", "Idiomas"),
                    ("Diseño gráfico", "Diseño"),
                    ("Marketing digital", "Negocios"),
                    ("Excel avanzado", "Oficina"),
                    ("Fundamentos de IA", "Tecnología"),
                    ("Escritura y redacción", "Comunicación"),
                    ("Guitarra (básico)", "Arte"),
                    ("Fotografía", "Arte"),
                    ("Matemáticas", "Ciencias"),
                ]
                for nombre, categoria in defaults:
                    session.add(Habilidad(nombre=nombre, categoria=categoria))
                session.commit()


app.include_router(auth_router)
app.include_router(habilidades_router)
app.include_router(matches_router)
app.include_router(requests_router)
app.include_router(users_router)
app.include_router(websocket_router)
app.include_router(conversations_router)
