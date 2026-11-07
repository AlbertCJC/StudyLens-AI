"""Quiz PDF rendering (question sheet + answer key)."""

def _build_quiz_pdf(title, subject_name, questions):
    """Builds a formatted quiz PDF (question sheet + answer key) and returns a BytesIO buffer.

    Shared by the AI assistant export endpoint and the quiz download endpoint so
    both produce identical assessment papers. Returns None if ReportLab is missing.
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, HRFlowable, Spacer, PageBreak, Table, TableStyle,
        )
    except Exception:
        return None

    def sanitize(text):
        """Reduces text to ASCII so the standard PDF fonts never render missing-glyph squares."""
        s = str(text or "")
        replacements = {
            # Quotes
            "\u201c": '"', "\u201d": '"', "\u2018": "'", "\u2019": "'",
            "\u00ab": '"', "\u00bb": '"', "\u201a": "'", "\u201b": "'",
            "\u201e": '"',
            # Dashes
            "\u2013": "-", "\u2014": "-", "\u2010": "-", "\u2011": "-",
            "\u2012": "-", "\u2015": "-", "\u2212": "-", "\u00ad": "-",
            # Bullets and dots
            "\u2022": "-", "\u00b7": "-", "\u2023": "-", "\u2024": ".",
            "\u2025": "..", "\u2026": "...",
            # Spaces
            "\u00a0": " ", "\u2000": " ", "\u2001": " ", "\u2002": " ",
            "\u2003": " ", "\u2004": " ", "\u2005": " ", "\u2006": " ",
            "\u2007": " ", "\u2008": " ", "\u2009": " ", "\u200a": " ",
            "\u2028": " ", "\u2029": " ", "\u200b": "", "\ufeff": "",
            # Other common symbols
            "\u00a9": "(c)", "\u00ae": "(r)", "\u2122": "(tm)",
            "\u00a2": "(c)", "\u00a3": "(pound)", "\u00a5": "(yen)",
            "\u00a4": "(cur)", "\u00a6": "|", "\u00a7": "(s)",
            "\u00a8": '"', "\u00aa": "a", "\u00ba": "o",
            "\u00d7": "x", "\u00f7": "/",
        }
        for k, v in replacements.items():
            s = s.replace(k, v)
        return "".join(ch for ch in s if ch in "\t\n\r" or 32 <= ord(ch) <= 126)

    _SPELL_MAP = {
        # Quiz types (only genuinely misspelled forms)
        "identication": "identification", "identifications": "identification",
        "identifcation": "identification", "identifcations": "identification",
        "true/fasle": "true/false", "truefalse": "true/false", "t/f": "true/false",
        "multichoice": "multiple choice", "mcq": "multiple choice",
        "shortanswer": "identification", "short answer": "identification",
        # Common misspellings
        "recieve": "receive", "seperate": "separate", "definately": "definitely",
        "occured": "occurred", "untill": "until", "arguement": "argument",
        "embarass": "embarrass", "liason": "liaison", "occurence": "occurrence",
        "posession": "possession", "recomend": "recommend", "referance": "reference",
        "begining": "beginning", "calender": "calendar", "cemetary": "cemetery",
        "colleague": "colleague", "conscience": "conscience",
        "dilemma": "dilemma", "embarrass": "embarrass", "exceed": "exceed",
        "exercise": "exercise", "experience": "experience", "foreign": "foreign",
        "gauge": "gauge", "grateful": "grateful", "harass": "harass",
        "indispensable": "indispensable", "knowledge": "knowledge",
        "maintenance": "maintenance", "millennium": "millennium",
        "necessary": "necessary", "occasion": "occasion", "occurred": "occurred",
        "parallel": "parallel", "precede": "precede", "principal": "principal",
        "privilege": "privilege", "receive": "receive", "recommend": "recommend",
        "referred": "referred", "relevant": "relevant", "separate": "separate",
        "sergeant": "sergeant", "supersede": "supersede", "threshold": "threshold",
        "twelfth": "twelfth", "until": "until", "weird": "weird",
    }

    def correct_spelling(text):
        """Auto-correct misspelled words in user input text."""
        if not isinstance(text, str) or not text:
            return text
        result = text
        lower = text.lower()
        for wrong, correct in _SPELL_MAP.items():
            if wrong in lower:
                result = result.replace(wrong, correct).replace(wrong.title(), correct.title()).replace(wrong.upper(), correct.upper())
        return result

    title = sanitize(title)
    subject_name = sanitize(subject_name)
    if not isinstance(questions, list):
        questions = []

    styles = getSampleStyleSheet()
    section = ParagraphStyle("StudySection", parent=styles["Heading2"], fontSize=13, leading=17, spaceBefore=10, spaceAfter=6, textColor="#1d4ed8")
    quiz_title = ParagraphStyle("QuizTitle", parent=styles["Title"], fontSize=17, leading=21, textColor="#1e293b", spaceAfter=2, alignment=TA_CENTER)
    quiz_subtitle = ParagraphStyle("QuizSubtitle", parent=styles["Normal"], fontSize=9.5, leading=13, textColor="#64748b", alignment=TA_CENTER, spaceAfter=8)
    quiz_instructions = ParagraphStyle("QuizInstructions", parent=styles["Normal"], fontSize=11, leading=14, textColor="#000000", spaceAfter=6)
    quiz_question = ParagraphStyle("QuizQuestion", parent=styles["Normal"], fontSize=10.5, leading=14, textColor="#000000", spaceBefore=6, spaceAfter=2, leftIndent=22)
    quiz_option = ParagraphStyle("QuizOption", parent=styles["Normal"], fontSize=10, leading=13, textColor="#000000", leftIndent=40, spaceAfter=1)

    def esc(text):
        return sanitize(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=0.8 * inch,
        leftMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title=title,
        author="StudyLens AI",
    )

    def quiz_page_decorator(canvas, doc_):
        """Draw a footer with page numbers on every quiz page."""
        canvas.saveState()
        w, h = letter
        canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
        canvas.setLineWidth(0.5)
        canvas.line(50, 40, w - 50, 40)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.setFont("Helvetica", 8)
        canvas.drawString(50, 30, "StudyLens AI - Assessment Paper")
        canvas.drawRightString(w - 50, 30, f"Page {canvas.getPageNumber()}")
        canvas.restoreState()

    story = []
    story.append(Paragraph(esc(title), quiz_title))
    if subject_name:
        story.append(Paragraph(f"Subject: {subject_name}", quiz_subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color="#d1d5db", spaceBefore=8, spaceAfter=10))

    story.append(Paragraph(
        "Instructions: Read each question carefully before answering. ",
        quiz_instructions,
    ))
    story.append(Spacer(1, 6))

    prev_q_type = None
    for idx, q in enumerate(questions, start=1):
        if not isinstance(q, dict):
            continue
        # Auto-correct misspelled question types
        q_type = q.get("type", "")
        if isinstance(q_type, str):
            q_type = correct_spelling(q_type)
            q["type"] = q_type
        # Section header for True/False questions
        if q_type == "true_false" and prev_q_type != "true_false":
            story.append(Paragraph("<b>TRUE / FALSE</b> - Write T/F or True/False on the blank line before each question number.", quiz_instructions))
            story.append(Spacer(1, 4))
        # Section header for Identification questions
        if q_type == "identification" and prev_q_type != "identification":
            story.append(Paragraph("<b>IDENTIFICATION</b> - Fill in the blank with the correct answer before each question number.", quiz_instructions))
            story.append(Spacer(1, 4))
        # Section header for Multiple Choice questions
        if q_type == "multiple_choice" and prev_q_type != "multiple_choice":
            story.append(Paragraph("<b>MULTIPLE CHOICE</b> - Select the best answer from the options below.", quiz_instructions))
            story.append(Spacer(1, 4))
        prev_q_type = q_type
        # Blank answer line beside and before the question number for student to write answer
        story.append(Paragraph(f"_______ {idx}. {esc(q.get('question') or '')}", quiz_question))
        options = q.get("options") or []
        is_true_false = (
            q_type == "true_false"
            or (isinstance(options, list) and len(options) == 2
                and str(options[0]).strip().lower() == "true"
                and str(options[1]).strip().lower() == "false")
        )
        if isinstance(options, list) and options and not is_true_false:
            for oi, opt in enumerate(options):
                opt_letter = chr(65 + oi)
                story.append(Paragraph(f"{opt_letter}) {esc(opt)}", quiz_option))
        story.append(Spacer(1, 4))

    # Answer Key section on a new page
    story.append(PageBreak())
    story.append(Paragraph("Answer Key", section))
    key_items = []
    for idx, q in enumerate(questions, start=1):
        if not isinstance(q, dict):
            continue
        options = q.get("options") or []
        correct_idx = q.get("correctAnswer")
        q_type = q.get("type", "")
        if isinstance(q_type, str):
            q_type = correct_spelling(q_type)
        is_true_false = (
            q_type == "true_false"
            or (isinstance(options, list) and len(options) == 2
                and str(options[0]).strip().lower() == "true"
                and str(options[1]).strip().lower() == "false")
        )
        if is_true_false and isinstance(correct_idx, (int, str)):
            # True/False: show True or False instead of letter
            if isinstance(correct_idx, int) and 0 <= correct_idx < len(options):
                ans_text = options[correct_idx]
            elif isinstance(correct_idx, str) and correct_idx.strip().lower() in ("true", "false"):
                ans_text = correct_idx.strip().title()
            elif isinstance(correct_idx, str) and correct_idx.strip().lower() == "t":
                ans_text = "True"
            elif isinstance(correct_idx, str) and correct_idx.strip().lower() == "f":
                ans_text = "False"
            else:
                ans_text = "?"
            key_items.append(f"{idx}. {ans_text}")
        elif isinstance(options, list) and options and isinstance(correct_idx, int) and 0 <= correct_idx < len(options):
            ans_letter = chr(65 + correct_idx)
            key_items.append(f"{idx}. {ans_letter}")
        elif isinstance(options, list) and options and str(correct_idx).isdigit():
            ans_letter = chr(65 + int(correct_idx))
            key_items.append(f"{idx}. {ans_letter}")
        elif isinstance(correct_idx, str) and correct_idx:
            key_items.append(f"{idx}. {correct_idx}")
        else:
            key_items.append(f"{idx}. ?")
    col_w = (612 - 2 * 57.6) / 2
    half = (len(key_items) + 1) // 2
    col1 = key_items[:half]
    col2 = key_items[half:]
    max_rows = max(len(col1), len(col2))
    key_rows = []
    for i in range(max_rows):
        left = col1[i] if i < len(col1) else ""
        right = col2[i] if i < len(col2) else ""
        key_rows.append([left, right])
    key_table = Table(key_rows, colWidths=[col_w, col_w])
    key_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 22),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(key_table)

    doc.build(story, onFirstPage=quiz_page_decorator, onLaterPages=quiz_page_decorator)
    buf.seek(0)
    return buf
