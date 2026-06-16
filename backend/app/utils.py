import unicodedata
import re
import logging

logger = logging.getLogger("extractor_utils")


def normalize_text(text: str) -> str:
    if not text:
        return ""
    # Normalize unicode and collapse repeated whitespace but keep newlines
    s = unicodedata.normalize("NFC", text)
    s = re.sub(r"[\t\r]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[ \u00A0]{2,}", " ", s)
    return s.strip()
