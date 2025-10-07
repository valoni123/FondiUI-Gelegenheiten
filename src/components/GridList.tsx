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
import { ArrowRight, ArrowDownUp } from "lucide-react";
import { Item } from "@/types";
import { cn } from "@/lib/utils";

interface GridListProps {
  items: Item[];
  onUpdateItem: (id: string, field: string, value: string | number) => void;
  onViewDetails: (item: Item) => void;
}

const GridList: React.FC<GridListProps> = ({
  items,
  onUpdateItem,
  onViewDetails,
}) => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  // Determine all unique keys from the items to use as columns
  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach((item) => {
      for (const key in item) {
        // Exclude internal OData keys and ensure 'id' is always first, then 'name', 'description', 'quantity'
        if (key !== "@odata.etag" && key !== "@odata.context") {
          keys.add(key);
        }
      }
    });
    // Order the keys: id, name, description, quantity first, then others alphabetically
    const orderedKeys = ["id", "name", "description", "quantity"].filter(k => keys.has(k));
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

    // Apply filters
    currentItems = currentItems.filter((item) => {
      for (const key in filters) {
        const filterValue = filters[key].toLowerCase();
        const itemValue = String(item[key] || "").toLowerCase(); // Handle null/undefined values
        if (filterValue && !itemValue.includes(filterValue)) {
          return false;
        }
      }
      return true;
    });

    // Apply sorting
    if (sortConfig) {
      currentItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // Handle null/undefined values for sorting
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
        // Fallback for other types, or if types are mixed
        return 0;
      });
    }
    return currentItems;
  }, [items, filters, sortConfig]);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px] text-center"></TableHead> {/* For details button */}
            {allKeys.map((key) => (
              <TableHead key={key} className="min-w-[100px]">
                <div className="flex flex-col space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort(key)}
                    className="flex items-center gap-1 justify-start px-2"
                  >
                    {key.replace(/([A-Z])/g, ' $1').trim()} {/* Make key readable */}
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
                    // Disable editing for ID and other system-generated/read-only fields
                    disabled={
                      key === "id" ||
                      key === "Opportunity" ||
                      key === "Guid" ||
                      key === "CreationDate" ||
                      key === "LastTransactionDate" ||
                      key === "CreatedBy" ||
                      key === "LastModifiedBy" ||
                      key === "Status" // Assuming Status might be read-only
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {filteredAndSortedItems.length === 0 && (
        <p className="text-center text-muted-foreground py-4">No items found.</p>
      )}
    </div>
  );
};

export default GridList;