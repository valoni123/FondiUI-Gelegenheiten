import React, { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { Item } from "@/types";
import { cn } from "@/lib/utils";
import BusinessPartnerSelectDialog from "./BusinessPartnerSelectDialog";
import { BusinessPartner } from "@/api/businessPartners";
import EditableCellInput from "./EditableCellInput";
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
}

const GridList: React.FC<GridListProps> = (props) => {
  const {
    items,
    onUpdateItem,
    authToken,
    companyNumber,
    cloudEnvironment,
    selectedOpportunityId,
    onSelectOpportunity,
    isLoading,
    filters,
    onCommitFilters,
    sortConfig,
    onSortChange,
  } = props;

  // Draft filters: user can type; we only send to LN on blur/Enter.
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>(filters);
  const [isBpSelectDialogOpen, setIsBpSelectDialogOpen] = useState(false);
  const [currentEditingItemId, setCurrentEditingItemId] = useState<string | null>(null);

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

  const handleDraftFilterChange = (key: string, value: string) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const commitFilters = () => {
    // Avoid reloading when the user just moves focus between filter inputs without changing anything.
    if (isSameFilters(draftFilters, filters)) return;
    onCommitFilters(draftFilters);
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

  const sortedItems = items;

  const handleOpenBpSelectDialog = (itemId: string) => {
    setCurrentEditingItemId(itemId);
    setIsBpSelectDialogOpen(true);
  };

  const handleSelectBusinessPartnerFromGrid = (bp: BusinessPartner) => {
    if (currentEditingItemId) {
      onUpdateItem(currentEditingItemId, "SoldtoBusinessPartner", bp.BusinessPartner);
    }
    setIsBpSelectDialogOpen(false);
    setCurrentEditingItemId(null);
  };

  // Visually align the opportunities grid with the document list (Detailansicht).
  const headerCellClass =
    "h-8 px-1 py-1 text-xs font-medium text-muted-foreground border-r border-b border-border bg-gray-100 dark:bg-gray-800 align-middle";
  const filterCellClass = "h-8 px-1 py-1 border-r border-b border-border bg-background align-middle";
  const dataCellClass = "h-8 px-1 py-1 min-w-0 border-r border-b border-border bg-background align-middle";
  const iconCellClass = "h-8 px-1 py-1 border-r border-b border-border bg-background align-middle";

  const columns = React.useMemo(() => {
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
    // Match the compact icon column width used in the document list.
    return [{ key: "__open__", widthPx: 30 }, ...specs];
  }, [visibleKeys]);

  return (
    <React.Fragment>
      <div className="h-full min-h-0 flex flex-col gap-3">
        {/*
          IMPORTANT: Sticky table headers inside <table> can be unreliable depending on scroll containers.
          We render header+filter as a separate (non-scrolling) table, and only the body scrolls.
          Horizontal scrolling is shared via the outer overflow-x container.
        */}
        <div className="flex-1 min-h-0 w-full overflow-x-auto">
          <div className="min-w-max h-full min-h-0 flex flex-col">
            {/* Fixed header + filter row */}
            <div className="flex-shrink-0 border-l border-border">
              <table className="w-max min-w-full table-fixed border-separate border-spacing-0 caption-bottom text-sm">
                <colgroup>
                  {columns.map((c) => (
                    <col key={c.key} style={{ width: `${c.widthPx}px` }} />
                  ))}
                </colgroup>
                <thead className="[&_tr]:border-b">
                  <tr className="border-b border-border">
                    <th className={cn("text-center", headerCellClass, "px-0")}>
                      <span className="sr-only">Open</span>
                    </th>
                    {visibleKeys.map((key) => (
                      <th
                        key={key}
                        className={cn(headerCellClass, "text-left")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(key)}
                          className="flex w-full items-center justify-start gap-1 p-0 text-left text-xs font-bold leading-none text-foreground hover:text-foreground"
                        >
                          {getColumnLabel(key)}
                          {sortConfig?.key === key ? (
                            sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>

                  <tr className="border-b border-border">
                    <th className={cn(filterCellClass, "px-0")} />
                    {visibleKeys.map((key) => (
                      <th key={`${key}-filter`} className={filterCellClass}>
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
                          className="h-6 w-full min-w-0 text-xs px-1 rounded-none"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto border-l border-border">
              <table className="w-max min-w-full table-fixed border-separate border-spacing-0 caption-bottom text-sm">
                <colgroup>
                  {columns.map((c) => (
                    <col key={c.key} style={{ width: `${c.widthPx}px` }} />
                  ))}
                </colgroup>
                <tbody className="[&_tr:last-child]:border-0">
                  {isLoading ? (
                    <tr>
                      <td colSpan={visibleKeys.length + 1} className="text-center py-6">
                        <div className="flex items-center justify-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Gelegenheiten werden geladen…
                        </div>
                      </td>
                    </tr>
                  ) : sortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={visibleKeys.length + 1} className="text-center py-6">
                        <div className="text-sm text-muted-foreground">Keine Einträge gefunden.</div>
                      </td>
                    </tr>
                  ) : (
                    sortedItems.map((item) => {
                      const isSelected = selectedOpportunityId === item.id;
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "cursor-pointer",
                            isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-muted"
                          )}
                          onClick={() => onSelectOpportunity(item.id)}
                        >
                          <td className={cn(iconCellClass, "px-0 text-center")}>
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
                          </td>

                          {visibleKeys.map((key) => (
                            <td
                              key={key}
                              className={cn(
                                dataCellClass,
                                "text-xs",
                                key === "description" && "min-w-0"
                              )}
                            >
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
              {`${items.length} Gelegenheiten angezeigt`}
            </div>
          </div>
        </div>
      </div>

      <BusinessPartnerSelectDialog
        isOpen={isBpSelectDialogOpen}
        onClose={() => setIsBpSelectDialogOpen(false)}
        onSelect={handleSelectBusinessPartnerFromGrid}
        authToken={authToken}
        companyNumber={companyNumber}
        cloudEnvironment={cloudEnvironment}
      />
    </React.Fragment>
  );
};

export default GridList;