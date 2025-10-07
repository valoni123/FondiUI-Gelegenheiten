import React, { useState } from "react";
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

interface GridListProps {
  items: Item[];
  onUpdateItem: (id: string, field: keyof Item, value: string | number) => void;
  onViewDetails: (item: Item) => void;
}

const GridList: React.FC<GridListProps> = ({
  items,
  onUpdateItem,
  onViewDetails,
}) => {
  const [filter, setFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<keyof Item | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  };

  const handleSort = (key: keyof Item) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(filter.toLowerCase()) ||
      item.description.toLowerCase().includes(filter.toLowerCase()) ||
      item.id.toLowerCase().includes(filter.toLowerCase())
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortKey) return 0;

    const aValue = a[sortKey];
    const bValue = b[sortKey];

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter items..."
            value={filter}
            onChange={handleFilterChange}
            className="pl-9"
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort("id")}
                className="flex items-center gap-1"
              >
                ID
                {sortKey === "id" && (
                  <ArrowDownUp
                    className={cn(
                      "h-3 w-3",
                      sortDirection === "desc" ? "rotate-180" : ""
                    )}
                  />
                )}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort("name")}
                className="flex items-center gap-1"
              >
                Name
                {sortKey === "name" && (
                  <ArrowDownUp
                    className={cn(
                      "h-3 w-3",
                      sortDirection === "desc" ? "rotate-180" : ""
                    )}
                  />
                )}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort("description")}
                className="flex items-center gap-1"
              >
                Description
                {sortKey === "description" && (
                  <ArrowDownUp
                    className={cn(
                      "h-3 w-3",
                      sortDirection === "desc" ? "rotate-180" : ""
                    )}
                  />
                )}
              </Button>
            </TableHead>
            <TableHead className="w-[100px]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort("quantity")}
                className="flex items-center gap-1"
              >
                Quantity
                {sortKey === "quantity" && (
                  <ArrowDownUp
                    className={cn(
                      "h-3 w-3",
                      sortDirection === "desc" ? "rotate-180" : ""
                    )}
                  />
                )}
              </Button>
            </TableHead>
            <TableHead className="text-right w-[50px]">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.id}</TableCell>
              <TableCell>
                <Input
                  value={item.name}
                  onChange={(e) =>
                    onUpdateItem(item.id, "name", e.target.value)
                  }
                  className="w-full"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={item.description}
                  onChange={(e) =>
                    onUpdateItem(item.id, "description", e.target.value)
                  }
                  className="w-full"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    onUpdateItem(item.id, "quantity", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewDetails(item)}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {sortedItems.length === 0 && (
        <p className="text-center text-muted-foreground py-4">No items found.</p>
      )}
    </div>
  );
};

export default GridList;