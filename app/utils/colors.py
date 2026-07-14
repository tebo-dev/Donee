"""Useful functions for hex colors management."""

import random


def random_hex_color():
    """Gen random hex color code."""

    color = f"#{random.randint(0, 0xFFFFFF):06x}"
    return color
