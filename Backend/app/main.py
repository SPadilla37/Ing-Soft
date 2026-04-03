import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router, get_current_user
from app.api.routes.conversations import router as conversations_router
from app.api.routes.habilidades import router as habilidades_router
from app.api.routes.matches import router as matches_router
from app.api.routes.requests import router as requests_router
from app.api.routes.users import router as users_router
from app.api.routes.websocket import router as websocket_router
from app.core.skills_seed import seed_default_habilidades
from app.db.database import Base, engine, SessionLocal

app = FastAPI(title="Skill Exchange Messaging API", version="1.0.0")

# Configuración de CORS más robusta para desarrollo local
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Si la variable de entorno es *, permitimos todo
allowed_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "")
if allowed_origins_env == "*" or not allowed_origins:
    allowed_origins = ["*"]

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
    with SessionLocal() as session:
        seed_default_habilidades(session)

@app.get("/")
def read_root():
    return {"message": "Skill Exchange API is running"}

# Include routers - auth_router sin auth dependency
app.include_router(auth_router)
app.include_router(habilidades_router)
app.include_router(matches_router, dependencies=[Depends(get_current_user)])
app.include_router(requests_router, dependencies=[Depends(get_current_user)])
app.include_router(users_router, dependencies=[Depends(get_current_user)])
app.include_router(websocket_router)
app.include_router(conversations_router, dependencies=[Depends(get_current_user)])
