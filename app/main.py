"""Import libraries for router implementation."""

from fastapi import FastAPI

from app.api.routes.auth_routes import router as auth_routher
from app.api.routes.password_reset_routes import router as password_reset_router

app = FastAPI(
    title="Donee API",
    version="0.1.0",
)

app.include_router(auth_routher, prefix="/auth", tags=["auth"])
app.include_router(password_reset_router, prefix="/auth", tags=["auth"])
