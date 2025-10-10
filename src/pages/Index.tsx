import React, { useState, useEffect } from "react";
import GridList from "@/components/GridList";
import DetailDialog from "@/components/DetailDialog";
import { Item } from "@/types";
import { Button } from "@/components/ui/button";
import { PlusCircle, List } from "lucide-react";
import { toast } from "sonner";
import { createItem, getOpportunities } from "@/api/items";
import { getOpportunityStatusOptions } from "@/api/metadata";
import { getAccessToken, getCompanyNumber } from "@/authorization/authService"; // Import auth service

const Index = () => {
  const [localItems, setLocalItems] = useState<Item[]>([
    { id: "1", name: "Apple", description: "Fresh red apples", quantity: 10 },
    { id: "2", name: "Banana", description: "Sweet yellow bananas", quantity: 15 },
    { id: "3", name: "Orange", description: "Juicy oranges", quantity: 8 },
    { id: "4", name: "Grapes", description: "Green seedless grapes", quantity: 20 },
    { id: "5", name: "Mango", description: "Tropical sweet mangoes", quantity: 5 },
  ]);
  const [opportunities, setOpportunities] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [opportunityStatusOptions, setOpportunityStatusOptions] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const companyNumber = getCompanyNumber(); // Get company number from auth service

  useEffect(() => {
    const authenticateAndLoadOptions = async () => {
      try {
        const token = await getAccessToken();
        setAuthToken(token);
        const options = await getOpportunityStatusOptions(token);
        setOpportunityStatusOptions(options);
      } catch (error) {
        console.error("Authentication or metadata fetch failed:", error);
        toast.error("Failed to initialize application: Could not get auth token or status options.");
      } finally {
        setIsAuthLoading(false);
      }
    };
    authenticateAndLoadOptions();
  }, []);

  const handleUpdateItem = (
    id: string,
    field: string,
    value: string | number
  ) => {
    setLocalItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
    toast.success(`Local item ${field} updated!`);
  };

  const handleViewDetails = (item: Item) => {
    setSelectedItem(item);
    setIsAddingNewItem(false);
    setIsDetailDialogOpen(true);
  };

  const handleSaveDetailChanges = async (updatedItem: Item) => {
    if (!authToken) {
      toast.error("Authentication token not available. Please refresh the page.");
      return;
    }

    if (isAddingNewItem) {
      const loadingToastId = toast.loading("Adding new item...");
      try {
        const newItem = await createItem(updatedItem, authToken, companyNumber);
        setLocalItems((prevItems) => [...prevItems, newItem]);
        toast.success("New item added!", { id: loadingToastId });
      } catch (error) {
        console.error("Failed to add new item:", error);
        toast.error("Failed to add item.", { id: loadingToastId });
      }
    } else {
      setLocalItems((prevItems) =>
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

  const handleLoadOpportunities = async () => {
    if (!authToken) {
      toast.error("Authentication token not available. Please refresh the page.");
      return;
    }

    setIsLoadingOpportunities(true);
    const loadingToastId = toast.loading("Loading opportunities...");
    try {
      const fetchedOpportunities = await getOpportunities(authToken, companyNumber);
      setOpportunities(fetchedOpportunities);
      toast.success("Opportunities loaded successfully!", { id: loadingToastId });
    } catch (error) {
      console.error("Failed to load opportunities:", error);
      toast.error("Failed to load opportunities.", { id: loadingToastId });
    } finally {
      setIsLoadingOpportunities(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
        <p>Loading authentication and initial data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-center mb-6">
          Editable Grid List
        </h1>

        <div className="flex justify-end gap-2 mb-4">
          <Button onClick={handleAddItem}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
          </Button>
          <Button onClick={handleLoadOpportunities} disabled={isLoadingOpportunities || !authToken}>
            <List className="mr-2 h-4 w-4" /> {isLoadingOpportunities ? "Loading..." : "Show Opportunities"}
          </Button>
        </div>

        <h2 className="text-2xl font-semibold mb-4">Local Items</h2>
        <GridList
          items={localItems}
          onUpdateItem={handleUpdateItem}
          onViewDetails={handleViewDetails}
          opportunityStatusOptions={opportunityStatusOptions}
        />

        {opportunities.length > 0 && (
          <>
            <h2 className="text-2xl font-semibold mt-8 mb-4">Fetched Opportunities</h2>
            <GridList
              items={opportunities}
              onUpdateItem={() => toast.info("Opportunities from API are read-only in this view.")}
              onViewDetails={handleViewDetails}
              opportunityStatusOptions={opportunityStatusOptions}
            />
          </>
        )}

        <DetailDialog
          item={selectedItem}
          isOpen={isDetailDialogOpen}
          onClose={() => setIsDetailDialogOpen(false)}
          onSave={handleSaveDetailChanges}
          isAddingNewItem={isAddingNewItem}
          opportunityStatusOptions={opportunityStatusOptions}
        />
      </div>
    </div>
  );
};

export default Index;