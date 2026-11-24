import { ChevronDown, Download, FileText, Filter, Loader2, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import type { GeneratedReport } from "../../types";
import { REPORT_ICONS, REPORT_TYPES, type ReportType } from "./reportMeta";
import { summaryRows } from "./reportUtils";

interface ReportsListProps {
  reports: GeneratedReport[];
  filteredReports: GeneratedReport[];
  reportsTotal: number;
  loading: boolean;
  refreshing: boolean;
  reportsPage: number;
  pageSize: number;
  searchTerm: string;
  typeFilter: string;
  hasFilters: boolean;
  onRefresh: () => void;
  onSearchTermChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onGenerateType: (type: ReportType) => void;
  onView: (report: GeneratedReport) => void;
  onEdit: (report: GeneratedReport) => void;
  onExport: (report: GeneratedReport) => void;
  onDelete: (report: GeneratedReport) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function ReportsList({
  reports,
  filteredReports,
  reportsTotal,
  loading,
  refreshing,
  reportsPage,
  pageSize,
  searchTerm,
  typeFilter,
  hasFilters,
  onRefresh,
  onSearchTermChange,
  onTypeFilterChange,
  onClearFilters,
  onGenerateType,
  onView,
  onEdit,
  onExport,
  onDelete,
  onPrevPage,
  onNextPage,
}: ReportsListProps) {
  return (
    <>
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer">
                <FileText className="w-3.5 h-3.5" />
                <span>Generate Report</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Choose a report type</DropdownMenuLabel>
              {REPORT_TYPES.map((type) => {
                const Icon = REPORT_ICONS[type];
                return (
                  <DropdownMenuItem key={type} onClick={() => onGenerateType(type)} className="gap-2.5">
                    <Icon className="w-4 h-4 text-primary" />
                    <span>{type}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
            <div className="flex flex-col items-start gap-4 lg:flex lg:flex-row lg:items-center gap-4">
              <p className="flex-1 text-center text-xs text-muted-foreground">
                Showing {filteredReports.length} of {reportsTotal} reports
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onRefresh}
                  title="Reload the report list from the server"
                  className="p-1.5 bg-muted/50 hover:bg-muted text-foreground rounded-lg transition-all border border-border cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                </button>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                placeholder="Search reports..."
                className="pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-44"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              className="p-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none"
            >
              <option value="all">All types</option>
              {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {hasFilters && (
              <button
                onClick={onClearFilters}
                className="px-2.5 py-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 rounded-xl text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
              >
                <Filter className="w-3 h-3" /> Clear
              </button>
            )}
              </div>
            </div>
          </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading reports...
          </div>
        ) : filteredReports.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-10">
            {reports.length === 0
              ? "No reports generated yet. Use the Generate Report button above to create one."
              : "No reports match the current filters."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const preview = summaryRows(report).slice(0, 2).map((r) => `${r.label}: ${r.value}`).join(" • ");
              return (
                <div
                  key={report.id}
                  onClick={() => onView(report)}
                  className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-all"
                  title="View Report"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-foreground truncate">{report.title}</h4>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground font-mono">{report.generatedAt}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(report); }}
                        className="p-1.5 text-muted-foreground hover:text-emerald-600 rounded-lg cursor-pointer"
                        title="Edit Report"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onExport(report); }}
                        className="p-1.5 text-muted-foreground hover:text-primary rounded-lg cursor-pointer"
                        title="Export CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(report); }}
                        className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        title="Delete Report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {preview && <p className="text-[11px] text-muted-foreground truncate">{preview}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reportsTotal > 0 && (
        <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 border border-border rounded-xl">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Page {reportsPage}</span>
            <span>of {Math.ceil(reportsTotal / pageSize)}</span>
            <span>({reportsTotal} total)</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevPage}
              disabled={reportsPage === 1 || loading}
              className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted/50 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={onNextPage}
              disabled={!(reportsPage * pageSize < reportsTotal) || loading}
              className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted/50 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
