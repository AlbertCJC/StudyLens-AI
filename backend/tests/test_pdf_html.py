"""PDF markdown→HTML conversion safety (P1-05)."""

from controllers.ai_controller import _md_to_pdf_html


def test_bold_italic_underline_preserved():
    assert _md_to_pdf_html("**bold**") == "<b>bold</b>"
    assert _md_to_pdf_html("*italic*") == "<i>italic</i>"
    assert _md_to_pdf_html("__bold__") == "<b>bold</b>"
    assert _md_to_pdf_html("_italic_") == "<i>italic</i>"
    assert _md_to_pdf_html("<u>underline</u>") == "<u>underline</u>"


def test_line_breaks_preserved():
    assert _md_to_pdf_html("a<br/>b") == "a<br/>b"
    assert _md_to_pdf_html("a<br>b") == "a<br/>b"


def test_dangerous_tags_stripped():
    # Script / iframe / anchor injection must not survive into the PDF.
    assert _md_to_pdf_html('<script>alert(1)</script>') == "alert(1)"
    assert _md_to_pdf_html('<iframe src="x"></iframe>') == ""
    assert _md_to_pdf_html('<a href="javascript:evil()">click</a>') == "click"
    assert _md_to_pdf_html('<div>text</div>') == "text"
    assert _md_to_pdf_html('<span style="color:red">x</span>') == "x"
    assert _md_to_pdf_html("<body>oops</body>") == "oops"
    # Attributes on safe tags are dropped.
    assert _md_to_pdf_html('<b class="x">b</b>') == "<b>b</b>"
    assert _md_to_pdf_html("<B>upper</B>") == "<b>upper</b>"


def test_mixed_content_strips_only_tags():
    out = _md_to_pdf_html("Say **hi** <script>bad</script> now")
    assert out == "Say <b>hi</b> bad now"
    assert "<script" not in out
    assert "</script" not in out
    assert "bad" in out  # text content survives; only the tag is stripped


def test_literal_angle_brackets_escaped():
    assert "&lt;" in _md_to_pdf_html("price < 5")
    assert "&gt;" in _md_to_pdf_html("5 > 2")
    assert "&amp;" in _md_to_pdf_html("Tom & Jerry")


def test_empty_and_none():
    assert _md_to_pdf_html("") == ""
    assert _md_to_pdf_html(None) == ""
