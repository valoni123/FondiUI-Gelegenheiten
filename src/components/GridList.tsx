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
import EditableCellInput from "./EditableCellInput"; // Import the new component
import { CloudEnvironment } from "@/authorization/configLoader";

interface GridListProps {
  items: Item[];
  onUpdateItem: (id: string, field: string, value: string | number | boolean) => void;
  onViewDetails: (item: Item) => void;
  opportunityStatusOptions: string[];
  authToken: string;
  companyNumber: string;
  cloudEnvironment: CloudEnvironment;
}

const GridList: React.FC<GridListProps> = ({
  items,
  onUpdateItem,
  onViewDetails,
  opportunityStatusOptions,
  authToken,
  companyNumber,
  cloudEnvironment,
}) => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [isBpSelectDialogOpen, setIsBpSelectDialogOpen] = useState(false);
  const [currentEditingItemId, setCurrentEditingItemId] = useState<string | null>(null);

  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach((item) => {
      for (const key in item) {
        // Exclude internal OData keys and 'name' which is derived from 'Opportunity'
        if (key !== "@odata.etag" && key !== "@odata.context" && key !== "name" && key !== "opportunityText") {
          keys.add(key);
        }
      }
    });
    // Order the keys: id, description first, then others alphabetically
    const orderedKeys = ["id", "description"].filter(k => keys.has(k));
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
                        <p className="text-sm text-muted-foreground whitespace-nowrap">{item.SoldtoBusinessPartnerName}</p>
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
        companyNumber={companyNumber}
        cloudEnvironment={cloudEnvironment}
      />
    </div>
  );
};

export default GridList;