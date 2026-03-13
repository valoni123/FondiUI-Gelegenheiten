import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ArrowRight, Loader2 } from "lucide-react";

import { Item } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CloudEnvironment } from "@/authorization/configLoader";

interface GridListProps {
  items: Item[];
  onUpdateItem: (id: string, field: string, value: string | number | boolean) => void;
  // Intentionally kept for backwards compatibility with existing callers.
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
}

const GridList: React.FC<GridListProps> = ({
  items,
  selectedOpportunityId,
  onSelectOpportunity,
  isLoading,
  filters,
  onCommitFilters,
}) => {
  // Draft filters: user can type; we only send to LN on blur/Enter.
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>(filters);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

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

  // Spalten (alte Ansicht)
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

  const handleDraftFilterChange = (key: string, value: string) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const commitFilters = () => {
    // Avoid reloading when the user just moves focus between filter inputs without changing anything.
    if (isSameFilters(draftFilters, filters)) return;
    onCommitFilters(draftFilters);
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    const currentItems = [...items];
    if (!sortConfig) return currentItems;

    currentItems.sort((a, b) => {
      const aValue = (a as any)[sortConfig.key];
      const bValue = (b as any)[sortConfig.key];

      if (aValue === null || aValue === undefined) return sortConfig.direction === "asc" ? 1 : -1;
      if (bValue === null || bValue === undefined) return sortConfig.direction === "asc" ? -1 : 1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });

    return currentItems;
  }, [items, sortConfig]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border bg-background">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="w-10 border-b border-border" />
              {visibleKeys.map((key) => (
                <th key={key} className="border-b border-border text-left">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort(key)}
                    className="h-8 px-2 font-bold hover:bg-transparent"
                  >
                    {getColumnLabel(key)}
                    {sortConfig?.key === key && (
                      <ArrowDownUp
                        className={cn(
                          "ml-1 h-3 w-3",
                          sortConfig.direction === "desc" ? "rotate-180" : ""
                        )}
                      />
                    )}
                  </Button>
                </th>
              ))}
            </tr>

            <tr className="bg-background">
              <th className="border-b border-border" />
              {visibleKeys.map((key) => (
                <th key={`${key}-filter`} className="border-b border-border px-1 py-1">
                  <Input
                    value={draftFilters[key] || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleDraftFilterChange(key, e.target.value)
                    }
                    onBlur={commitFilters}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitFilters();
                      }
                    }}
                    className="h-7 text-xs px-2"
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={visibleKeys.length + 1} className="py-10 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gelegenheiten werden geladen…
                  </div>
                </td>
              </tr>
            ) : sortedItems.length === 0 ? (
              <tr>
                <td colSpan={visibleKeys.length + 1} className="py-10 text-center text-sm text-muted-foreground">
                  Keine Einträge gefunden.
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => {
                const isSelected = selectedOpportunityId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted",
                      isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    )}
                    onClick={() => onSelectOpportunity(item.id)}
                  >
                    <td className="border-b border-border text-center align-middle">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onSelectOpportunity(item.id);
                        }}
                        title="Zur Detailansicht"
                        aria-label="Zur Detailansicht"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </td>

                    {visibleKeys.map((key) => (
                      <td key={key} className="border-b border-border px-2 py-1 text-xs align-middle">
                        <div className="truncate" title={String((item as any)[key] ?? "")}>
                          {String((item as any)[key] ?? "")}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex-shrink-0 py-2 text-xs text-muted-foreground">
        {`${sortedItems.length} Gelegenheiten angezeigt`}
      </div>
    </div>
  );
};

export default GridList;