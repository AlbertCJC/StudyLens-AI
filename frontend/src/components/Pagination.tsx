import React, { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}

const PAGE_SIZE = 10;

export function slicePage<T>(items: T[], page: number, pageSize: number = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export const Pagination: React.FC<PaginationProps> = ({ page, total, onPageChange }) => {
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const safePage = Math.min(page, pageCount);

  useEffect(() => {
    if (safePage < page) onPageChange(safePage);
  }, [safePage, page, onPageChange]);

  const pageNumbers = useMemo(() => {
    const numbers: number[] = [];
    const push = (p: number) => {
      if (p >= 1 && p <= pageCount && !numbers.includes(p)) numbers.push(p);
    };
    push(1);
    push(pageCount);
    for (let p = safePage - 2; p <= safePage + 2; p++) push(p);
    return numbers.sort((a, b) => a - b);
  }, [safePage, pageCount]);

  if (pageCount <= 1) return null;

  const renderGap = (idx: number) => (
    <span key={`gap-${idx}`} className="px-1 text-muted-foreground text-xs select-none">…</span>
  );

  return (
    <div className="flex flex-col items-center gap-3 pt-3 border-t border-border">
      <div className="flex items-center space-x-1 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pageNumbers.map((p, idx) => {
          if (idx > 0 && p !== pageNumbers[idx - 1] + 1) {
            return (
              <React.Fragment key={`group-${p}`}>
                {renderGap(idx)}
                <PageButton active={p === safePage} pageNum={p} onClick={() => onPageChange(p)} />
              </React.Fragment>
            );
          }
          return <PageButton key={p} active={p === safePage} pageNum={p} onClick={() => onPageChange(p)} />;
        })}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pageCount}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const PageButton: React.FC<{ active: boolean; pageNum: number; onClick: () => void }> = ({
  active,
  pageNum,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-w-[28px] h-8 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
      active ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`}
  >
    {pageNum}
  </button>
);

export default Pagination;
