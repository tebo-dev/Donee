"""Useful functions for codes management."""

from secrets import randbelow


def gen_random_code() -> str:
    """Generate a 6-digit numeric code as a string."""

    return f"{randbelow(1_000_000):06d}"
