import React, { useState } from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import GridList from "@/components/GridList";
import DetailDialog from "@/components/DetailDialog";
import { Item } from "@/types";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [items, setItems] = useState<Item[]>([
    { id: "1", name: "Apple", description: "Fresh red apples", quantity: 10 },
    { id: "2", name: "Banana", description: "Sweet yellow bananas", quantity: 15 },
    { id: "3", name: "Orange", description: "Juicy oranges", quantity: 8 },
    { id: "4", name: "Grapes", description: "Green seedless grapes", quantity: 20 },
    { id: "5", name: "Mango", description: "Tropical sweet mangoes", quantity: 5 },
  ]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false); // New state to track if adding new item

  const handleUpdateItem = (
    id: string,
    field: keyof Item,
    value: string | number
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
    toast.success(`Item ${field} updated!`);
  };

  const handleViewDetails = (item: Item) => {
    setSelectedItem(item);
    setIsAddingNewItem(false); // Not adding a new item when viewing details
    setIsDetailDialogOpen(true);
  };

  const handleSaveDetailChanges = (updatedItem: Item) => {
    if (isAddingNewItem) {
      // Generate a new ID for the new item
      const newId = (Math.max(0, ...items.map(item => parseInt(item.id))) + 1).toString();
      const newItemWithId = { ...updatedItem, id: newId };
      setItems((prevItems) => [...prevItems, newItemWithId]);
      toast.success("New item added!");
    } else {
      setItems((prevItems) =>
        prevItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
      toast.success("Item details saved!");
    }
  };

  const handleAddItem = () => {
    setSelectedItem(null); // Indicate a new item
    setIsAddingNewItem(true);
    setIsDetailDialogOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-center mb-6">
          Editable Grid List
        </h1>

        <div className="flex justify-end mb-4">
          <Button onClick={handleAddItem}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
          </Button>
        </div>

        <GridList
          items={items}
          onUpdateItem={handleUpdateItem}
          onViewDetails={handleViewDetails}
        />

        <DetailDialog
          item={selectedItem}
          isOpen={isDetailDialogOpen}
          onClose={() => setIsDetailDialogOpen(false)}
          onSave={handleSaveDetailChanges}
          isAddingNewItem={isAddingNewItem} // Pass this prop to DetailDialog
        />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;