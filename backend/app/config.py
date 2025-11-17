import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PROJECT_NAME: str = "FlowSync API"

    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./flowsync.db")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRES_MINUTES: int = int(os.getenv("JWT_EXPIRES_MINUTES", "60"))

    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # ---------- OpenAI ----------
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    # vision-capable, cheap-ish model; you can override via env
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")


settings = Settings()
