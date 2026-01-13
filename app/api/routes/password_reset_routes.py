"""Import necessary libraries for endpoints creation."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.schemas.password_reset import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyResetCodeRequest,
)
from app.services.password_reset_service import (
    request_password_reset,
    reset_password_service,
    verify_reset_code_service,
)

router = APIRouter(tags=["auth"])


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send password reset code."""

    try:
        code = request_password_reset(db, payload)

        if settings.ENVIRONMENT == "development":
            return {"message": "Reset code sent", "debug_code": code}

        return {"message": "Reset code sent"}
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)
        ) from error


@router.post("/verify-reset-code")
def verify_reset_code(payload: VerifyResetCodeRequest, db: Session = Depends(get_db)):
    """Verify password reset code."""

    try:
        verify_reset_code_service(db, payload)
        return {"message": "Code is valid"}
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)
        ) from error


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset user password."""

    try:
        reset_password_service(db, payload)
        return {"message": "Password updated successfully"}
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)
        ) from error
