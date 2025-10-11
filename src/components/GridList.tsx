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

interface GridListProps {
  items: Item[];
  onUpdateItem: (id: string, field: string, value: string | number | boolean) => void;
  onViewDetails: (item: Item) => void;
  opportunityStatusOptions: string[];
  authToken: string;
}

const GridList: React.FC<GridListProps> = ({
  items,
  onUpdateItem,
  onViewDetails,
  opportunityStatusOptions,
  authToken,
}) => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [isBpSelectDialogOpen, setIsBpSelectDialogOpen] = useState(false);
  const [currentEditingItemId, setCurrentEditingItemId] = useState<string | null>(null);

  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach((item) => {
      for (const key in item) {
        if (key !== "@odata.etag" && key !== "@odata.context") {
          keys.add(key);
        }
      }
    });
    // Order the keys: id, description first, then others alphabetically
    // Ensure new date field names are considered if they appear in the initial items
    const orderedKeys = ["id", "description", "DateOfFirstContact", "ExpectedCloseDate", "ActualCloseDate"].filter(k => keys.has(k));
    const otherKeys = Array.from(keys).filter(k => !orderedKeys.includes(k)).sort();
    return [...orderedKeys, ...otherKeys];
  }, [items]);

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
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px] text-center"></TableHead>
            {allKeys.map((key) => (
              <TableHead key={key} className="min-w-[100px]">
                <div className="flex flex-col space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort(key)}
                    className="flex items-center gap-1 justify-start px-2"
                  >
                    {key.replace(/([A-Z])/g, ' $1').trim()}
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
                    className="h-8 text-xs"
                    placeholder={`Filter ${key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`}
                  />
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewDetails(item)}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </TableCell>
              {allKeys.map((key) => (
                <TableCell key={`${item.id}-${key}`}>
                  {key === "Status" && opportunityStatusOptions.length > 0 ? (
                    <Select
                      value={String(item[key])}
                      onValueChange={(value) => onUpdateItem(item.id, key, value)}
                    >
                      <SelectTrigger className="w-full h-8 text-xs">
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
                      <div className="relative flex-grow">
                        <Input
                          value={item[key] !== null && item[key] !== undefined ? String(item[key]) : ""}
                          onChange={(e) =>
                            onUpdateItem(
                              item.id,
                              key,
                              e.target.value
                            )
                          }
                          className="pr-10 w-full"
                          disabled={false}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenBpSelectDialog(item.id)}
                          aria-label={`Select Business Partner for ${item.id}`}
                          className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                      {item.SoldtoBusinessPartnerName && (
                        <p className="text-sm text-muted-foreground whitespace-nowrap">{item.SoldtoBusinessPartnerName}</p>
                      )}
                    </div>
                  ) : (
                    <Input
                      value={item[key] !== null && item[key] !== undefined ? String(item[key]) : ""}
                      onChange={(e) =>
                        onUpdateItem(
                          item.id,
                          key,
                          typeof item[key] === "number" ? parseInt(e.target.value) || 0 : e.target.value
                        )
                      }
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
              ))}
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
      />
    </div>
  );
};

export default GridList;