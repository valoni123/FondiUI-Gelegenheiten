import React, { useState, useEffect, useCallback } from "react";
import GridList from "@/components/GridList";
import DetailDialog from "@/components/DetailDialog";
import { Item } from "@/types";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { createItem, getOpportunities, updateItem } from "@/api/items"; // Import updateItem
import { getOpportunityStatusOptions } from "@/api/metadata";
import { getAccessToken, getCompanyNumber } from "@/authorization/authService";

const Index = () => {
  const [opportunities, setOpportunities] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [opportunityStatusOptions, setOpportunityStatusOptions] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const companyNumber = getCompanyNumber();

  const loadOpportunities = useCallback(async (token: string) => {
    setIsLoadingOpportunities(true);
    const loadingToastId = toast.loading("Loading opportunities...");
    try {
      const fetchedOpportunities = await getOpportunities(token, companyNumber);
      setOpportunities(fetchedOpportunities);
      toast.success("Opportunities loaded successfully!", { id: loadingToastId });
    } catch (error) {
      console.error("Failed to load opportunities:", error);
      toast.error("Failed to load opportunities.", { id: loadingToastId });
    } finally {
      setIsLoadingOpportunities(false);
    }
  }, [companyNumber]);

  useEffect(() => {
    const authenticateAndLoadData = async () => {
      try {
        const token = await getAccessToken();
        setAuthToken(token);
        const options = await getOpportunityStatusOptions(token);
        setOpportunityStatusOptions(options);
        await loadOpportunities(token); // Automatically load opportunities
      } catch (error) {
        console.error("Authentication or data fetch failed:", error);
        toast.error("Failed to initialize application: Could not get auth token or data.");
      } finally {
        setIsAuthLoading(false);
      }
    };
    authenticateAndLoadData();
  }, [loadOpportunities]);

  const handleUpdateItem = async (
    id: string,
    field: string,
    value: string | number
  ) => {
    if (!authToken) {
      toast.error("Authentication token not available. Please refresh the page.");
      return;
    }

    const itemToUpdate = opportunities.find((item) => item.id === id);
    if (!itemToUpdate) {
      toast.error("Item not found for update.");
      return;
    }

    const updatedItem = { ...itemToUpdate, [field]: value };
    const loadingToastId = toast.loading(`Updating item ${field}...`);
    try {
      await updateItem(updatedItem, authToken, companyNumber);
      setOpportunities((prevItems) =>
        prevItems.map((item) =>
          item.id === id ? updatedItem : item
        )
      );
      toast.success(`Item ${field} updated!`, { id: loadingToastId });
    } catch (error) {
      console.error(`Failed to update item ${field}:`, error);
      toast.error(`Failed to update item ${field}.`, { id: loadingToastId });
    }
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
        setOpportunities((prevItems) => [...prevItems, newItem]);
        toast.success("New item added!", { id: loadingToastId });
      } catch (error) {
        console.error("Failed to add new item:", error);
        toast.error("Failed to add item.", { id: loadingToastId });
      }
    } else {
      const loadingToastId = toast.loading("Saving item changes...");
      try {
        await updateItem(updatedItem, authToken, companyNumber);
        setOpportunities((prevItems) =>
          prevItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        );
        toast.success("Item details saved!", { id: loadingToastId });
      } catch (error) {
        console.error("Failed to save item changes:", error);
        toast.error("Failed to save item changes.", { id: loadingToastId });
      }
    }
  };

  const handleAddItem = () => {
    setSelectedItem(null);
    setIsAddingNewItem(true);
    setIsDetailDialogOpen(true);
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
          Opportunity List
        </h1>

        <div className="flex justify-end gap-2 mb-4">
          <Button onClick={handleAddItem}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Opportunity
          </Button>
        </div>

        <h2 className="text-2xl font-semibold mb-4">Fetched Opportunities</h2>
        <GridList
          items={opportunities}
          onUpdateItem={handleUpdateItem}
          onViewDetails={handleViewDetails}
          opportunityStatusOptions={opportunityStatusOptions}
        />

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