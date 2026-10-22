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
        from fastapi import Request, Response
        from sqlalchemy import delete, select

        import app.models  # noqa: F401
        from app.db.base import Base
        from app.db.session import SessionLocal, engine
        from app.main import app as api
        from app.models.auth.rate_limit import RateLimit
        from app.models.workspace.workspace import Workspace
        from app.models.workspace.workspace_member import WorkspaceMember
        from app.schemas.auth.user import UserCreate
        from app.services.auth.auth_service import register_user

        Base.metadata.create_all(engine)
        # An isolated object store exercises the real attachment service without AWS.
        objects = {}

        @api.post("/__test/reset-rate-limits")
        def reset_rate_limits():
            # Each browser test starts with its own allowance; enforcement stays active.
            with SessionLocal() as db:
                db.execute(delete(RateLimit))
                db.commit()
            return {"ok": True}

        @api.post("/__test/storage")
        async def upload_test_file(request: Request):
            form = await request.form()
            file = form["file"]
            content = await file.read()
            objects[form["key"]] = {
                "ContentLength": len(content),
                "ContentType": file.content_type,
                "body": content,
            }
            return Response(status_code=204)

        @api.get("/__test/storage")
        def download_test_file(key: str):
            item = objects[key]
            return Response(item["body"], media_type=item["ContentType"])

        def presign(key, content_type, size):
            return {
                "url": "http://127.0.0.1:4173/api/__test/storage",
                "fields": {"key": key},
            }, 300

        def download_url(key, *_args, **_kwargs):
            return f"http://127.0.0.1:4173/api/__test/storage?key={key}", 300

        try:
            with (
                patch(
                    "app.services.task.attachment_service.create_presigned_upload_url",
                    side_effect=presign,
                ),
                patch(
                    "app.services.task.attachment_service.create_presigned_access_url",
                    side_effect=download_url,
                ),
                patch(
                    "app.services.task.attachment_service.get_s3_object_metadata",
                    side_effect=lambda key: objects.get(key),
                ),
                patch(
                    "app.services.task.attachment_service.check_s3_object_exists",
                    side_effect=lambda key: key in objects,
                ),
                patch(
                    "app.services.task.attachment_service.delete_s3_object",
                    side_effect=lambda key: objects.pop(key, None),
                ),
                patch(
                    "app.services.task.task_service.delete_s3_object",
                    side_effect=lambda key: objects.pop(key, None),
                ),
                patch(
                    "app.services.workspace.workspace_service.delete_s3_object",
                    side_effect=lambda key: objects.pop(key, None),
                ),
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
