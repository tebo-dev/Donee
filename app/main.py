"""Import libraries for router implementation."""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.auth_routes import router as auth_routher
from app.api.routes.password_reset_routes import router as password_reset_router
from app.core.domain_errors import (
    DomainError,
    ExistingEmail,
    InvalidCode,
    InvalidCredentials,
    NotFound,
    UsernameTaken,
)

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


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    """Domain errors handler."""

    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Bad request."

    if isinstance(exc, ExistingEmail):
        detail = "Email already registered."
        status_code = status.HTTP_409_CONFLICT

    elif isinstance(exc, UsernameTaken):
        detail = "Username already taken."
        status_code = status.HTTP_409_CONFLICT

    elif isinstance(exc, InvalidCredentials):
        detail = "Invalid credentials."
        status_code = status.HTTP_401_UNAUTHORIZED

    elif isinstance(exc, NotFound):
        detail = "Resource not found."
        status_code = status.HTTP_404_NOT_FOUND

    elif isinstance(exc, InvalidCode):
        detail = "Code is invalid or expired."
        status_code = status.HTTP_400_BAD_REQUEST

    return JSONResponse(status_code=status_code, content={"detail": detail})
