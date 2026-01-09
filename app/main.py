"""Import libraries for router implementation."""

from fastapi import FastAPI
from app.api.routes.auth_routes import router as auth_routher


app = FastAPI(
    title="Donee API",
    version="0.1.0",
)

app.include_router(
    auth_routher,
    prefix="/auth",
    tags=["auth"]
)
