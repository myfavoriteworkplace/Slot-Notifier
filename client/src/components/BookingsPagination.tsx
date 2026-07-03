import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BookingsPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

export function BookingsPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  isLoading,
}: BookingsPaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = buildPageList(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/50">
      <div className="flex items-center gap-2 text-xs text-muted-foreground order-2 sm:order-1">
        <span className="tabular-nums">
          {isLoading ? "Loading…" : `Showing ${from}–${to} of ${total}`}
        </span>
        <div className="w-px h-4 bg-border/60" />
        <span className="shrink-0">Per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => { onPageSizeChange(Number(v)); onPageChange(1); }}>
          <SelectTrigger
            className="h-7 w-[60px] text-xs rounded-lg border-border/60"
            data-testid="select-page-size"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
          data-testid="pagination-prev"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-muted-foreground/60">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(Number(p))}
              disabled={isLoading}
              className={`h-8 min-w-[32px] px-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-[0.97] disabled:cursor-not-allowed ${
                p === page
                  ? "bg-primary text-white border-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
              }`}
              data-testid={`pagination-page-${p}`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
          data-testid="pagination-next"
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [];
  pages.push(1);
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
