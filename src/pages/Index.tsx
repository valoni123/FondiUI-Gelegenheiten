import React, { useState, useEffect, useCallback } from "react";
import GridList from "@/components/GridList";
import DetailDialog from "@/components/DetailDialog";
import { Item } from "@/types";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { createItem, getOpportunities, updateItem } from "@/api/items";
import { getOpportunityStatusOptions } from "@/api/metadata";
import { getAccessToken } from "@/authorization/authService";
import { getBusinessPartnerById } from "@/api/businessPartners";
import { CloudEnvironment } from "@/authorization/configLoader";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"; // Import Resizable components
import RightPanel from "@/components/RightPanel"; // Import the new RightPanel

interface IndexProps {
  companyNumber: string;
  cloudEnvironment: CloudEnvironment;
}

const Index: React.FC<IndexProps> = ({ companyNumber, cloudEnvironment }) => {
  const [opportunities, setOpportunities] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [opportunityStatusOptions, setOpportunityStatusOptions] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [leftPanelSize, setLeftPanelSize] = useState<number>(100);
  const [rightPanelSize, setRightPanelSize] = useState<number>(0);

  const loadOpportunities = useCallback(async (token: string, currentCompanyNumber: string, currentCloudEnvironment: CloudEnvironment, silent: boolean = false) => {
    if (!silent) {
      setIsLoadingOpportunities(true);
    }
    const loadingToastId = !silent ? toast.loading("Loading opportunities...") : undefined;
    try {
      const fetchedOpportunities = await getOpportunities(token, currentCompanyNumber, currentCloudEnvironment);
      setOpportunities(fetchedOpportunities);
      if (!silent) {
        toast.success("Opportunities loaded successfully!", { id: loadingToastId });
      }
    } catch (error) {
      console.error("Failed to load opportunities:", error);
      if (!silent) {
        toast.error("Failed to load opportunities.", { id: loadingToastId });
      } else {
        console.warn("Silent refresh failed:", error);
      }
    } finally {
      if (!silent) {
        setIsLoadingOpportunities(false);
      }
    }
  }, []);

  useEffect(() => {
    const authenticateAndLoadData = async () => {
      try {
        const token = await getAccessToken(companyNumber, cloudEnvironment);
        setAuthToken(token);
        const options = await getOpportunityStatusOptions(token, cloudEnvironment);
        setOpportunityStatusOptions(options);
        await loadOpportunities(token, companyNumber, cloudEnvironment, false);
      } catch (error) {
        console.error("Authentication or initial data fetch failed:", error);
        toast.error("Failed to initialize application: Could not get auth token or data.");
      } finally {
        setIsAuthLoading(false);
      }
    };
    authenticateAndLoadData();
  }, [companyNumber, cloudEnvironment, loadOpportunities]);

  useEffect(() => {
    if (authToken && companyNumber && cloudEnvironment) {
      const refreshInterval = setInterval(() => {
        console.log("Performing silent opportunities refresh...");
        loadOpportunities(authToken, companyNumber, cloudEnvironment, true);
      }, 30000);

      return () => clearInterval(refreshInterval);
    }
  }, [authToken, companyNumber, cloudEnvironment, loadOpportunities]);

  // Effect to manage panel sizes based on selectedOpportunityId
  useEffect(() => {
    if (selectedOpportunityId) {
      setLeftPanelSize(70);
      setRightPanelSize(30);
    } else {
      setLeftPanelSize(100);
      setRightPanelSize(0);
    }
  }, [selectedOpportunityId]);

  const handleUpdateItem = async (
    id: string,
    field: string,
    value: string | number | boolean
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

    let updatedItem = { ...itemToUpdate, [field]: value };

    const loadingToastId = toast.loading(`Updating item ${field}...`);

    try {
      if (field === "SoldtoBusinessPartner") {
        await updateItem(updatedItem, authToken, companyNumber, cloudEnvironment);

        const businessPartnerId = String(value);
        const bpDetails = businessPartnerId
          ? await getBusinessPartnerById(authToken, businessPartnerId, companyNumber, cloudEnvironment)
          : null;

        updatedItem = {
          ...updatedItem,
          SoldtoBusinessPartner: businessPartnerId,
          SoldtoBusinessPartnerName: bpDetails?.Name || "",
          SoldtoBusinessPartnerStreet: bpDetails?.AddressRef?.Street || "",
          SoldtoBusinessPartnerHouseNumber: bpDetails?.AddressRef?.HouseNumber || "",
          SoldtoBusinessPartnerZIPCodePostalCode: bpDetails?.AddressRef?.ZIPCodePostalCode || "",
          SoldtoBusinessPartnerCountry: bpDetails?.AddressRef?.Country || "",
        };
        toast.success("Business Partner updated!", { id: loadingToastId });
      } else {
        await updateItem(updatedItem, authToken, companyNumber, cloudEnvironment);
        toast.success(`Item ${field} updated!`, { id: loadingToastId });
      }

      setOpportunities((prevItems) =>
        prevItems.map((item) =>
          item.id === id ? updatedItem : item
        )
      );
    } catch (error: any) {
      console.error(`Failed to update item ${field}:`, error);
      toast.error(error.message || `Failed to update item ${field}.`, { id: loadingToastId });
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

    const loadingToastId = toast.loading(isAddingNewItem ? "Adding new item..." : "Saving item changes...");
    try {
      if (isAddingNewItem) {
        const newItem = await createItem(updatedItem, authToken, companyNumber, cloudEnvironment);
        setOpportunities((prevItems) => [...prevItems, newItem]);
        toast.success("New item added!", { id: loadingToastId });
      } else {
        await updateItem(updatedItem, authToken, companyNumber, cloudEnvironment);
        setOpportunities((prevItems) =>
          prevItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        );
        toast.success("Item details saved!", { id: loadingToastId });
      }
      setIsDetailDialogOpen(false);
    } catch (error: any) {
      console.error("Failed to save item changes:", error);
      toast.error(error.message || "Failed to save item changes.", { id: loadingToastId });
    }
  };

  const handleAddItem = () => {
    setSelectedItem(null);
    setIsAddingNewItem(true);
    setIsDetailDialogOpen(true);
  };

  const handleSelectOpportunity = (opportunityId: string | null) => {
    setSelectedOpportunityId(opportunityId);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
        <p>Loading authentication and initial data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
      <div className="w-full px-4 space-y-6 flex flex-col flex-grow"> {/* Added flex-grow */}
        <h1 className="text-4xl font-bold text-center mb-6">
          Gelegenheiten
        </h1>

        <div className="flex justify-start gap-2 mb-4 flex-shrink-0"> {/* Added flex-shrink-0 */}
          <Button onClick={handleAddItem}>
            <PlusCircle className="mr-2 h-4 w-4" /> Neue Gelegenheit
          </Button>
        </div>

        <ResizablePanelGroup direction="horizontal" className="flex-grow">
          <ResizablePanel size={leftPanelSize} onResize={setLeftPanelSize} minSize={50}>
            <GridList
              items={opportunities}
              onUpdateItem={handleUpdateItem}
              onViewDetails={handleViewDetails}
              opportunityStatusOptions={opportunityStatusOptions}
              authToken={authToken || ""}
              companyNumber={companyNumber}
              cloudEnvironment={cloudEnvironment}
              selectedOpportunityId={selectedOpportunityId}
              onSelectOpportunity={handleSelectOpportunity}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel size={rightPanelSize} onResize={setRightPanelSize} minSize={0} collapsible={true} collapsedSize={0}>
            {selectedOpportunityId && <RightPanel selectedOpportunityId={selectedOpportunityId} />}
          </ResizablePanel>
        </ResizablePanelGroup>

        <DetailDialog
          item={selectedItem}
          isOpen={isDetailDialogOpen}
          onClose={() => setIsDetailDialogOpen(false)}
          onSave={handleSaveDetailChanges}
          isAddingNewItem={isAddingNewItem}
          opportunityStatusOptions={opportunityStatusOptions}
          authToken={authToken || ""}
          companyNumber={companyNumber}
          cloudEnvironment={cloudEnvironment}
        />
      </div>
    </div>
  );
};

export default Index;