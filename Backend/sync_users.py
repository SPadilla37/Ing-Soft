import sys
import os

# Permitir la importación del módulo 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.db.models.entities import Usuario, UsuarioHabilidad, Intercambio, Conversacion, Mensaje, Reseña
from app.core.security import clerk_client
from sqlalchemy import select, delete

def cleanup_orphans():
    """
    Elimina usuarios de la base de datos local que ya no existen en el dashboard de Clerk.
    """
    print(">>> Iniciando sincronización profunda con Clerk...")
    with SessionLocal() as session:
        # Obtener todos los usuarios registrados en tu base de datos local
        db_users = session.execute(select(Usuario)).scalars().all()
        deleted_count = 0

        for user in db_users:
            if not user.clerk_id or user.clerk_id.startswith('mock_'):
                continue
                
            try:
                # Intentamos pedir el usuario a la API de Clerk usando su clerk_id
                clerk_client.users.get(user_id=user.clerk_id)
            except Exception:
                # Si Clerk no lo encuentra, procedemos a borrarlo y sus dependencias
                print(f"[-] Usuario no encontrado en Clerk. Limpiando: {user.email}")
                
                try:
                    # Limpiar manualmente dependencias si no hay cascade delete en la DB
                    session.execute(delete(UsuarioHabilidad).where(UsuarioHabilidad.usuario_id == user.id))
                    session.execute(delete(Mensaje).where(Mensaje.remitente_id == user.id))
                    session.execute(delete(Reseña).where((Reseña.autor_id == user.id) | (Reseña.receptor_id == user.id)))
                    session.execute(delete(Intercambio).where((Intercambio.usuario_emisor_id == user.id) | (Intercambio.usuario_receptor_id == user.id)))
                    
                    session.delete(user)
                    session.commit() # Commiteamos por usuario para evitar que un error aborte todo
                    deleted_count += 1
                except Exception as db_err:
                    print(f" [!] Error borrando de la DB: {db_err}")
                    session.rollback()
        
        print(f"\nSincronización terminada. Se eliminaron {deleted_count} registros obsoletos.")

if __name__ == "__main__":
    cleanup_orphans()