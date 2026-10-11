"""Borrower identity (name, GSTIN/PAN/CIN/DIN, directors) and evidence-backed red flags / positives."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass

from utils.india import CIN_RE, DIN_RE, GSTIN_RE, PAN_RE, is_valid_gstin

_SUFFIX = r"(?:Private Limited|Pvt\.? Ltd\.?|Limited|Ltd\.?|LLP)"
_COMPANY_RE = re.compile(rf"\b([A-Z][A-Za-z0-9&.,'()\- ]{{2,80}}?\s{_SUFFIX})(?![A-Za-z])")
_LABELLED_RE = re.compile(
    rf"(?:borrower|name of the company|account name|legal name|corporate debtor|accused|to)\s*:\s*(?:the\s+)?"
    rf"([A-Z][A-Za-z0-9&.,'()\- ]{{2,80}}?\s{_SUFFIX})(?![A-Za-z])", re.I)
_DIRECTOR_RE = re.compile(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[,(]?\s*DIN[:\s#-]*(\d{8})")


def company_name(text: str) -> str | None:
    if m := _LABELLED_RE.search(text):
        return m.group(1).strip()
    for line in text.splitlines()[:15]:
        line = line.strip()
        if m := _COMPANY_RE.fullmatch(line):
            return m.group(1).strip()
    if m := _COMPANY_RE.search(text):
        name = re.sub(r"^(?:the|of|for|to|by|and)\s+", "", m.group(1).strip(), flags=re.I)
        return name
    return None


def identifiers(text: str) -> dict[str, list[str]]:
    upper = text.upper()
    gstins, invalid = [], []
    for g in dict.fromkeys(GSTIN_RE.findall(upper)):
        (gstins if is_valid_gstin(g) else invalid).append(g)
    pans = list(dict.fromkeys([*PAN_RE.findall(upper), *(g[2:12] for g in gstins)]))
    return {"gstins": gstins, "pans": pans, "cins": list(dict.fromkeys(CIN_RE.findall(upper))),
            "dins": list(dict.fromkeys(DIN_RE.findall(text))), "invalid_gstins": invalid}


def directors(text: str) -> list[dict[str, str | None]]:
    seen: dict[str, dict[str, str | None]] = {}
    for name, din in _DIRECTOR_RE.findall(text):
        seen.setdefault(din, {"name": name.strip(), "din": din})
    return list(seen.values())


@dataclass
class RedFlag:
    label: str
    severity: str
    five_c: str
    evidence: str
    page: int | None = None

    def to_dict(self) -> dict:
        return asdict(self)


# (pattern, label, severity, five_c)
RED_FLAG_RULES: list[tuple[str, str, str, str]] = [
    (r"going[- ]concern", "Going-concern uncertainty flagged by auditor", "CRITICAL", "character"),
    (r"\b(?:qualified|adverse|disclaimer of) (?:audit )?opinion", "Qualified/adverse audit opinion", "HIGH", "character"),
    (r"emphasis of matter", "Auditor emphasis of matter", "MEDIUM", "character"),
    (r"wil(?:l)?ful defaulter", "Wilful defaulter reference", "CRITICAL", "character"),
    (r"\bnpa\b|non[- ]performing asset|\bsma[- ]?[012]\b|special mention account", "NPA / SMA classification mentioned", "CRITICAL", "capacity"),
    (r"restructur", "Debt restructuring", "HIGH", "capacity"),
    (r"one[- ]time settlement|\bots\b", "One-time settlement", "HIGH", "character"),
    (r"(?:cheque|chq|ecs|nach)[^.\n]{0,20}(?:return|bounce|dishono)|insufficient funds|funds insufficient",
     "Cheque/ECS bounces", "HIGH", "capacity"),
    (r"overdue|delayed payments?|payment delays?|collections were delayed", "Overdue / delayed payments", "MEDIUM", "capacity"),
    (r"liquidity (?:pressure|stress|crunch|tight)|negative (?:operating )?cash flow", "Liquidity stress", "MEDIUM", "capacity"),
    (r"(?:utili[sz]ation|drawings?)[^.\n]{0,30}above (?:the )?sanctioned|overdrawn|overdrawing", "Limit overdrawals", "HIGH", "capacity"),
    (r"margin (?:compression|erosion|contraction)", "Margin compression", "MEDIUM", "capacity"),
    (r"related[- ]party (?:purchases|sales|transactions|dealings)", "Material related-party transactions", "MEDIUM", "character"),
    (r"(?:rating|outlook)[^.\n]{0,40}(?:downgrade|revised to negative|negative)|downgraded", "Credit rating downgrade / negative outlook", "HIGH", "conditions"),
    (r"circular trading|round[- ]tripping|accommodation entr", "Circular trading / round-tripping suspicion", "CRITICAL", "character"),
    (r"revenue inflation|inflated (?:sales|revenue|turnover)|fictitious (?:sales|invoices)", "Possible revenue inflation", "HIGH", "character"),
    (r"\bnclt\b|insolvency and bankruptcy|\bibc\b|corporate insolvency", "Insolvency proceedings (NCLT/IBC)", "CRITICAL", "character"),
    (r"sarfaesi|debts? recovery tribunal|\bdrt\b", "Recovery proceedings (SARFAESI/DRT)", "HIGH", "character"),
    (r"enforcement directorate|\bcbi\b|\bsfio\b|\bed\b raid|search and seizure", "Investigative agency action", "CRITICAL", "character"),
    (r"gst[^.\n]{0,30}(?:evasion|show[- ]cause)", "GST evasion / show-cause notice", "HIGH", "character"),
    (r"mismatch[^.\n]{0,40}gstr|gstr[- ]?2[ab][^.\n]{0,30}(?:vs|and|versus)[^.\n]{0,10}gstr[- ]?3b[^.\n]{0,30}mismatch",
     "GSTR-2A vs 3B mismatch", "HIGH", "character"),
    (r"input tax credit[^.\n]{0,40}(?:validation|question|disallow|reversal)", "ITC claim under question", "MEDIUM", "character"),
    (r"unsecured (?:promoter )?(?:support|loans?) from promoters?|unsecured promoter (?:support|loans?|funding)",
     "Reliance on unsecured promoter funding", "LOW", "capital"),
    (r"contingent liabilit", "Contingent liabilities disclosed", "LOW", "capital"),
    (r"auditor[^.\n]{0,20}resign", "Auditor resignation", "HIGH", "character"),
    (r"(?:cfo|chief financial officer|company secretary|kmp)[^.\n]{0,30}resign", "KMP resignation", "MEDIUM", "character"),
    (r"capacity utili[sz]ation[^.\n]{0,30}(?:declined|fell|dropped|low)|(?:operating|running) at \d{1,2}% capacity",
     "Low capacity utilisation", "MEDIUM", "capacity"),
]
POSITIVE_RULES: list[tuple[str, str]] = [
    (r"strong order book|order book (?:of|stood at)", "Healthy order book gives revenue visibility"),
    (r"unmodified opinion|unqualified opinion", "Unmodified audit opinion"),
    (r"improved collections|collections improved", "Improving collections"),
    (r"adequate liquidity|liquidity (?:remained )?adequate", "Adequate liquidity"),
    (r"rating (?:was )?upgraded|upgraded to", "Credit rating upgrade"),
    (r"no form 483|establishment inspection report", "Clean regulatory inspection"),
    (r"reduced (?:working capital )?borrowings|deleverag", "Reduced borrowings"),
    (r"no increase in pledge|no (?:promoter )?shares (?:are )?pledged", "No increase in promoter pledge"),
    (r"filings? (?:are )?up to date", "Statutory filings up to date"),
]
_RED = [(re.compile(p, re.I), label, sev, c) for p, label, sev, c in RED_FLAG_RULES]
_POS = [(re.compile(p, re.I), label) for p, label in POSITIVE_RULES]
_NEGATION = re.compile(r"\b(?:no|not|nil|never|without|neither|none)\b[^.\n]{0,40}$", re.I)
_SENTENCE = re.compile(r"[^.\n]+(?:\.(?!\d)|\n|$)")
_WRAP = re.compile(r"(?<![.:;!?])\n(?=[a-z0-9(])")  # a PDF line wrap inside a sentence


def _sentences(text: str):
    for m in _SENTENCE.finditer(_WRAP.sub(" ", text)):
        s = m.group(0).strip()
        if s:
            yield s


def extract_red_flags(pages: list[tuple[int, str]]) -> list[RedFlag]:
    """One flag per label (first evidence wins). Negated mentions ("No cheque returned ...") are ignored."""
    found: dict[str, RedFlag] = {}
    for page_no, text in pages:
        for sentence in _sentences(text):
            for pattern, label, severity, five_c in _RED:
                if label in found:
                    continue
                m = pattern.search(sentence)
                if m and not _NEGATION.search(sentence[: m.start()]):
                    found[label] = RedFlag(label, severity, five_c, sentence[:240], page_no)
    return list(found.values())


def positive_signals(text: str) -> list[str]:
    out: list[str] = []
    for sentence in _sentences(text):
        for pattern, label in _POS:
            if label not in out and pattern.search(sentence):
                out.append(label)
    return out
