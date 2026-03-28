"""Import libraries for router implementation."""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.auth_routes import router as auth_routher
from app.api.routes.password_reset_routes import router as password_reset_router
from app.api.routes.workspace_routes import router as workspace_router
from app.core.domain_errors.auth_domain_errors import (
    ExistingEmail,
    InvalidCode,
    InvalidCredentials,
    NotFound,
    UsernameTaken,
)
from app.core.domain_errors.base import DomainError
from app.core.domain_errors.workspace_domain_errors import (
    ExistingWorkspaceName,
    NotAuthorized,
    WorkspaceNotFound,
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
app.include_router(workspace_router, tags=["workspace"])


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    """Domain errors handler."""

    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Bad request."

    # Auth Domain Errors:

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

    # Workspace Domain Errors:

    elif isinstance(exc, ExistingWorkspaceName):
        detail = "Workspace name already taken."
        status_code = status.HTTP_409_CONFLICT

    elif isinstance(exc, NotAuthorized):
        detail = "No authorized."
        status_code = status.HTTP_403_FORBIDDEN

    elif isinstance(exc, WorkspaceNotFound):
        detail = "Workspace not found."
        status_code = status.HTTP_404_NOT_FOUND

    return JSONResponse(status_code=status_code, content={"detail": detail})
