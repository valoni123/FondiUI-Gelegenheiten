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
import { ArrowDownUp } from "lucide-react";
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
  const [nameFilter, setNameFilter] = useState<string>("");
  const [descriptionFilter, setDescriptionFilter] = useState<string>("");
  const [quantityFilter, setQuantityFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<keyof Item | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (key: keyof Item) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesName = item.name
      .toLowerCase()
      .includes(nameFilter.toLowerCase());
    const matchesDescription = item.description
      .toLowerCase()
      .includes(descriptionFilter.toLowerCase());
    const matchesQuantity = item.quantity
      .toString()
      .includes(quantityFilter.toLowerCase());
    return matchesName && matchesDescription && matchesQuantity;
  });

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
              <div className="flex flex-col space-y-1">
                <Input
                  placeholder="Filter name..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 justify-start px-2"
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
              </div>
            </TableHead>
            <TableHead>
              <div className="flex flex-col space-y-1">
                <Input
                  placeholder="Filter description..."
                  value={descriptionFilter}
                  onChange={(e) => setDescriptionFilter(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("description")}
                  className="flex items-center gap-1 justify-start px-2"
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
              </div>
            </TableHead>
            <TableHead className="w-[100px]">
              <div className="flex flex-col space-y-1">
                <Input
                  placeholder="Filter quantity..."
                  value={quantityFilter}
                  onChange={(e) => setQuantityFilter(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("quantity")}
                  className="flex items-center gap-1 justify-start px-2"
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
              </div>
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