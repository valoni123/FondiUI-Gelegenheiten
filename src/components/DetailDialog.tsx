import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Item } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import BusinessPartnerSelectDialog from "./BusinessPartnerSelectDialog";
import { BusinessPartner, getBusinessPartnerById } from "@/api/businessPartners"; // Import BusinessPartner type and new API function

interface DetailDialogProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Item) => void;
  isAddingNewItem: boolean;
  opportunityStatusOptions: string[];
  authToken: string;
}

const DetailDialog: React.FC<DetailDialogProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
  isAddingNewItem,
  opportunityStatusOptions,
  authToken,
}) => {
  const [editedItem, setEditedItem] = useState<Item | null>(null);
  const [isBpSelectDialogOpen, setIsBpSelectDialogOpen] = useState(false);
  const [soldToBpName, setSoldToBpName] = useState<string | null>(null); // State to store BP name

  useEffect(() => {
    if (isAddingNewItem) {
      setEditedItem({
        id: "",
        name: "",
        description: "",
        quantity: 0,
        SoldtoBusinessPartner: "", // Initialize if adding new
      });
      setSoldToBpName(null); // Clear name for new item
    } else {
      setEditedItem(item);
      // If item has SoldtoBusinessPartner, fetch its name
      if (item?.SoldtoBusinessPartner && authToken) {
        const fetchBpName = async () => {
          try {
            const bp = await getBusinessPartnerById(authToken, item.SoldtoBusinessPartner);
            setSoldToBpName(bp?.Name || null);
          } catch (error) {
            console.error("Failed to fetch business partner name:", error);
            setSoldToBpName(null);
          }
        };
        fetchBpName();
      } else {
        setSoldToBpName(null);
      }
    }
  }, [item, isAddingNewItem, authToken]); // Add authToken to dependencies

  const handleChange = (field: string, value: string | number) => {
    if (editedItem) {
      setEditedItem({ ...editedItem, [field]: value });
    }
  };

  const handleSave = () => {
    if (editedItem) {
      onSave(editedItem);
      onClose();
    }
  };

  const handleSelectBusinessPartner = (bp: BusinessPartner) => {
    handleChange("SoldtoBusinessPartner", bp.BusinessPartner);
    setSoldToBpName(bp.Name); // Set the name when selected
  };

  if (!editedItem) return null;

  const itemKeys = Object.keys(editedItem).filter(key =>
    key !== "id" && key !== "@odata.etag" && key !== "@odata.context"
  ).sort((a, b) => {
    const order = ["name", "description", "quantity", "SoldtoBusinessPartner"]; // Prioritize SoldtoBusinessPartner
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);

    if (indexA > -1 && indexB > -1) return indexA - indexB;
    if (indexA > -1) return -1;
    if (indexB > -1) return 1;
    return a.localeCompare(b);
  });

  const firstGroupKeys = itemKeys.slice(0, 12);
  const secondGroupKeys = itemKeys.slice(12);

  const renderField = (key: string) => {
    // console.log(`Rendering field: ${key}, Value: ${editedItem[key]}`); // Debugging line
    return (
      <div className="grid grid-cols-[100px_1fr] items-center gap-4" key={key}>
        <Label htmlFor={key} className="text-right capitalize">
          {key.replace(/([A-Z])/g, ' $1').trim()}
        </Label>
        {key === "Status" && opportunityStatusOptions.length > 0 ? (
          <Select
            value={String(editedItem[key] || "")} // Ensure value is always a string
            onValueChange={(value) => handleChange(key, value)}
          >
            <SelectTrigger className="w-full">
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
          <div className="flex items-center gap-2"> {/* Container for input group and name */}
            <div className="relative flex-grow"> {/* Container for input and search button */}
              <Input
                id={key}
                type="text"
                value={String(editedItem[key] || "")} // Ensure value is always a string
                onChange={(e) => {
                  handleChange(key, e.target.value);
                  setSoldToBpName(null); // Clear name if user types manually
                }}
                className="pr-10 w-full" // Add padding-right for the button
                placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`}
                disabled={
                  key === "Opportunity" ||
                  key === "Guid" ||
                  key === "CreationDate" ||
                  key === "LastTransactionDate" ||
                  key === "CreatedBy" ||
                  key === "LastModifiedBy"
                }
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsBpSelectDialogOpen(true)}
                aria-label="Select Business Partner"
                className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0" // Position button inside
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {soldToBpName && editedItem[key] && ( // Conditionally display name
              <p className="text-sm text-muted-foreground whitespace-nowrap">{soldToBpName}</p>
            )}
          </div>
        ) : (
          <Input
            id={key}
            type={typeof editedItem[key] === "number" ? "number" : "text"}
            value={String(editedItem[key] || "")} // Ensure value is always a string
            onChange={(e) => handleChange(key, typeof editedItem[key] === "number" ? parseInt(e.target.value) || 0 : e.target.value)}
            className="w-full"
            placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`}
            disabled={
              key === "Opportunity" ||
              key === "Guid" ||
              key === "CreationDate" ||
              key === "LastTransactionDate" ||
              key === "CreatedBy" ||
              key === "LastModifiedBy"
            }
          />
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[90vw] lg:max-w-[1200px] max-h-[90vh] overflow-y-auto"> {/* Expanded dialog size */}
          <DialogHeader>
            <DialogTitle>
              {isAddingNewItem ? "Add New Item" : `Edit Item Details (ID: ${editedItem.id})`}
            </DialogTitle>
            <DialogDescription>
              {isAddingNewItem ? "Enter details for the new item." : "Make changes to your item here. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {firstGroupKeys.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                {firstGroupKeys.map(renderField)}
              </div>
            )}

            {secondGroupKeys.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {secondGroupKeys.map(renderField)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSave}>
              {isAddingNewItem ? "Add Item" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BusinessPartnerSelectDialog
        isOpen={isBpSelectDialogOpen}
        onClose={() => setIsBpSelectDialogOpen(false)}
        onSelect={handleSelectBusinessPartner}
        authToken={authToken}
      />
    </>
  );
};

export default DetailDialog;