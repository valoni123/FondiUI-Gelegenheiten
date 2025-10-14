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
import { BusinessPartner } from "@/api/businessPartners";
import { cn } from "@/lib/utils";

interface BusinessPartnerGridProps {
  businessPartners: BusinessPartner[];
  onSelect: (businessPartner: BusinessPartner) => void;
}

const BusinessPartnerGrid: React.FC<BusinessPartnerGridProps> = ({
  businessPartners,
  onSelect,
}) => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const columns = useMemo(() => [
    { key: "BusinessPartner", label: "Kunde ID" },
    { key: "Name", label: "Name" },
    { key: "Street", label: "Straße", path: "AddressRef.Street" },
    { key: "ZIPCodePostalCode", label: "Postleitzahl", path: "AddressRef.ZIPCodePostalCode" },
    { key: "CityDescription", label: "Ort", path: "AddressRef.CityDescription" },
    { key: "Country", label: "Land", path: "AddressRef.Country" },
    // Add other fields if needed, e.g., "Telefonnummer" if available in BusinessPartner interface
  ], []);

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
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

  const filteredAndSortedPartners = useMemo(() => {
    let currentPartners = [...businessPartners];

    // Apply filters
    currentPartners = currentPartners.filter((partner) => {
      for (const col of columns) {
        const filterValue = filters[col.key]?.toLowerCase();
        if (filterValue) {
          const itemValue = String(col.path ? getNestedValue(partner, col.path) : partner[col.key] || "").toLowerCase();
          if (!itemValue.includes(filterValue)) {
            return false; // If any filter doesn't match, exclude the item
          }
        }
      }
      return true;
    });

    // Apply sorting
    if (sortConfig) {
      currentPartners.sort((a, b) => {
        const aValue = sortConfig.key.includes('.') ? getNestedValue(a, sortConfig.key) : a[sortConfig.key];
        const bValue = sortConfig.key.includes('.') ? getNestedValue(b, sortConfig.key) : b[sortConfig.key];

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
    return currentPartners;
  }, [businessPartners, filters, sortConfig, columns]);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px] text-center"></TableHead> {/* For select button */}
            {columns.map((col) => (
              <TableHead key={col.key} className="min-w-[100px]">
                <div className="flex flex-col space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1 justify-start px-2"
                  >
                    {col.label}
                    {sortConfig?.key === col.key && (
                      <ArrowDownUp
                        className={cn(
                          "h-3 w-3",
                          sortConfig.direction === "desc" ? "rotate-180" : ""
                        )}
                      />
                    )}
                  </Button>
                  <Input
                    value={filters[col.key] || ""}
                    onChange={(e) => handleFilterChange(col.key, e.target.value)}
                    className="h-8 text-xs"
                    placeholder={`Filter ${col.label.toLowerCase()}`}
                  />
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedPartners.map((partner) => (
            <TableRow key={partner.BusinessPartner} className="hover:bg-primary hover:text-primary-foreground"> {/* Changed to hover:bg-primary */}
              <TableCell className="text-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSelect(partner)}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </TableCell>
              {columns.map((col) => (
                <TableCell key={`${partner.BusinessPartner}-${col.key}`}>
                  {col.path ? getNestedValue(partner, col.path) : partner[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {filteredAndSortedPartners.length === 0 && (
        <p className="text-center text-muted-foreground py-4">No business partners found.</p>
      )}
    </div>
  );
};

export default BusinessPartnerGrid;