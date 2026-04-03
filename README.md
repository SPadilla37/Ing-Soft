# SkillSwap - Intercambio de Habilidades (Clerk Auth)

Plataforma full-stack para intercambio de habilidades con chat WebSocket.

## Stack
**Backend:** FastAPI + SQLAlchemy + SQLite/Postgres + Clerk Auth
**Frontend:** React 18 + Vite + Clerk Auth + Tailwind CSS
**Deploy:** Render

## Autenticación
**Migrado a Clerk** (no más JWT/password local):
- Frontend: `<ClerkProvider>`, `<SignInButton>`, `<UserButton>`
- Backend: `clerk-sdk` verify token, auto-user create from Clerk ID

**Keys (.env):**

#### Frontend (`/Frontend/.env`)
```text
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YmV0dGVyLWFudC03MS5jbGVyay5hY2NvdW50cy5kZXYk
VITE_API_BASE=http://127.0.0.1:8000
```

#### .env (afuera de las carpetas)
```text
CLERK_PUBLISHABLE_KEY=pk_test_YmV0dGVyLWFudC03MS5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_2e0B0xCZX1c2O5CzYRHfjBeBSjVHh1xyaoK3Wi5QXu
CLERK_FRONTEND_URL=https://better-ant-71.clerk.accounts.dev
CLERK_INSTANCE=better-ant-71
```

- `Backend/app/db/models/`: modelos SQLAlchemy por dominio.
- `Backend/app/schemas/`: validaciones Pydantic (payloads y contratos).
- `Backend/app/services/`: logica reusable (websocket, matching, reputacion).
- `Backend/app/api/routes/`: endpoints separados por routers de API.
- `Backend/requirements.txt`: dependencias Python.
- `Backend/render.yaml`: configuracion para Render.
- `Frontend/index.html`: cliente web estatico.

## Backend local

1. Ir a `Backend/`
2. Crear entorno virtual (opcional)
3. Instalar dependencias:

```bash
pip install -r requirements.txt
```

4. Ejecutar servidor:

```bash
uvicorn app.main:app --reload
```

5. Abrir docs en:

```text
http://127.0.0.1:8000/docs
```

## Endpoints principales

- `POST /auth/register`
- `POST /auth/login`
- `GET /usuarios/{user_id}`
- `PUT /usuarios/{user_id}/profile`
- `POST /message-requests`
- `GET /conversations/{user_id}`
- `GET /conversaciones`
- `POST /conversaciones`
- `POST /conversations/{conversation_id}/messages`
- `POST /mensajes`
- `WS /ws/{conversation_id}/{user_id}`

## Deploy

### Render (Backend)

- Usa `Backend/render.yaml` o crea el servicio manualmente.
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Variable opcional para CORS:

- `CORS_ALLOW_ORIGINS=https://TU-USUARIO.github.io`

Si quieres permitir varios origenes:

- `CORS_ALLOW_ORIGINS=https://a.github.io,https://b.github.io`

### GitHub Pages (Frontend)

- Publica `Frontend/index.html` en tu Pages.
- En la pantalla de prueba, coloca la URL publica de Render en el campo "URL Backend".

## Nota importante

Actualmente el almacenamiento por defecto usa SQLite local (`skillswap.db`).
Para produccion, el siguiente paso recomendado es conectar PostgreSQL (Render Postgres).
