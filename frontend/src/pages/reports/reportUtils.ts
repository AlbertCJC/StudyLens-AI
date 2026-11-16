import type { GeneratedReport } from "../../types";

export interface StudentOption { id: string; name: string; }
export interface QuizOption { id: string; title: string; subjectName: string; subjectId?: string; }
export interface SubjectOption { id: string; name: string; }

interface DateQueryResult {
  date: Date;
  granularity: "day" | "month" | "year";
  yearOnly?: boolean;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseDateQuery(q: string): DateQueryResult | null {
  const trimmed = q.trim();
  if (!trimmed) return null;
  if (!/^\d{4}$/.test(trimmed)) {
    const direct = new Date(trimmed);
    if (!isNaN(direct.getTime())) {
      return { date: direct, granularity: "day" };
    }
  }
  const lower = trimmed.toLowerCase();

  const m1 = lower.match(/^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\s+(\d{1,2})[,\s]+\s*(\d{4})$/);
  if (m1) {
    const month = MONTH_MAP[m1[1].slice(0, 3)];
    const day = parseInt(m1[2], 10);
    const year = parseInt(m1[4], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getMonth() === month && d.getDate() === day && d.getFullYear() === year) {
      return { date: d, granularity: "day" };
    }
  }

  const m2 = lower.match(/^(\d{1,2})\s+(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)[,\s]+\s*(\d{4})$/);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = MONTH_MAP[m2[2].slice(0, 3)];
    const year = parseInt(m2[4], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getMonth() === month && d.getDate() === day && d.getFullYear() === year) {
      return { date: d, granularity: "day" };
    }
  }

  const m3 = lower.match(/^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)[,\s]+\s*(\d{4})$/);
  if (m3) {
    const month = MONTH_MAP[m3[1].slice(0, 3)];
    const year = parseInt(m3[3], 10);
    const d = new Date(year, month, 1);
    if (!isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year) {
      return { date: d, granularity: "month" };
    }
  }

  const m7 = lower.match(/^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)$/);
  if (m7) {
    const month = MONTH_MAP[m7[1].slice(0, 3)];
    const d = new Date(2000, month, 1);
    if (!isNaN(d.getTime()) && d.getMonth() === month) {
      return { date: d, granularity: "month", yearOnly: false };
    }
  }

  const m4 = lower.match(/^(\d{4})$/);
  if (m4) {
    const year = parseInt(m4[1], 10);
    const d = new Date(year, 0, 1);
    if (!isNaN(d.getTime()) && d.getFullYear() === year) {
      return { date: d, granularity: "year" };
    }
  }

  const m5 = lower.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m5) {
    const year = parseInt(m5[1], 10);
    const month = parseInt(m5[2], 10) - 1;
    const day = parseInt(m5[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getMonth() === month && d.getDate() === day && d.getFullYear() === year) {
      return { date: d, granularity: "day" };
    }
  }

  const m6 = lower.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m6) {
    const month = parseInt(m6[1], 10) - 1;
    const day = parseInt(m6[2], 10);
    const year = parseInt(m6[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getMonth() === month && d.getDate() === day && d.getFullYear() === year) {
      return { date: d, granularity: "day" };
    }
  }

  return null;
}

export function parseReportDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
}

export function summaryRows(report: GeneratedReport): { label: string; value: string }[] {
  const s = (report.summary || {}) as Record<string, unknown>;
  const rows: { label: string; value: string }[] = [];
  if (s.studentName) rows.push({ label: "Student", value: String(s.studentName) });
  if (typeof s.quizzesTaken === "number") rows.push({ label: "Quizzes Taken", value: String(s.quizzesTaken) });
  if (typeof s.averageScore === "number") rows.push({ label: "Average Score", value: `${s.averageScore}%` });
  if (typeof s.passRate === "number") rows.push({ label: "Pass Rate", value: `${s.passRate}%` });
  if (Array.isArray(s.weakTopics)) rows.push({ label: "Weak Topics", value: (s.weakTopics as string[]).join(", ") || "None" });
  if (Array.isArray(s.strongTopics)) rows.push({ label: "Strong Topics", value: (s.strongTopics as string[]).join(", ") || "None" });
  if (typeof s.totalAttempts === "number") rows.push({ label: "Total Attempts", value: String(s.totalAttempts) });
  if (Array.isArray(s.quizzes)) rows.push({ label: "Quizzes Analyzed", value: String((s.quizzes as unknown[]).length) });
  if (typeof s.overallAverage === "number") rows.push({ label: "Overall Average", value: `${s.overallAverage}%` });
  if (Array.isArray(s.subjects)) rows.push({ label: "Subjects Covered", value: String((s.subjects as unknown[]).length) });
  if (typeof s.totalGenerated === "number") rows.push({ label: "Total AI Generated", value: String(s.totalGenerated) });
  if (typeof s.quizCount === "number") rows.push({ label: "Quizzes (Total)", value: String(s.quizCount) });
  if (typeof s.generationEvents === "number") rows.push({ label: "AI Generation Events", value: String(s.generationEvents) });
  if (s.breakdown && typeof s.breakdown === "object") {
    const b = s.breakdown as Record<string, unknown>;
    rows.push({ label: "By Type", value: Object.entries(b).map(([k, v]) => `${k}: ${v}`).join(" | ") });
  }
  return rows;
}

function csvFromRows(report: GeneratedReport): string {
  const rows = summaryRows(report);
  return rows.map((r) => `"${r.label.replace(/"/g, '""')}","${r.value.replace(/"/g, '""')}"`).join("\n");
}

export function exportReportCSV(report: GeneratedReport): void {
  const content = `Report,${report.reportType}\nTitle,${report.title}\nGenerated,${report.generatedAt}\n\n` + csvFromRows(report);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.title.replace(/[^a-z0-9]+/gi, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function filterReports(reports: GeneratedReport[], searchTerm: string, typeFilter: string): GeneratedReport[] {
  return reports.filter((r) => {
    if (typeFilter !== "all" && r.reportType !== typeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.trim().toLowerCase();
      const parsedQuery = parseDateQuery(q);
      const reportDate = parseReportDate(r.generatedAt);

      const matchesTitleType =
        r.title.toLowerCase().includes(q) ||
        r.reportType.toLowerCase().includes(q);

      if (parsedQuery && reportDate) {
        const qYear = parsedQuery.date.getFullYear();
        const qMonth = parsedQuery.date.getMonth();
        const qDay = parsedQuery.date.getDate();
        const rYear = reportDate.getFullYear();
        const rMonth = reportDate.getMonth();
        const rDay = reportDate.getDate();

        let matches = false;
        if (parsedQuery.granularity === "day") {
          matches = qYear === rYear && qMonth === rMonth && qDay === rDay;
        } else if (parsedQuery.granularity === "month") {
          matches = qMonth === rMonth && (parsedQuery.yearOnly === false ? true : qYear === rYear);
        } else if (parsedQuery.granularity === "year") {
          matches = qYear === rYear;
        }
        if (!matches && !matchesTitleType) return false;
      } else {
        const matchesDate = r.generatedAt.toLowerCase().includes(q);
        if (!matchesTitleType && !matchesDate) return false;
      }
    }
    return true;
  });
}
