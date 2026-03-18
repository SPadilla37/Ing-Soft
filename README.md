# Proyecto_Software-I
Plataforma de Intercambio de habilidades

## Sistema de mensajeria (solicitud -> aceptacion/rechazo -> chat)

Se implemento un backend en Python con FastAPI y WebSocket para el flujo de intercambio de habilidades:

- Un usuario envia una solicitud de chat con las habilidades a intercambiar.
- El receptor puede aceptar o rechazar.
- Si acepta, se crea una conversacion.
- Solo los participantes de una conversacion aceptada pueden conectarse al WebSocket y chatear.

## Estructura

- `Backend/app/main.py`: punto de entrada FastAPI y orquestacion.
- `Backend/app/core/security.py`: utilidades de autenticacion (hash de password).
- `Backend/app/db/database.py`: configuracion de engine/sesion SQLAlchemy.
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
