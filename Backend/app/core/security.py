import os
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext


SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-for-dev-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False

    if hashed_password.startswith("$argon2"):
        return pwd_context.verify(plain_password, hashed_password)

    # Backward compatibility for legacy SHA-256 hashes.
    return sha256(plain_password.encode("utf-8")).hexdigest() == hashed_password


def needs_rehash(hashed_password: str) -> bool:
    if not hashed_password or not hashed_password.startswith("$argon2"):
        return True
    return pwd_context.needs_update(hashed_password)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict[str, Any] | None:
    """
    Verify and decode a JWT token.
    
    Returns the decoded payload with role field guaranteed to be present.
    If the token doesn't contain a role field (legacy tokens), defaults to "user".
    
    Args:
        token: JWT token string to verify
        
    Returns:
        Decoded payload dict with role field, or None if token is invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Ensure role field exists for backward compatibility with legacy tokens
        if "role" not in payload:
            payload["role"] = "user"
        
        return payload
    except JWTError:
        return None
