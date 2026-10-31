"""Configure isolated test settings before the API worker imports Donee."""

import os
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory


def main():
    """Run the browser-test worker without touching configured services."""
    if os.environ.get("DONEE_E2E_BACKEND") != "1":
        raise RuntimeError("Only run this server through the frontend browser tests.")
    repo = Path(__file__).resolve().parents[3]
    with TemporaryDirectory(prefix="donee-browser-tests-") as directory:
        environment = {
            **os.environ,
            "DATABASE_URL": f"sqlite:///{Path(directory).as_posix()}/test.db",
            "ENVIRONMENT": "test",
            "JWT_SECRET_KEY": "isolated-browser-tests-not-a-production-key",
            "AWS_ACCESS_KEY_ID": "test",
            "AWS_SECRET_ACCESS_KEY": "test",
            "AWS_S3_BUCKET_NAME": "test",
            "MAILGUN_API_KEY": "",
            "MAILGUN_DOMAIN": "",
            "CORS_ALLOWED_ORIGINS": "[]",
        }
        subprocess.run(
            [sys.executable, "-m", "frontend.e2e.support.api_worker"],
            cwd=repo,
            env=environment,
            check=True,
        )


if __name__ == "__main__":
    main()
