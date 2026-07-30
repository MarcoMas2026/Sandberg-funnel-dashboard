"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/social/csv";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  csvValue: (row: T) => string | number;
  sortValue?: (row: T) => number;
}

// Shared table shell for Posts/Reels/Stories: free-text search over a caller-supplied
// field, click-to-sort on any numeric column, page-size selector, and one-click CSV
// export of exactly what's currently loaded (not just the visible page).
export function DataTable<T>({
  rows,
  columns,
  searchPlaceholder = "Search",
  getSearchText,
  csvFilename,
  rowKey,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  searchPlaceholder?: string;
  getSearchText?: (row: T) => string;
  csvFilename: string;
  rowKey: (row: T) => string;
}) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim() || !getSearchText) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => getSearchText(r).toLowerCase().includes(q));
  }, [rows, query, getSearchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => (col.sortValue!(a) - col.sortValue!(b)) * sort.dir);
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  };

  const exportCsv = () => {
    downloadCsv(
      csvFilename,
      columns.map((c) => c.label),
      sorted.map((row) => columns.map((c) => c.csvValue(row)))
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {getSearchText && (
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="flex-1 min-w-[160px] rounded-lg border border-[var(--panel2)] bg-transparent px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-muted)]"
          />
        )}
        <button
          onClick={exportCsv}
          className="rounded-lg border border-[var(--panel2)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Download CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-xs text-[var(--text-muted)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`pb-2 pr-4 font-medium ${col.sortValue ? "cursor-pointer select-none hover:text-[var(--text)]" : ""}`}
                  onClick={() => col.sortValue && toggleSort(col.key)}
                >
                  {col.label}
                  {sort?.key === col.key && (sort.dir === 1 ? " ▲" : " ▼")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-[var(--panel2)]">
                {columns.map((col) => (
                  <td key={col.key} className="py-2 pr-4 text-[var(--text)]">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-xs text-[var(--text-faint)]">
                  No results
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          Items per page:
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="rounded-md border border-[var(--panel2)] bg-transparent px-1.5 py-1 text-xs text-[var(--text)]"
          >
            {[5, 10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span>
            {sorted.length === 0 ? 0 : clampedPage * pageSize + 1}-{Math.min(sorted.length, (clampedPage + 1) * pageSize)} of{" "}
            {sorted.length}
          </span>
          <div className="flex gap-1">
            <button
              disabled={clampedPage === 0}
              onClick={() => setPage(0)}
              className="rounded-full px-2 py-1 disabled:opacity-30"
            >
              ⏮
            </button>
            <button
              disabled={clampedPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-full px-2 py-1 disabled:opacity-30"
            >
              ‹
            </button>
            <button
              disabled={clampedPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-full px-2 py-1 disabled:opacity-30"
            >
              ›
            </button>
            <button
              disabled={clampedPage >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
              className="rounded-full px-2 py-1 disabled:opacity-30"
            >
              ⏭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
