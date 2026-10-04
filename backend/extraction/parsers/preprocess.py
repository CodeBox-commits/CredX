"""Text clean-up applied to every page before extraction."""

from __future__ import annotations

import re
import unicodedata

_REPLACEMENTS = {
    "₹": "₹",
    "`": "₹",  # legacy Rupee font glyph in older Indian PDFs
    " ": " ",
    "–": "-",
    "—": "-",
    "−": "-",
    "‘": "'",
    "’": "'",
    "“": '"',
    "”": '"',
    "ﬁ": "fi",
    "ﬂ": "fl",
}
_HYPHEN_BREAK = re.compile(r"(\w)-\n(\w)")
_MULTI_SPACE = re.compile(r"[ \t]{2,}")
_RUPEE_WORD = re.compile(r"\bRs\s*\.?\s*(?=\d)", re.I)


def clean_page_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    for src, dst in _REPLACEMENTS.items():
        text = text.replace(src, dst)
    text = _HYPHEN_BREAK.sub(r"\1\2", text)
    text = _RUPEE_WORD.sub("Rs. ", text)
    # Keep double spaces as a column hint but cap runs to two.
    text = _MULTI_SPACE.sub("  ", text)
    lines = [line.rstrip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line.strip())


def strip_repeated_headers(pages: list[str]) -> list[str]:
    """Remove header/footer lines repeated on more than half of the pages."""
    if len(pages) < 3:
        return pages
    counts: dict[str, int] = {}
    for page in pages:
        for line in {ln.strip() for ln in page.splitlines()[:3] + page.splitlines()[-3:]}:
            if line:
                counts[line] = counts.get(line, 0) + 1
    repeated = {line for line, count in counts.items() if count > len(pages) / 2 and len(line) < 120}
    return ["\n".join(ln for ln in page.splitlines() if ln.strip() not in repeated) for page in pages]
