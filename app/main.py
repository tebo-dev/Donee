"""Import libraries for router implementation."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth_routes import router as auth_routher
from app.api.routes.password_reset_routes import router as password_reset_router

app = FastAPI(
    title="Donee API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routher, prefix="/auth", tags=["auth"])
app.include_router(password_reset_router, prefix="/auth", tags=["auth"])
