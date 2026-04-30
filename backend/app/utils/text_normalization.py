import re
import unicodedata


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    compact_spaces = re.sub(r"\s+", " ", ascii_only).strip().lower()
    return compact_spaces

