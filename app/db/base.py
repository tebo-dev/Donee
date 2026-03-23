"""Import necessary libraries for models and migration."""

from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Ensure all models are imported so SQLAlchemy can register them
import app.models  # noqa: E402, F401
