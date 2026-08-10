import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings

security = HTTPBearer()

# Better-Auth's jwt plugin exposes signing keys at /api/auth/jwks on the
# Next.js app. PyJWKClient fetches + caches them, so no secret is shared
# between the two services — FastAPI verifies the token independently.
_jwk_client = PyJWKClient(f"{settings.BETTER_AUTH_URL}/api/auth/jwks")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Dependency for protected routes. Verifies the Bearer JWT issued by
    Better-Auth and returns its claims (sub, email, etc.).

    Usage:
        @router.get("/me")
        def get_me(user: dict = Depends(get_current_user)):
            return {"user_id": user["sub"]}
    """
    token = credentials.credentials
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["EdDSA", "ES256", "RS256"],
            options={"verify_aud": False},
        )
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )