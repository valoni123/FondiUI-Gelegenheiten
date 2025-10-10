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
} from "@/components/ui/select"; // Import Select components

interface DetailDialogProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Item) => void;
  isAddingNewItem: boolean;
  opportunityStatusOptions: string[]; // New prop for status options
}

const DetailDialog: React.FC<DetailDialogProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
  isAddingNewItem,
  opportunityStatusOptions,
}) => {
  const [editedItem, setEditedItem] = useState<Item | null>(null);

  useEffect(() => {
    if (isAddingNewItem) {
      // Initialize with empty values for a new item, including core fields
      setEditedItem({
        id: "", // ID will be generated on save in Index.tsx or by API
        name: "",
        description: "",
        quantity: 0,
        // Other dynamic fields will be added as needed by user input
      });
    } else {
      setEditedItem(item);
    }
  }, [item, isAddingNewItem]);

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

  if (!editedItem) return null;

  // Get all keys from the editedItem, excluding internal OData keys and 'id' (which is handled separately)
  const itemKeys = Object.keys(editedItem).filter(key =>
    key !== "id" && key !== "@odata.etag" && key !== "@odata.context"
  ).sort((a, b) => {
    // Prioritize core fields at the top
    const order = ["name", "description", "quantity"];
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);

    if (indexA > -1 && indexB > -1) return indexA - indexB;
    if (indexA > -1) return -1;
    if (indexB > -1) return 1;
    return a.localeCompare(b);
  });


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] md:max-w-[700px]"> {/* Adjusted width for two columns */}
        <DialogHeader>
          <DialogTitle>{isAddingNewItem ? "Add New Item" : "Edit Item Details"}</DialogTitle>
          <DialogDescription>
            {isAddingNewItem ? "Enter details for the new item." : "Make changes to your item here. Click save when you're done."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 py-4"> {/* Two columns for fields */}
          {/* ID field always first and disabled, spanning both columns */}
          <div className="md:col-span-2 grid grid-cols-[100px_1fr] items-center gap-4">
            <Label htmlFor="id" className="text-right">
              ID
            </Label>
            <Input id="id" value={editedItem.id} className="w-full" disabled={true} placeholder={isAddingNewItem ? "Auto-generated on save" : ""} />
          </div>

          {itemKeys.map((key) => (
            <div className="grid grid-cols-[100px_1fr] items-center gap-4" key={key}> {/* Each field group takes one column */}
              <Label htmlFor={key} className="text-right capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()} {/* Make it more readable */}
              </Label>
              {key === "Status" && opportunityStatusOptions.length > 0 ? (
                <Select
                  value={String(editedItem[key])}
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
              ) : (
                <Input
                  id={key}
                  type={typeof editedItem[key] === "number" ? "number" : "text"}
                  value={editedItem[key] !== null && editedItem[key] !== undefined ? String(editedItem[key]) : ""}
                  onChange={(e) => handleChange(key, typeof editedItem[key] === "number" ? parseInt(e.target.value) || 0 : e.target.value)}
                  className="w-full"
                  placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`}
                  // Disable editing for system-generated/read-only fields
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
          ))}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            {isAddingNewItem ? "Add Item" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DetailDialog;