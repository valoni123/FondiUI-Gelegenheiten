import React, { useState } from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import GridList from "@/components/GridList";
import DetailDialog from "@/components/DetailDialog";
import { Item } from "@/types";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { createItem } from "@/api/items"; // Import the new API function

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
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);

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
    setIsAddingNewItem(false);
    setIsDetailDialogOpen(true);
  };

  const handleSaveDetailChanges = async (updatedItem: Item) => {
    if (isAddingNewItem) {
      const loadingToastId = toast.loading("Adding new item...");
      try {
        // Call the simulated API to create the item
        const newItem = await createItem(updatedItem);
        setItems((prevItems) => [...prevItems, newItem]);
        toast.success("New item added!", { id: loadingToastId });
      } catch (error) {
        console.error("Failed to add new item:", error);
        toast.error("Failed to add item.", { id: loadingToastId });
      }
    } else {
      setItems((prevItems) =>
        prevItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
      toast.success("Item details saved!");
    }
  };

  const handleAddItem = () => {
    setSelectedItem(null);
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
          isAddingNewItem={isAddingNewItem}
        />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;