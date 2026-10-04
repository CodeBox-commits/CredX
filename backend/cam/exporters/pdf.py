"""Branded PDF export of a CAM document (ReportLab)."""

from __future__ import annotations

import io
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from ..formatting.formatters import date

NAVY = colors.HexColor("#0B2545")
BLUE = colors.HexColor("#1C6EF3")
MUTED = colors.HexColor("#5B6B82")
LINE = colors.HexColor("#D9E2EF")
TONES = {
    "positive": (colors.HexColor("#E8F7EF"), colors.HexColor("#0F7B4C")),
    "warning": (colors.HexColor("#FFF6E5"), colors.HexColor("#A15C00")),
    "negative": (colors.HexColor("#FDECEC"), colors.HexColor("#B42318")),
    "neutral": (colors.HexColor("#EEF3FA"), NAVY),
}


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=base["Title"], fontName="Helvetica-Bold", fontSize=20, textColor=NAVY, alignment=TA_LEFT, spaceAfter=4),
        "subtitle": ParagraphStyle("st", parent=base["Normal"], fontSize=9.5, textColor=MUTED, spaceAfter=10),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, textColor=NAVY, spaceBefore=10, spaceAfter=6),
        "h3": ParagraphStyle("h3", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=10, textColor=NAVY, spaceBefore=6, spaceAfter=3),
        "body": ParagraphStyle("b", parent=base["Normal"], fontName="Helvetica", fontSize=9, leading=12.5, spaceAfter=5),
        "cell": ParagraphStyle("c", parent=base["Normal"], fontName="Helvetica", fontSize=7.8, leading=10),
        "cellh": ParagraphStyle("ch", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=7.8, leading=10, textColor=colors.white),
        "comment": ParagraphStyle("cm", parent=base["Normal"], fontName="Helvetica-Oblique", fontSize=8.5, leading=11, textColor=colors.HexColor("#3B4A5E")),
    }


def _txt(value: Any) -> str:
    # ReportLab's core fonts lack the ₹ glyph; use the conventional "Rs." in PDFs.
    return escape(str(value)).replace("₹", "Rs. ")


def _table(block: dict[str, Any], st: dict[str, ParagraphStyle], width: float) -> list[Any]:
    cols = block["columns"]
    data = [[Paragraph(_txt(c), st["cellh"]) for c in cols]]
    data += [[Paragraph(_txt(c), st["cell"]) for c in row] for row in block["rows"]]
    first = 0.34 if len(cols) > 2 else 0.5
    widths = [width * first] + [width * (1 - first) / (len(cols) - 1)] * (len(cols) - 1)
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F6F8FC")]),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    out: list[Any] = [t]
    if block.get("caption"):
        out.insert(0, Paragraph(f"<font color='#5B6B82' size='8'>{_txt(block['caption'])}</font>", st["body"]))
    out.append(Spacer(1, 5))
    return out


def _kv(block: dict[str, Any], st: dict[str, ParagraphStyle], width: float) -> list[Any]:
    items = block["items"]
    rows = []
    for i in range(0, len(items), 2):
        pair = items[i : i + 2]
        row = []
        for item in pair:
            row += [Paragraph(f"<font color='#5B6B82'>{_txt(item['label'])}</font>", st["cell"]), Paragraph(f"<b>{_txt(item['value'])}</b>", st["cell"])]
        while len(row) < 4:
            row.append("")
        rows.append(row)
    t = Table(rows, colWidths=[width * 0.18, width * 0.32, width * 0.18, width * 0.32])
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.3, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    return [t, Spacer(1, 6)]


def _callout(block: dict[str, Any], st: dict[str, ParagraphStyle], width: float) -> list[Any]:
    bg, fg = TONES.get(block.get("tone", "neutral"), TONES["neutral"])
    content = [Paragraph(f"<font color='{fg.hexval()}'><b>{_txt(block['title'])}</b></font>", st["body"]),
               Paragraph(_txt(block.get("text", "")), st["body"])]
    t = Table([[content]], colWidths=[width])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("LINEBEFORE", (0, 0), (0, -1), 3, fg),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return [t, Spacer(1, 6)]


def render_pdf(cam: dict[str, Any], *, bank_name: str = "CredX Lending") -> bytes:
    buffer = io.BytesIO()
    st = _styles()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=20 * mm, bottomMargin=16 * mm,
                            title=cam["title"], author="CredX")
    width = A4[0] - 32 * mm

    def decorate(canvas, document) -> None:  # type: ignore[no-untyped-def]
        canvas.saveState()
        canvas.setFillColor(NAVY)
        canvas.rect(0, A4[1] - 11 * mm, A4[0], 11 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(16 * mm, A4[1] - 7 * mm, "CredX · Credit Appraisal Memo")
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(A4[0] - 16 * mm, A4[1] - 7 * mm, f"{cam.get('reference') or ''} · CONFIDENTIAL")
        canvas.setFillColor(MUTED)
        canvas.drawString(16 * mm, 9 * mm, f"Generated {date(cam.get('generated_at'))} by CredX AI underwriting · {bank_name}")
        canvas.drawRightString(A4[0] - 16 * mm, 9 * mm, f"Page {document.page}")
        canvas.restoreState()

    story: list[Any] = [
        Paragraph(_txt(cam["title"]), st["title"]),
        Paragraph(_txt(f"Reference {cam.get('reference')} · Prepared {date(cam.get('generated_at'))}"
                       + (f" · Analyst: {cam['prepared_by']}" if cam.get("prepared_by") else "")), st["subtitle"]),
    ]
    head = cam.get("headline") or {}
    if head.get("credit_score"):
        cells = [["CredX score", "Grade", "Risk", "PD", "Recommended", "Rate"],
                 [str(head["credit_score"]), head.get("grade") or "—", (head.get("risk_level") or "—").title(),
                  f"{(head.get('pd') or 0):.2%}", _txt(f"₹{(head.get('amount') or 0) / 1e7:,.2f} Cr"), f"{head.get('rate') or 0:.2f}%"]]
        t = Table(cells, colWidths=[width / 6] * 6)
        t.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, 0), "Helvetica"), ("FONTSIZE", (0, 0), (-1, 0), 7.5),
                               ("TEXTCOLOR", (0, 0), (-1, 0), MUTED), ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                               ("FONTSIZE", (0, 1), (-1, 1), 12), ("TEXTCOLOR", (0, 1), (-1, 1), NAVY),
                               ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F6F8FC")),
                               ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        story += [t, Spacer(1, 8)]

    for index, section in enumerate(cam["sections"]):
        flow: list[Any] = [Paragraph(_txt(section["title"]), st["h2"])]
        for block in section["blocks"]:
            kind = block["type"]
            if kind == "paragraph" and block.get("text"):
                flow.append(Paragraph(_txt(block["text"]), st["body"]))
            elif kind == "heading":
                flow.append(Paragraph(_txt(block["text"]), st["h3"]))
            elif kind == "bullets":
                flow += [Paragraph(f"•&nbsp;&nbsp;{_txt(item)}", st["body"]) for item in block["items"]]
            elif kind == "table" and block["rows"]:
                flow += _table(block, st, width)
            elif kind == "kv":
                flow += _kv(block, st, width)
            elif kind == "callout":
                flow += _callout(block, st, width)
        if section.get("analyst_comment"):
            flow.append(Paragraph(f"Analyst comment: {_txt(section['analyst_comment'])}", st["comment"]))
        story.append(KeepTogether(flow[:3]))
        story += flow[3:]
        if index == 0:
            story.append(PageBreak())

    story += [Spacer(1, 14), Paragraph(
        "This memo was generated by CredX from borrower-submitted documents, automated research and model outputs. "
        "All recommendations are subject to sanctioning-authority approval under the lender's credit policy.", st["comment"])]
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return buffer.getvalue()
