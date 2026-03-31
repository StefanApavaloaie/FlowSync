import logging
# import sentry_sdk

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Configure standard python logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Sentry initialization (commented out until a valid DSN is provided)
# sentry_sdk.init(
#     dsn="YOUR_SENTRY_DSN",
#     traces_sample_rate=1.0,
#     profiles_sample_rate=1.0,
# )

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

from .database import Base, engine
from .config import settings
from .routers import health, auth, projects, assets, comments, invites, activity

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

# Register slowapi limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded assets
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(assets.router)
app.include_router(comments.router)
app.include_router(invites.router)
# app.include_router(ai.router)
app.include_router(activity.router)

@app.get("/")
def root():
    return {"message": "FlowSync API running"}
