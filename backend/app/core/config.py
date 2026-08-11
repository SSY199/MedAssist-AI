from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # URL of the Next.js app hosting Better-Auth (where /api/auth/jwks lives)
    BETTER_AUTH_URL: str = "http://localhost:3000"

    MONGODB_URI: str
    MONGODB_DB_NAME: str = "medassistai"
    MAPBOX_ACCESS_TOKEN: str

    class Config:
        env_file = ".env"
        extra = "ignore"  # <--- ADD THIS EXACT LINE HERE


settings = Settings()
