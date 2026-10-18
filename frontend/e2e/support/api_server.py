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

        import app.models  # noqa: F401
        from app.db.base import Base
        from app.db.session import engine
        from app.main import app as api

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
                uvicorn.run(api, host="127.0.0.1", port=8011, log_level="warning")
        finally:
            engine.dispose()


if __name__ == "__main__":
    main()
