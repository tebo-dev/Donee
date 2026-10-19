"""Run unchanged Donee routes against an isolated database and test mailbox."""

import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch


def main():
    """No real database, developer secrets, external mail, or backend edits."""
    if os.environ.get("DONEE_E2E_BACKEND") != "1":
        raise RuntimeError("Only run this server through the frontend browser tests.")

    repo = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(repo))
    with TemporaryDirectory(prefix="donee-browser-tests-") as directory:
        os.environ.update(
            DATABASE_URL=f"sqlite:///{Path(directory).as_posix()}/test.db",
            ENVIRONMENT="test",
            JWT_SECRET_KEY="isolated-browser-tests-not-a-production-key",
            AWS_ACCESS_KEY_ID="test",
            AWS_SECRET_ACCESS_KEY="test",
            AWS_S3_BUCKET_NAME="test",
            MAILGUN_API_KEY="",
            MAILGUN_DOMAIN="",
            CORS_ALLOWED_ORIGINS="[]",
        )

        import uvicorn
        from sqlalchemy import select

        import app.models  # noqa: F401
        from app.db.base import Base
        from app.db.session import SessionLocal, engine
        from app.main import app as api
        from app.models.workspace.workspace import Workspace
        from app.models.workspace.workspace_member import WorkspaceMember
        from app.schemas.auth.user import UserCreate
        from app.services.auth.auth_service import register_user

        Base.metadata.create_all(engine)
        try:
            with (
                patch("app.services.auth.auth_service.send_email"),
                patch("app.services.auth.password_reset_service.send_email"),
                patch(
                    "app.services.auth.password_reset_service.gen_random_code",
                    return_value="123456",
                ),
            ):
                # Membership has no public management endpoint yet. Seed a viewer
                # only in this temporary test database to exercise real access checks.
                with SessionLocal() as db:
                    owner = register_user(
                        db,
                        UserCreate(
                            email="workspace-owner@example.com",
                            username="space_owner",
                            password="workspace-fixture-123",
                        ),
                    )
                    viewer = register_user(
                        db,
                        UserCreate(
                            email="workspace-viewer@example.com",
                            username="space_viewer",
                            password="workspace-fixture-123",
                        ),
                    )
                    workspace = db.scalar(
                        select(Workspace).where(Workspace.owner_id == owner.id)
                    )
                    db.add(
                        WorkspaceMember(
                            workspace_id=workspace.id, user_id=viewer.id, role="viewer"
                        )
                    )
                    db.commit()
                uvicorn.run(api, host="127.0.0.1", port=8011, log_level="warning")
        finally:
            engine.dispose()


if __name__ == "__main__":
    main()
