from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy import select
from app.core.security import verify_clerk_token
from app.db.database import SessionLocal
from app.db.models.entities import Usuario
from app.services.core import serialize_user, utc_now_iso


router = APIRouter()

@router.get("/health")
def health() -> dict:
    return {"status": "ok", "time": utc_now_iso()}

@router.get("/auth/verify")
async def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Token requerido")
    
    token = authorization.split(' ')[1]
    claims = verify_clerk_token(token)
    
    if not claims:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    return {"valid": True, "user_id": claims.get('sub'), "email": claims.get('email_addresses', [{}])[0].get('email_address')}

async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    token = authorization.split(' ')[1]
    claims = verify_clerk_token(token)
    
    if not claims:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    return claims
