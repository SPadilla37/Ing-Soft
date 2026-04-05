from functools import wraps
from fastapi import HTTPException, Header
from typing import Callable
import logging
from app.core.security import verify_token

logger = logging.getLogger(__name__)


def require_admin(func: Callable):
    """
    Middleware decorator that requires admin role.
    
    Validates JWT token and extracts role from payload.
    Returns 401 for invalid/missing tokens.
    Returns 403 for users without admin role.
    Injects current_user_id and current_user_role into kwargs.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract authorization header
        authorization: str = kwargs.get('authorization') or ''
        
        # Check if token is present
        if not authorization.startswith('Bearer '):
            raise HTTPException(
                status_code=401, 
                detail="Token no proporcionado"
            )
        
        # Extract token from Bearer scheme
        token = authorization.replace('Bearer ', '')
        
        # Verify and decode token
        payload = verify_token(token)
        
        if not payload:
            raise HTTPException(
                status_code=401, 
                detail="Token inválido o expirado"
            )
        
        # Extract role from payload (defaults to 'user' for legacy tokens)
        role = payload.get('role', 'user')
        
        # Check if user has admin role (legacy 'superadmin' tokens treated as 'admin')
        if role not in ['admin', 'superadmin']:
            raise HTTPException(
                status_code=403, 
                detail="Acceso denegado: se requiere rol admin"
            )
        
        # Inject user_id and role into kwargs
        kwargs['current_user_id'] = payload.get('sub')
        kwargs['current_user_role'] = role
        
        return await func(*args, **kwargs)
    
    return wrapper


# Legacy alias for backward compatibility during transition
# All admin operations now use require_admin
require_superadmin = require_admin
