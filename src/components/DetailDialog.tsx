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

interface DetailDialogProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Item) => void;
  isAddingNewItem: boolean; // New prop to indicate if adding a new item
}

const DetailDialog: React.FC<DetailDialogProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
  isAddingNewItem,
}) => {
  const [editedItem, setEditedItem] = useState<Item | null>(null);

  useEffect(() => {
    if (isAddingNewItem) {
      // Initialize with empty values for a new item
      setEditedItem({
        id: "", // ID will be generated on save in Index.tsx
        name: "",
        description: "",
        quantity: 0,
      });
    } else {
      setEditedItem(item);
    }
  }, [item, isAddingNewItem]);

  const handleChange = (field: keyof Item, value: string | number) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isAddingNewItem ? "Add New Item" : "Edit Item Details"}</DialogTitle>
          <DialogDescription>
            {isAddingNewItem ? "Enter details for the new item." : "Make changes to your item here. Click save when you're done."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="id" className="text-right">
              ID
            </Label>
            <Input id="id" value={editedItem.id} className="col-span-3" disabled={true} placeholder={isAddingNewItem ? "Auto-generated on save" : ""} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={editedItem.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="col-span-3"
              placeholder="Enter item name"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input
              id="description"
              value={editedItem.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="col-span-3"
              placeholder="Enter item description"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input
              id="quantity"
              type="number"
              value={editedItem.quantity}
              onChange={(e) => handleChange("quantity", parseInt(e.target.value))}
              className="col-span-3"
              placeholder="Enter quantity"
            />
          </div>
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