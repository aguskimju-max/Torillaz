import React from "react";
import { Search, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DataTable({
  columns, rows, loading, total = 0, page = 1, limit = 20, onPageChange,
  search, onSearch, searchPlaceholder = "Cari...", onRowClick, emptyText = "Belum ada data",
  toolbar, testId = "data-table",
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        {onSearch && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              data-testid={`${testId}-search`}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 bg-white"
            />
          </div>
        )}
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      <div className="w-full overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full border-collapse" data-testid={testId}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "text-slate-500 text-xs uppercase tracking-wider font-semibold py-3 px-4 text-left whitespace-nowrap",
                    c.align === "right" && "text-right"
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {columns.map((c) => (
                    <td key={c.key} className="py-3 px-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-slate-400">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  {emptyText}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, ri) => (
                <tr
                  key={row.id || ri}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  data-testid={`${testId}-row-${ri}`}
                  className={cn(
                    "border-b border-slate-100 hover:bg-slate-50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn("py-3 px-4 text-sm text-slate-700 align-middle whitespace-nowrap", c.align === "right" && "text-right")}
                    >
                      {c.render ? c.render(row) : row[c.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span data-testid={`${testId}-total`}>{total} data</span>
        {onPageChange && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm" data-testid={`${testId}-prev`}
              disabled={page <= 1} onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">Hal {page} / {totalPages}</span>
            <Button
              variant="outline" size="sm" data-testid={`${testId}-next`}
              disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
