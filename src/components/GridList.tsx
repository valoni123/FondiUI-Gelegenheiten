import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Loader2 } from "lucide-react";
import { Item } from "@/types";
import { cn } from "@/lib/utils";
import { CloudEnvironment } from "@/authorization/configLoader";

interface GridListProps {
  items: Item[];
  onUpdateItem: (id: string, field: string, value: string | number | boolean) => void;
  onViewDetails: (item: Item) => void;
  opportunityStatusOptions: string[];
  authToken: string;
  companyNumber: string;
  cloudEnvironment: CloudEnvironment;
  selectedOpportunityId: string | null;
  onSelectOpportunity: (opportunityId: string | null) => void;
  isLoading?: boolean;
  filters: Record<string, string>;
  onCommitFilters: (filters: Record<string, string>) => void;
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  onSortChange: (sort: { key: string; direction: "asc" | "desc" } | null) => void;
  totalCount?: number | null;
}

const GridList: React.FC<GridListProps> = ({
  items,
  selectedOpportunityId,
  onSelectOpportunity,
  isLoading,
  filters,
  onCommitFilters,
  sortConfig,
  onSortChange,
  totalCount,
}) => {
  // Draft filters: user can type; we only send to LN on blur/Enter.
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>(filters);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const normalizeFilters = (f: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) {
      const trimmed = (v ?? "").trim();
      if (trimmed) out[k] = trimmed;
    }
    return out;
  };

  const isSameFilters = (a: Record<string, string>, b: Record<string, string>) => {
    const na = normalizeFilters(a);
    const nb = normalizeFilters(b);
    const aKeys = Object.keys(na);
    const bKeys = Object.keys(nb);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      if (na[k] !== nb[k]) return false;
    }
    return true;
  };

  const commitFilters = () => {
    if (isSameFilters(draftFilters, filters)) return;
    onCommitFilters(draftFilters);
  };

  // Define the specific keys to be displayed in the grid
  const visibleKeys = useMemo(
    () => [
      "id",
      "Project",
      "Artikel",
      "Customer",
      "description",
      "PartNoOriginalRequest",
      "DrawingNoOriginalRequest",
    ],
    []
  );

  const getColumnLabel = (key: string) => {
    if (key === "id") return "Gelegenheit";
    if (key === "Project") return "Projekt";
    if (key === "description") return "Bezeichnung";
    if (key === "Customer") return "Kunde";
    if (key === "PartNoOriginalRequest") return "Sachnummer";
    if (key === "DrawingNoOriginalRequest") return "Zeichnungsnummer";
    return key.replace(/([A-Z])/g, " $1").trim();
  };

  const handleSort = (key: string) => {
    // Cycle: none -> asc -> desc -> none
    if (!sortConfig || sortConfig.key !== key) {
      onSortChange({ key, direction: "asc" });
      return;
    }

    if (sortConfig.direction === "asc") {
      onSortChange({ key, direction: "desc" });
      return;
    }

    onSortChange(null);
  };

  // Styling aligned with DocAttributesGrid (document list) using a CSS grid instead of <table>
  const headerCellClass =
    "px-1 py-1 text-xs font-medium text-muted-foreground border-r border-b border-border bg-gray-100 dark:bg-gray-800 flex items-center min-h-8";
  const filterCellClass =
    "px-1 py-1 border-r border-b border-border bg-background flex items-center min-h-8";
  const gridCellClass =
    "px-1 py-1 min-w-0 border-r border-b border-border bg-background flex items-center min-h-8";
  const iconCellClass =
    "px-0 py-1 border-r border-b border-border bg-background flex items-center justify-center min-h-8";

  const columns = useMemo(() => {
    const specs = visibleKeys.map((key) => {
      const widthPx =
        key === "id"
          ? 120
          : key === "Project"
            ? 120
            : key === "description"
              ? 180
              : key === "Artikel"
                ? 140
                : key === "Customer"
                  ? 160
                  : key === "PartNoOriginalRequest"
                    ? 160
                    : key === "DrawingNoOriginalRequest"
                      ? 160
                      : 60;
      return { key, widthPx };
    });

    return [{ key: "__open__", widthPx: 30 }, ...specs];
  }, [visibleKeys]);

  const gridTemplateColumns = useMemo(
    () => columns.map((c) => `${c.widthPx}px`).join(" "),
    [columns]
  );

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <div className="flex-1 min-h-0 w-full overflow-x-auto">
        <div className="w-full h-full min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto w-full">
            <div
              className="grid w-max min-w-full border-l border-t border-border"
              style={{ gridTemplateColumns: gridTemplateColumns }}
            >
              {/* Header */}
              <div className={cn(headerCellClass, "sticky top-0 z-30")} />
              {visibleKeys.map((key) => (
                <div
                  key={`h-${key}`}
                  className={cn(headerCellClass, "min-w-0 sticky top-0 z-30")}
                >
                  <button
                    type="button"
                    onClick={() => handleSort(key)}
                    className="flex w-full items-center justify-start gap-1 truncate p-0 text-left text-xs font-bold leading-none text-foreground"
                  >
                    <span className="truncate">{getColumnLabel(key)}</span>
                    {sortConfig?.key === key ? (
                      sortConfig.direction === "asc" ? (
                        <ArrowUp className="h-3 w-3 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3 w-3 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                    )}
                  </button>
                </div>
              ))}

              {/* Filters */}
              <div className={cn(filterCellClass, "sticky top-8 z-20")} />
              {visibleKeys.map((key) => (
                <div
                  key={`f-${key}`}
                  className={cn(filterCellClass, "min-w-0 sticky top-8 z-20")}
                >
                  <Input
                    value={draftFilters[key] || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDraftFilters((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    onBlur={commitFilters}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitFilters();
                      }
                    }}
                    className="h-6 w-full min-w-0 text-xs px-1 rounded-none"
                  />
                </div>
              ))}

              {/* Rows */}
              {isLoading ? (
                <div className="col-span-full flex h-40 items-center justify-center text-sm text-muted-foreground border-b border-border">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gelegenheiten werden geladen…
                </div>
              ) : items.length === 0 ? (
                <div className="col-span-full flex h-40 items-center justify-center text-sm text-muted-foreground border-b border-border">
                  Keine Einträge gefunden.
                </div>
              ) : (
                items.map((item) => {
                  const isSelected = selectedOpportunityId === item.id;
                  const rowClass = isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-muted";

                  return (
                    <React.Fragment key={item.id}>
                      <div
                        className={cn(iconCellClass, rowClass, "cursor-pointer")}
                        onClick={() => onSelectOpportunity(item.id)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onSelectOpportunity(item.id)}
                          title="Zur Detailansicht"
                          aria-label="Zur Detailansicht"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>

                      {visibleKeys.map((key) => (
                        <div
                          key={`${item.id}-${key}`}
                          className={cn(gridCellClass, rowClass, "cursor-pointer")}
                          onClick={() => onSelectOpportunity(item.id)}
                        >
                          <div className="truncate" title={String((item as any)[key] ?? "")}>
                            {String((item as any)[key] ?? "")}
                          </div>
                        </div>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 py-2 text-xs text-muted-foreground">
        {typeof totalCount === "number"
          ? `${items.length} von ${totalCount} Gelegenheiten angezeigt`
          : `${items.length} Gelegenheiten angezeigt`}
      </div>
    </div>
  );
};

export default GridList;
