from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import delete, select
from app.db.database import SessionLocal
from app.db.models.entities import Usuario, UsuarioHabilidad
from app.schemas.contracts import UserProfileUpdatePayload
from app.api.routes.auth import get_current_user
from app.services.core import serialize_user


router = APIRouter()


@router.get("/usuarios/{user_id}")
@router.get("/usuarios/me")
def get_user(user_id: int = None, current_user: dict = Depends(get_current_user)) -> dict:
    with SessionLocal() as session:
        if user_id is not None:
            # Caso: Ver perfil de otro usuario (Búsqueda por ID numérico interno)
            user = session.get(Usuario, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
        else:
            # Caso: /usuarios/me (Búsqueda por Clerk ID del usuario autenticado)
            clerk_id = current_user['sub']
            user = session.execute(
                select(Usuario).where(Usuario.clerk_id == clerk_id)
            ).scalars().first()

            if not user:
                # Auto-crear registro local si es el primer login en Clerk
                user = Usuario(
                    clerk_id=clerk_id,
                    email=current_user.get('email', ''),
                    username=current_user.get('username', 'user'),
                    password_hash="clerk_auth",
                    nombre=current_user.get('first_name', ''),
                    apellido=current_user.get('last_name', ''),
                    fecha_registro=datetime.now(timezone.utc),
                )
                session.add(user)
                session.commit()
                session.refresh(user)
            else:
                # Sincronización: Si el usuario ya existe, actualizamos sus datos básicos
                # con lo que viene de Clerk por si hubo cambios en su dashboard.
                changed = False
                if user.email != current_user.get('email'):
                    user.email = current_user.get('email')
                    changed = True
                if user.nombre != current_user.get('first_name') and current_user.get('first_name'):
                    user.nombre = current_user.get('first_name')
                    changed = True
                if user.apellido != current_user.get('last_name') and current_user.get('last_name'):
                    user.apellido = current_user.get('last_name')
                    changed = True
                
                if changed:
                    session.commit()
                    session.refresh(user)

        return {"user": serialize_user(user, session)}


@router.put("/usuarios/me/profile")
def update_user_profile(payload: UserProfileUpdatePayload, current_user: dict = Depends(get_current_user)) -> dict:
    clerk_id = current_user['sub']
    print(f"Updating profile for clerk_id: {clerk_id}")
    
    with SessionLocal() as session:
        user = session.execute(
            select(Usuario).where(Usuario.clerk_id == clerk_id)
        ).scalars().first()
        
        if not user:
            print(f"User not found in DB. Creating for clerk_id: {clerk_id}")
            # Auto-crear si es la primera vez que completa el perfil
            user = Usuario(
                clerk_id=clerk_id,
                email=current_user.get('email', ''),
                username=current_user.get('username', 'user'),
                password_hash="clerk_auth", # Valor dummy para evitar NOT NULL constraint
                nombre=current_user.get('first_name', ''),
                apellido=current_user.get('last_name', ''),
                fecha_registro=datetime.now(timezone.utc),
            )
            session.add(user)
            try:
                session.flush() # Para obtener user.id sin commitear aun
                print(f"Created user with ID: {user.id}")
            except Exception as e:
                print(f"Error creating user: {e}")
                raise HTTPException(status_code=500, detail=f"Error al crear usuario: {e}")

        if payload.nombre is not None:
            val = payload.nombre.strip()
            if any(char.isdigit() for char in val) or len(val) > 50:
                raise HTTPException(status_code=400, detail="El nombre no puede contener números ni exceder los 50 caracteres.")
            user.nombre = val
        if payload.apellido is not None:
            val = payload.apellido.strip()
            if any(char.isdigit() for char in val) or len(val) > 50:
                raise HTTPException(status_code=400, detail="El apellido no puede contener números ni exceder los 50 caracteres.")
            user.apellido = val
        if payload.foto_url is not None:
            user.foto_url = payload.foto_url.strip()
        if payload.biografia is not None:
            user.biografia = payload.biografia.strip()

        if payload.habilidades_ofertadas is not None:
            session.execute(
                delete(UsuarioHabilidad).where(
                    UsuarioHabilidad.usuario_id == user.id,
                    UsuarioHabilidad.categoria == "ofertada",
                )
            )
            for hab_id in payload.habilidades_ofertadas:
                session.add(UsuarioHabilidad(
                    habilidad_id=hab_id,
                    usuario_id=user.id,
                    categoria="ofertada",
                ))

        if payload.habilidades_buscadas is not None:
            session.execute(
                delete(UsuarioHabilidad).where(
                    UsuarioHabilidad.usuario_id == user.id,
                    UsuarioHabilidad.categoria == "buscada",
                )
            )
            for hab_id in payload.habilidades_buscadas:
                session.add(UsuarioHabilidad(
                    habilidad_id=hab_id,
                    usuario_id=user.id,
                    categoria="buscada",
                ))

        session.commit()
        session.refresh(user)
        return {"user": serialize_user(user, session)}
