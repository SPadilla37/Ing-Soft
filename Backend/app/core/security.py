import os
from typing import Any
from clerk_backend_api import Clerk, authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions
from dotenv import load_dotenv

# Cargar variables desde el .env en la raiz si existe
root_dotenv = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env")
load_dotenv(root_dotenv)

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")

clerk_client = Clerk(bearer_auth=CLERK_SECRET_KEY)

class MockRequest:
    """Clase para simular un request para el SDK de Clerk"""
    def __init__(self, token: str):
        self.headers = {"Authorization": f"Bearer {token}"}

def verify_clerk_token(token: str) -> dict[str, Any] | None:
    """
    Verifica el token JWT de Clerk usando exclusivamente el SDK oficial
    """
    try:
        # Usamos authenticate_request del SDK para validar el token
        request = MockRequest(token)
        options = AuthenticateRequestOptions(secret_key=CLERK_SECRET_KEY)
        
        state = authenticate_request(request, options)
        
        # Obtenemos el user_id del estado (si el token es decodificable)
        payload = state.payload if state.payload else None
        user_id = payload.get('sub') if payload else None
        
        if not user_id:
            return None
            
        # Validar el usuario contra la API de Clerk
        # Esto garantiza que tengamos email y username para el registro en DB
        user = clerk_client.users.get(user_id=user_id)
        if user:
            email = user.email_addresses[0].email_address if user.email_addresses else ""
            return {
                **(payload or {}),
                "email": email,
                "username": user.username or user_id,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
            }
                
        return None
    except Exception as e:
        print(f"Clerk SDK verification failed: {e}")
        return None

def get_user_id_from_token(token: str) -> str | None:
    verified = verify_clerk_token(token)
    return verified.get('sub') if verified else None
