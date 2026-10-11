"""CAM renderers: HTML (Jinja2), PDF (ReportLab platypus), DOCX (python-docx)."""

from __future__ import annotations

import io
import os
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
BRAND = (11 / 255, 79 / 255, 156 / 255)
DECISION_COLORS = {"APPROVE": "#0f9d6b", "APPROVE_WITH_CONDITIONS": "#2f8f5b", "REFER": "#d99100", "DECLINE": "#d64545"}

_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=select_autoescape(["html", "j2"]))


def render_html(ctx: dict[str, Any], sections: list[dict[str, Any]], version: int) -> str:
    return _env.get_template("cam.html.j2").render(
        company=ctx.get("company") or {}, case=ctx.get("case") or {}, sections=sections, version=version,
        generated_on=datetime.now(UTC).strftime("%d %b %Y"),
    )


# ---------------------------------------------------------------- PDF
@lru_cache
def _pdf_fonts() -> tuple[str, str, bool]:
    """Register a TTF with the ₹ glyph if available (DejaVu on Linux, Arial/Nirmala on Windows)."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    candidates = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        (os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", "arial.ttf"),
         os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", "arialbd.ttf")),
        (os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", "Nirmala.ttc"), None),
    ]
    for regular, bold in candidates:
        if regular and os.path.exists(regular) and not regular.endswith(".ttc"):
            try:
                pdfmetrics.registerFont(TTFont("CXSans", regular))
                pdfmetrics.registerFont(TTFont("CXSans-Bold", bold if bold and os.path.exists(bold) else regular))
                return "CXSans", "CXSans-Bold", True
            except Exception:
                continue
    return "Helvetica", "Helvetica-Bold", False


def render_pdf(ctx: dict[str, Any], sections: list[dict[str, Any]], version: int) -> bytes:
    from xml.sax.saxutils import escape

    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    regular, bold, has_rupee = _pdf_fonts()

    def t(s: Any) -> str:
        text = escape(str(s if s is not None else "—"))
        return text if has_rupee else text.replace("₹", "Rs ")

    brand = colors.Color(*BRAND)
    base = ParagraphStyle("base", fontName=regular, fontSize=8.8, leading=12, alignment=TA_LEFT)
    small = ParagraphStyle("small", parent=base, fontSize=7.6, leading=10, textColor=colors.HexColor("#5b6b80"))
    h1 = ParagraphStyle("h1", parent=base, fontName=bold, fontSize=17, leading=21)
    h2 = ParagraphStyle("h2", parent=base, fontName=bold, fontSize=11, leading=15, textColor=brand, spaceBefore=8, spaceAfter=4)
    cell = ParagraphStyle("cell", parent=base, fontSize=7.8, leading=10)
    cell_b = ParagraphStyle("cellb", parent=cell, fontName=bold)

    company = ctx.get("company") or {}
    case = ctx.get("case") or {}
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"CAM - {company.get('name', '')}", author="CredX")
    width = A4[0] - 32 * mm

    def table(header: list[str], rows: list[list[Any]], col_widths: list[float] | None = None) -> Table:
        data = [[Paragraph(t(h), cell_b) for h in header]] + [[Paragraph(t(c), cell) for c in r] for r in rows]
        tbl = Table(data, colWidths=col_widths, repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef3fa")),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#dbe3ee")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        return tbl

    story: list[Any] = [
        Paragraph("CREDX · CREDIT APPRAISAL MEMORANDUM", ParagraphStyle("brand", parent=small, textColor=brand, fontName=bold)),
        Paragraph(t(company.get("name")), h1),
        Paragraph(t(f"{case.get('reference')} · {case.get('facility_type')} · Version {version} · "
                    f"{datetime.now(UTC).strftime('%d %b %Y')} · STRICTLY CONFIDENTIAL"), small),
        Spacer(1, 6),
    ]
    for s in sections:
        block: list[Any] = [Paragraph(t(s["title"]), h2)]
        c = s["content"]
        if s["kind"] == "decision":
            color = colors.HexColor(DECISION_COLORS.get(c.get("decision_code") or "", "#5b6b80"))
            pill = Table([[Paragraph(f"<b>{t(c['decision'])}</b>", ParagraphStyle('p', parent=base, textColor=colors.white, fontName=bold))]],
                         style=[("BACKGROUND", (0, 0), (-1, -1), color), ("LEFTPADDING", (0, 0), (-1, -1), 6)])
            block += [pill, Spacer(1, 4), Paragraph(t(c["narrative"]), base), Spacer(1, 4)]
            m = c["metrics"]
            grid = [[Paragraph(f"{t(x['label'])}<br/><b>{t(x['value'])}</b>", cell) for x in m[i:i + 4]] for i in range(0, len(m), 4)]
            g = Table(grid, colWidths=[width / 4] * 4)
            g.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#dbe3ee")),
                                   ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dbe3ee"))]))
            block.append(g)
        elif s["kind"] == "kv":
            block.append(table(["Field", "Detail"], [[x["label"], x["value"]] for x in c], [width * 0.3, width * 0.7]))
        elif s["kind"] == "text":
            block.append(Paragraph(t(c), base))
        elif s["kind"] == "table":
            block.append(table(c["header"], c["rows"]))
            if s.get("secondary"):
                block += [Spacer(1, 4), table(s["secondary"]["header"], s["secondary"]["rows"])]
            if s.get("note"):
                block.append(Paragraph(t(s["note"]), small))
        elif s["kind"] == "bullets":
            block.append(Paragraph(t(c.get("summary", "")), base))
            if c.get("badges"):
                block.append(Paragraph(" · ".join(f"{t(b['label'])}: <b>{t(b['value'])}</b>" for b in c["badges"]), small))
            for item in c.get("bullets") or []:
                block.append(Paragraph("• " + t(item), base))
            for grp in c.get("groups") or []:
                if grp["lines"]:
                    block.append(Paragraph(f"<b>{t(grp['title'])}</b>", base))
                    block += [Paragraph("• " + t(i), base) for i in grp["lines"]]
        elif s["kind"] == "five_cs":
            block.append(table(["C", "Score", "Assessment", "Key evidence"],
                               [[x["c"], str(x["score"]), x["assessment"], "; ".join(x["evidence"][:3])] for x in c],
                               [width * 0.14, width * 0.09, width * 0.13, width * 0.64]))
        if s.get("analyst_comment"):
            block += [Spacer(1, 3), Table([[Paragraph(f"<b>Analyst comment:</b> {t(s['analyst_comment'])}", base)]],
                                          colWidths=[width], style=[("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff7ef")),
                                                                    ("LINEBEFORE", (0, 0), (0, -1), 2, colors.HexColor("#f08a24"))])]
        story.append(KeepTogether(block) if s["kind"] in ("kv", "decision", "five_cs") else block[0])
        if s["kind"] not in ("kv", "decision", "five_cs"):
            story += block[1:]
    story += [Spacer(1, 24), table(["Prepared by (Credit Analyst)", "Reviewed by (Credit Manager)", "Sanctioning Authority"], [["", "", ""]])]

    def footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont(regular, 7)
        canvas.setFillColor(colors.HexColor("#5b6b80"))
        canvas.drawString(16 * mm, 9 * mm, f"CredX CAM · {case.get('reference', '')} · v{version}")
        canvas.drawRightString(A4[0] - 16 * mm, 9 * mm, f"Page {canvas.getPageNumber()}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()


# ---------------------------------------------------------------- DOCX
def render_docx(ctx: dict[str, Any], sections: list[dict[str, Any]], version: int) -> bytes:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt, RGBColor

    company = ctx.get("company") or {}
    case = ctx.get("case") or {}
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10)

    brand = doc.add_paragraph()
    run = brand.add_run("CREDX · CREDIT APPRAISAL MEMORANDUM")
    run.bold = True
    run.font.color.rgb = RGBColor(0x0B, 0x4F, 0x9C)
    doc.add_heading(company.get("name", "Borrower"), level=0)
    meta = doc.add_paragraph(f"{case.get('reference')} · {case.get('facility_type')} · Version {version} · "
                             f"{datetime.now(UTC).strftime('%d %b %Y')} · Strictly confidential")
    meta.alignment = WD_ALIGN_PARAGRAPH.LEFT

    def add_table(header: list[str], rows: list[list[Any]]) -> None:
        tbl = doc.add_table(rows=1, cols=len(header))
        tbl.style = "Light Grid Accent 1"
        for i, h in enumerate(header):
            tbl.rows[0].cells[i].text = str(h)
        for r in rows:
            cells = tbl.add_row().cells
            for i, v in enumerate(r[: len(header)]):
                cells[i].text = "—" if v is None else str(v)

    for s in sections:
        doc.add_heading(s["title"], level=1)
        c = s["content"]
        if s["kind"] == "decision":
            p = doc.add_paragraph()
            r = p.add_run(f"Recommendation: {c['decision']}")
            r.bold = True
            doc.add_paragraph(c["narrative"])
            add_table(["Metric", "Value"], [[m["label"], m["value"]] for m in c["metrics"]])
        elif s["kind"] == "kv":
            add_table(["Field", "Detail"], [[m["label"], m["value"]] for m in c])
        elif s["kind"] == "text":
            doc.add_paragraph(c)
        elif s["kind"] == "table":
            add_table(c["header"], c["rows"])
            if s.get("secondary"):
                doc.add_paragraph()
                add_table(s["secondary"]["header"], s["secondary"]["rows"])
            if s.get("note"):
                doc.add_paragraph(s["note"]).runs[0].italic = True
        elif s["kind"] == "bullets":
            doc.add_paragraph(c.get("summary", ""))
            for b in c.get("badges") or []:
                doc.add_paragraph(f"{b['label']}: {b['value']}", style="List Bullet")
            for item in c.get("bullets") or []:
                doc.add_paragraph(item, style="List Bullet")
            for grp in c.get("groups") or []:
                if grp["lines"]:
                    doc.add_paragraph().add_run(grp["title"]).bold = True
                    for i in grp["lines"]:
                        doc.add_paragraph(i, style="List Bullet")
        elif s["kind"] == "five_cs":
            add_table(["C", "Score", "Assessment", "Key evidence"],
                      [[x["c"], x["score"], x["assessment"], "; ".join(x["evidence"][:3])] for x in c])
        if s.get("analyst_comment"):
            p = doc.add_paragraph()
            r = p.add_run("Analyst comment: ")
            r.bold = True
            p.add_run(s["analyst_comment"])
    doc.add_paragraph()
    add_table(["Prepared by (Credit Analyst)", "Reviewed by (Credit Manager)", "Sanctioning Authority"], [["", "", ""]])
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
