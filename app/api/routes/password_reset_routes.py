"""Import necessary libraries for endpoints creation."""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.rate_limit import enforce_auth_limit
from app.db.session import get_db
from app.schemas.auth.password_reset import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyResetCodeRequest,
)
from app.schemas.auth.user import Token
from app.services.auth.password_reset_service import (
    request_password_reset,
    reset_password_service,
    verify_reset_code_service,
)

router = APIRouter(tags=["auth"])


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)
):
    """Send password reset code."""

    enforce_auth_limit(db, request, "forgot-password", str(payload.email))
    request_password_reset(db, payload)
    return {"message": "If the account exists, a reset code has been sent."}


@router.post("/verify-reset-code")
def verify_reset_code(
    payload: VerifyResetCodeRequest, request: Request, db: Session = Depends(get_db)
):
    """Verify password reset code."""

    enforce_auth_limit(db, request, "recovery-verify", str(payload.email))
    verify_reset_code_service(db, payload)
    return {"message": "Code is valid."}


@router.post("/reset-password", response_model=Token)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Reset user password."""

    response.headers["Cache-Control"] = "no-store"
    enforce_auth_limit(db, request, "recovery-reset", str(payload.email))
    return reset_password_service(db, payload)
