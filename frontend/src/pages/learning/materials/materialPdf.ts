import { jsPDF } from "jspdf";
import type { LearningMaterial } from "../../../types";
import { authFetch } from "../../../utils/authFetch";

const loadPdfFonts = async (): Promise<null> => null;

type PdfSegment = { text: string; bold: boolean };

const buildBoldSegments = (text: string): PdfSegment[] => {
  const segments: PdfSegment[] = [];
  for (const rawLine of text.split("\n")) {
    let m: RegExpMatchArray | null;

    if (/^Topic:/.test(rawLine)) {
      segments.push({ text: rawLine, bold: true });
    } else if ((m = rawLine.match(/^(Card \d+: Q:)(.*)$/))) {
      segments.push({ text: m[1], bold: true });
      if (m[2]) segments.push({ text: m[2], bold: false });
    } else if ((m = rawLine.match(/^( {2}A:)(.*)$/))) {
      segments.push({ text: m[1], bold: true });
      if (m[2]) segments.push({ text: m[2], bold: false });
    } else if ((m = rawLine.match(/^(Q\d+:)(.*)$/))) {
      segments.push({ text: m[1], bold: true });
      if (m[2]) segments.push({ text: m[2], bold: false });
    } else if ((m = rawLine.match(/^( {2}Correct Answer:)(.*)$/))) {
      segments.push({ text: m[1], bold: true });
      if (m[2]) segments.push({ text: m[2], bold: false });
    } else if ((m = rawLine.match(/^( {2}Key Takeaway:)(.*)$/))) {
      if (m[1]) segments.push({ text: m[1], bold: false });
      segments.push({ text: m[2], bold: true });
      if (m[3]) segments.push({ text: m[3], bold: false });
    } else {
      segments.push({ text: rawLine, bold: false });
    }
  }
  return segments;
};

export async function downloadMaterialPdf(mat: LearningMaterial): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxLineWidth = pageWidth - margin * 2;

  const fonts = await loadPdfFonts();
  if (fonts) {
    doc.addFileToVFS("ArialEmbed.ttf", fonts.regular);
    doc.addFileToVFS("ArialEmbed-Bold.ttf", fonts.bold);
    doc.addFont("ArialEmbed.ttf", "ArialEmbed", "normal");
    doc.addFont("ArialEmbed-Bold.ttf", "ArialEmbed", "bold");
  }
  const baseFont = fonts ? "ArialEmbed" : "helvetica";
  doc.setLineHeightFactor(1.5);
  const mmPerPt = 25.4 / 72;

  doc.setTextColor(30, 41, 59);
  doc.setFont(baseFont, "bold");
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(mat.title, maxLineWidth);
  const titleLineHeight = doc.getFontSize() * 1.5 * mmPerPt;
  let cursorY = 16;
  for (const line of titleLines) {
    doc.text(line, margin, cursorY);
    cursorY += titleLineHeight;
  }

  const sepY = 16 + titleLines.length * titleLineHeight + 4;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, sepY, pageWidth - margin, sepY);

  doc.setFont(baseFont, "normal");
  doc.setFontSize(10);
  const cleanText = (mat.extractedText || "No content available.")
    .replace(/[\u00a0\u2007\u2009\u202f\u200b\ufeff]/g, " ")
    .split("")
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c === 11 || c === 12 || c === 13) return "\n";
      if ((c < 32 && c !== 9 && c !== 10) || (c >= 127 && c <= 159)) return "";
      return ch;
    })
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const bodySegments = buildBoldSegments(cleanText);

  const displayLines: PdfSegment[][] = [];
  let cur: PdfSegment[] = [];
  let curWidth = 0;
  const flushLine = () => {
    displayLines.push(cur);
    cur = [];
    curWidth = 0;
  };
  for (const seg of bodySegments) {
    if (seg.text === "") {
      if (cur.length > 0) flushLine();
      displayLines.push([]);
      continue;
    }
    doc.setFont(baseFont, seg.bold ? "bold" : "normal");
    const tokens = seg.text.split(/(\s+)/).filter((t) => t !== "");
    let firstInLine = true;
    for (let token of tokens) {
      if (cur.length === 0 && /^\s+$/.test(token) && !firstInLine) continue;
      firstInLine = false;
      while (doc.getTextWidth(token) > maxLineWidth && token.length > 1) {
        let lo = 1;
        let hi = token.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (doc.getTextWidth(token.slice(0, mid)) <= maxLineWidth) lo = mid;
          else hi = mid - 1;
        }
        if (cur.length > 0) flushLine();
        cur.push({ text: token.slice(0, lo), bold: seg.bold });
        flushLine();
        token = token.slice(lo);
      }
      if (token === "") continue;
      const tokenWidth = doc.getTextWidth(token);
      if (curWidth + tokenWidth > maxLineWidth && cur.length > 0) flushLine();
      cur.push({ text: token, bold: seg.bold });
      curWidth += tokenWidth;
    }
    if (cur.length > 0) flushLine();
  }

  const lineHeight = doc.getFontSize() * 1.5 * mmPerPt;
  cursorY = sepY + lineHeight + 3;

  for (const line of displayLines) {
    if (cursorY + lineHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = 20;
    }
    if (line.length > 0) {
      let x = margin;
      for (const s of line) {
        doc.setFont(baseFont, s.bold ? "bold" : "normal");
        doc.text(s.text, x, cursorY);
        x += doc.getTextWidth(s.text);
      }
    }
    cursorY += lineHeight;
  }

  const filename = `${mat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_notes.pdf`;
  doc.save(filename);
}

export async function downloadMaterialAsPdf(mat: LearningMaterial, showToast: (message: string, type?: "info" | "error") => void): Promise<void> {
  try {
    const res = await authFetch(`/api/materials/${encodeURIComponent(mat.id)}/convert-to-pdf`);
    if (!res.ok) throw new Error(`Server returned status ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "material"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  } catch {
    showToast("Real PDF conversion unavailable; generating a notes PDF instead.", "info");
    await downloadMaterialPdf(mat);
  }
}

export async function downloadMaterial(mat: LearningMaterial): Promise<void> {
  const ext = (mat.fileType || "").toLowerCase().replace(/^\./, "");
  if (mat.fileUrl) {
    try {
      const res = await authFetch(`/api/materials/${encodeURIComponent(mat.id)}/download`);
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "material"}.${ext || "bin"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    } catch {
      // Fall through to generated PDF below.
    }
  }
  await downloadMaterialPdf(mat);
}
