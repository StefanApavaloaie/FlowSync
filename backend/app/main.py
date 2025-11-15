from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .config import settings
from .routers import health, auth, projects, assets, comments, ai

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

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
app.include_router(ai.router)


@app.get("/")
def root():
    return {"message": "FlowSync API running"}
