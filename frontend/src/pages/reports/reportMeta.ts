import type React from "react";
import { BarChart2, GraduationCap, Sparkles, Users } from "lucide-react";

export const REPORT_TYPES = ["Student Performance", "Quiz Analytics", "Subject Summary", "AI Usage"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_ICONS: Record<ReportType, React.ElementType> = {
  "Student Performance": Users,
  "Quiz Analytics": BarChart2,
  "Subject Summary": GraduationCap,
  "AI Usage": Sparkles,
};
