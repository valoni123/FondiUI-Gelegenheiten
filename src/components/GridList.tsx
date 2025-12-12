import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowDownUp, Search } from "lucide-react";
import { Item } from "@/types";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  selectedOpportunityId: string | null; // New prop for selected item
  onSelectOpportunity: (opportunityId: string | null) => void; // New prop for selection handler
}

const GridList: React.FC<GridListProps> = ({
  items,
  onUpdateItem,
  onViewDetails,
  opportunityStatusOptions,
  authToken,
  companyNumber,
  cloudEnvironment,
  selectedOpportunityId, // Destructure new prop
  onSelectOpportunity, // Destructure new prop
}) => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [isBpSelectDialogOpen, setIsBpSelectDialogOpen] = useState(false);
  const [currentEditingItemId, setCurrentEditingItemId] = useState<string | null>(null);

  // Define the specific keys to be displayed in the grid
  const visibleKeys = useMemo(() => ["id", "Project", "description", "Status"], []);

  const getColumnLabel = (key: string) => {
    if (key === "id") return "Gelegenheit";
    if (key === "Project") return "Projekt";
    if (key === "description") return "Bezeichnung";
    return key.replace(/([A-Z])/g, ' $1').trim();
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
      for (const key in filters) {
        const filterValue = filters[key].toLowerCase();
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
  }, [items, filters, sortConfig]);

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

  return (
    <React.Fragment>
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              {[
                <TableHead key="_open" className="w-[40px] text-center px-1 py-1">
                  <span className="sr-only">Open</span>
                </TableHead>,
                ...visibleKeys.map((key) => (
                  <TableHead
                    key={key}
                    className={cn(
                      "px-1 py-1",
                      "min-w-[60px]",
                      key === "id" && "min-w-[100px]",
                      key === "Project" && "min-w-[100px]",
                      key === "description" && "min-w-[150px]"
                    )}
                  >
                    <div className="flex flex-col space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort(key)}
                        className="flex items-center gap-1 justify-start px-1 font-bold"
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
                      <Input
                        value={filters[key] || ""}
                        onChange={(e) => handleFilterChange(key, e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                  </TableHead>
                )),
              ]}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedItems.map((item) => (
              <TableRow
                key={item.id}
                className={cn(
                  "hover:bg-muted cursor-pointer",
                  selectedOpportunityId === item.id && "bg-blue-100 dark:bg-blue-900"
                )}
                onClick={() => {
                  if (selectedOpportunityId === item.id) {
                    onSelectOpportunity(null);
                  } else {
                    onSelectOpportunity(item.id);
                  }
                }}
              >
                {[
                  <TableCell key={`${item.id}-open`} className="text-center px-1 py-1">
                    <Button
                      variant="default"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedOpportunityId === item.id) {
                          onSelectOpportunity(null);
                        } else {
                          onSelectOpportunity(item.id);
                        }
                      }}
                      aria-label={`Open opportunity ${item.id}`}
                      title="Öffnen"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </TableCell>,
                  ...visibleKeys.map((key) => (
                    <TableCell key={`${item.id}-${key}`} className="px-1 py-1">
                      {key === "Status" && opportunityStatusOptions.length > 0 ? (
                        <Select
                          value={String(item[key])}
                          onValueChange={(value) => onUpdateItem(item.id, key, value)}
                        >
                          <SelectTrigger className="w-full h-7 text-xs">
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {opportunityStatusOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : key === "SoldtoBusinessPartner" ? (
                        <div className="flex items-center gap-2">
                          <EditableCellInput
                            itemId={item.id}
                            fieldKey={key}
                            initialValue={item[key] || ""}
                            onUpdateItem={onUpdateItem}
                            className="pr-10 w-full"
                            disabled={false}
                            hasSearchButton={true}
                            onSearchButtonClick={handleOpenBpSelectDialog}
                          />
                          {item.SoldtoBusinessPartnerName && (
                            <p className="text-sm text-muted-foreground whitespace-nowrap">
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
                          className="w-full"
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
                    </TableCell>
                  )),
                ]}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredAndSortedItems.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No items found.</p>
        )}

        <BusinessPartnerSelectDialog
          isOpen={isBpSelectDialogOpen}
          onClose={() => setIsBpSelectDialogOpen(false)}
          onSelect={handleSelectBusinessPartnerFromGrid}
          authToken={authToken}
          companyNumber={companyNumber}
          cloudEnvironment={cloudEnvironment}
        />
      </div>
    </React.Fragment>
  );
};

export default GridList;