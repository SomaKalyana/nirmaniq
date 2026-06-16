import io
import logging
from typing import Dict, Any

logger = logging.getLogger("extractor")

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

try:
    from PIL import Image
except Exception:
    Image = None

try:
    import pytesseract
except Exception:
    pytesseract = None

from .parse_fields import parse_fields
from .utils import normalize_text


async def extract_from_bytes(content: bytes, mime: str = None) -> Dict[str, Any]:
    text = ""
    fields = {}

    # PDF path
    if mime and "pdf" in (mime or "") or (content[:4] == b"%PDF"):
        if fitz is None:
            raise RuntimeError("PyMuPDF (fitz) is required for PDF extraction")
        doc = fitz.open(stream=content, filetype="pdf")
        parts = []
        for page in doc:
            try:
                parts.append(page.get_text("text"))
            except Exception:
                parts.append("")
        text = "\n".join(parts)

        # fallback to OCR if text is sparse (only if Tesseract is available)
        if len(text.strip()) < 200 and pytesseract and Image is not None:
            logger.info("Text extraction sparse, attempting OCR fallback")
            try:
                # render pages and OCR
                ocr_parts = []
                for page in doc:
                    pix = page.get_pixmap(dpi=200)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    ocr_parts.append(pytesseract.image_to_string(img))
                text = "\n".join(ocr_parts)
            except Exception as e:
                logger.warning(f"OCR fallback failed: {e}, using text extraction result")
                # Keep the original text extraction result

    else:
        # treat as image
        if Image is None:
            raise RuntimeError("Pillow is required for image processing")
        if pytesseract is None:
            raise RuntimeError("pytesseract is required for image OCR")
        img = Image.open(io.BytesIO(content))
        # simple preprocessing
        try:
            img = img.convert("L")
        except Exception:
            pass
        text = pytesseract.image_to_string(img)

    text = normalize_text(text)
    fields = parse_fields(text)

    return {"text": text, "fields": fields}
