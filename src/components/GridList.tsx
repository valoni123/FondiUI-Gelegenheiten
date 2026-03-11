import React, { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowDownUp, Loader2 } from "lucide-react";
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
  } = props;

  // Keep typing snappy: update input state immediately, apply it to filtering with a small debounce.
  const [uiFilters, setUiFilters] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [isBpSelectDialogOpen, setIsBpSelectDialogOpen] = useState(false);
  const [currentEditingItemId, setCurrentEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setAppliedFilters(uiFilters), 150);
    return () => window.clearTimeout(t);
  }, [uiFilters]);

  // Define the specific keys to be displayed in the grid
  const visibleKeys = useMemo(
    () => [
      "id",
      "Project",
      "description",
      "Artikel",
      "Customer",
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

  const handleFilterChange = (key: string, value: string) => {
    setUiFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedItems = useMemo(() => {
    let currentItems = [...items];

    currentItems = currentItems.filter((item) => {
      for (const key in appliedFilters) {
        const filterValue = appliedFilters[key].toLowerCase();
        const itemValue = String(item[key] || "").toLowerCase();
        if (filterValue && !itemValue.includes(filterValue)) {
          return false;
        }
      }
      return true;
    });

    if (sortConfig) {
      currentItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

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
    }
    return currentItems;
  }, [items, appliedFilters, sortConfig]);

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

  // Match Detailansicht-Zellgrößen (DocAttributesGrid)
  const headerCellClass =
    "px-1 py-1 text-xs font-medium text-muted-foreground border-r border-b border-border bg-gray-100 dark:bg-gray-800 h-8 align-middle";
  const filterCellClass = "px-1 py-1 border-r border-b border-border bg-background h-8 align-middle";
  const dataCellClass = "px-1 py-1 border-r border-b border-border bg-background h-8 align-middle";
  const iconCellClass = "px-1 py-1 border-r border-b border-border bg-background h-8 align-middle";

  return (
    <React.Fragment>
      <div className="space-y-4">
        <div className="w-full overflow-x-auto">
          <table className="w-max min-w-full caption-bottom text-sm border-l border-border">
            <thead className="[&_tr]:border-b">
              <tr className="border-b border-border">
                <th className={cn("w-[40px] text-center", headerCellClass)}>
                  <span className="sr-only">Open</span>
                </th>
                {visibleKeys.map((key) => (
                  <th
                    key={key}
                    className={cn(
                      headerCellClass,
                      "min-w-[60px] text-left",
                      key === "id" && "min-w-[120px]",
                      key === "Project" && "min-w-[120px]",
                      key === "description" && "min-w-[180px]",
                      key === "Artikel" && "min-w-[140px]",
                      key === "Customer" && "min-w-[160px]",
                      key === "PartNoOriginalRequest" && "min-w-[160px]",
                      key === "DrawingNoOriginalRequest" && "min-w-[160px]"
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort(key)}
                      className="flex items-center justify-start px-1 font-bold h-6 hover:bg-transparent"
                    >
                      {getColumnLabel(key)}
                      {sortConfig?.key === key && (
                        <ArrowDownUp
                          className={cn(
                            "h-3 w-3",
                            sortConfig.direction === "desc" ? "rotate-180" : ""
                          )}
                        />
                      )}
                    </Button>
                  </th>
                ))}
              </tr>

              <tr className="border-b border-border">
                <th className={cn("w-[40px]", filterCellClass)} />
                {visibleKeys.map((key) => (
                  <th key={`${key}-filter`} className={filterCellClass}>
                    <Input
                      value={uiFilters[key] || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleFilterChange(key, e.target.value)
                      }
                      className="h-6 w-full text-xs px-1 rounded-none"
                    />
                  </th>
                ))}
              </tr>
            </thead>

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
              ) : filteredAndSortedItems.length === 0 ? (
                <tr>
                  <td colSpan={visibleKeys.length + 1} className="text-center py-6">
                    <div className="text-sm text-muted-foreground">Keine Einträge gefunden.</div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedItems.map((item) => {
                  const isSelected = selectedOpportunityId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "cursor-pointer border-b border-border",
                        isSelected && "bg-blue-100 dark:bg-blue-900"
                      )}
                      onClick={() => {
                        if (selectedOpportunityId === item.id) {
                          onSelectOpportunity(null);
                        } else {
                          onSelectOpportunity(item.id);
                        }
                      }}
                    >
                      <td className={cn("text-center", iconCellClass)}>
                        <Button
                          variant="default"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (selectedOpportunityId === item.id) {
                              onSelectOpportunity(null);
                            } else {
                              onSelectOpportunity(item.id);
                            }
                          }}
                          aria-label={`Open opportunity ${item.id}`}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </td>

                      {visibleKeys.map((key) => (
                        <td key={`${item.id}-${key}`} className={dataCellClass}>
                          {key === "id" ||
                          key === "Project" ||
                          key === "description" ||
                          key === "Artikel" ||
                          key === "Customer" ||
                          key === "PartNoOriginalRequest" ||
                          key === "DrawingNoOriginalRequest" ? (
                            <button
                              className="w-full text-left h-6 text-xs px-1 rounded-none truncate"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                if (selectedOpportunityId !== item.id) {
                                  onSelectOpportunity(item.id);
                                }
                              }}
                            >
                              {String(item[key] ?? "")}
                            </button>
                          ) : key === "SoldtoBusinessPartner" ? (
                            <div className="flex items-center gap-2">
                              <EditableCellInput
                                itemId={item.id}
                                fieldKey={key}
                                initialValue={item[key] || ""}
                                onUpdateItem={onUpdateItem}
                                className="pr-10 w-full rounded-none h-6 text-xs"
                                disabled={false}
                                hasSearchButton={true}
                                onSearchButtonClick={handleOpenBpSelectDialog}
                              />
                              {item.SoldtoBusinessPartnerName && (
                                <p className="text-xs text-muted-foreground whitespace-nowrap">
                                  {item.SoldtoBusinessPartnerName}
                                </p>
                              )}
                            </div>
                          ) : (
                            <EditableCellInput
                              itemId={item.id}
                              fieldKey={key}
                              initialValue={item[key] || ""}
                              onUpdateItem={onUpdateItem}
                              type={typeof item[key] === "number" ? "number" : "text"}
                              className="w-full rounded-none h-6 text-xs px-1"
                              disabled={
                                key === "id" ||
                                key === "Opportunity" ||
                                key === "Guid" ||
                                key === "CreationDate" ||
                                key === "LastTransactionDate" ||
                                key === "CreatedBy" ||
                                key === "LastModifiedBy"
                              }
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <BusinessPartnerSelectDialog
          isOpen={isBpSelectDialogOpen}
          onClose={() => setIsBpSelectDialogOpen(false)}
          onSelect={handleSelectBusinessPartnerFromGrid}
          authToken={authToken}
          companyNumber={companyNumber}
          cloudEnvironment={cloudEnvironment}
        />

        <p className="text-sm text-muted-foreground text-center py-2">
          {`${filteredAndSortedItems.length} Gelegenheiten angezeigt`}
        </p>
      </div>
    </React.Fragment>
  );
};

export default GridList;