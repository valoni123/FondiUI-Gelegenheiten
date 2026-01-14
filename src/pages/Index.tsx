import React, { useState, useEffect, useCallback } from "react";
import GridList from "@/components/GridList";
import DetailDialog from "@/components/DetailDialog";
import { Item } from "@/types";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { createItem, getOpportunities, updateItem } from "@/api/items";
import { getOpportunityStatusOptions } from "@/api/metadata";
import { getBusinessPartnerById } from "@/api/businessPartners";
import { CloudEnvironment } from "@/authorization/configLoader";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import RightPanel from "@/components/RightPanel";
import { getIdmEntities } from "@/api/idm";
import AppHeader from "@/components/AppHeader";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { refreshAccessToken, clearAuth } from "@/authorization/authService";

interface IndexProps {
  companyNumber: string;
  cloudEnvironment: CloudEnvironment;
}

const Index: React.FC<IndexProps> = ({ companyNumber, cloudEnvironment }) => {
  const [searchParams] = useSearchParams();
  const { opportunityId: paramOpportunityId } = useParams();
  const navigate = useNavigate();
  const urlOpportunityId = searchParams.get("opportunity");
  const effectiveOpportunityId = urlOpportunityId || paramOpportunityId || null;

  const [opportunities, setOpportunities] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [opportunityStatusOptions, setOpportunityStatusOptions] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(effectiveOpportunityId);
  const [idmEntityNames, setIdmEntityNames] = useState<string[]>([]);

  // New state for panel sizes
  const [leftPanelSize, setLeftPanelSize] = useState(100);
  const [rightPanelSize, setRightPanelSize] = useState(0);

  const loadOpportunities = useCallback(async (token: string, currentCompanyNumber: string, currentCloudEnvironment: CloudEnvironment, silent: boolean = false) => {
    if (!silent) {
      setIsLoadingOpportunities(true);
    }
    const startedAt = new Date();
    console.log(`[Opportunities] Reload gestartet um ${startedAt.toISOString()} (silent=${silent})`);
    const loadingToastId = !silent ? toast.loading("Loading opportunities...") : undefined;
    try {
      const fetchedOpportunities = await getOpportunities(token, currentCompanyNumber, currentCloudEnvironment);
      console.log(`[Opportunities] Reload erfolgreich (silent=${silent}) – ${fetchedOpportunities.length} Einträge geladen`);
      setOpportunities(fetchedOpportunities);
      if (!silent) {
        toast.success("Opportunities loaded successfully!", { id: loadingToastId });
      }
    } catch (error) {
      console.error(`[Opportunities] Reload fehlgeschlagen (silent=${silent})`, error);
      if (!silent) {
        toast.error("Failed to load opportunities.", { id: loadingToastId });
      } else {
        console.warn("Silent refresh failed:", error);
      }
    } finally {
      if (!silent) {
        setIsLoadingOpportunities(false);
      }
      console.log(`[Opportunities] Reload beendet um ${new Date().toISOString()} (silent=${silent})`);
    }
  }, []);

  useEffect(() => {
    const initWithLoginToken = async () => {
      try {
        let token = localStorage.getItem("oauthAccessToken");
        const expiresAt = Number(localStorage.getItem("oauthExpiresAt") || 0);
        const hasRefresh = !!localStorage.getItem("oauthRefreshToken");

        // Guard: if no token and no refresh, redirect immediately to login
        if (!token && !hasRefresh) {
          setIsAuthLoading(false);
          clearAuth();
          const target = `${window.location.pathname}${window.location.search || ""}`;
          // Use hard navigation for robustness inside iframes
          window.location.replace(`/login?redirect=${encodeURIComponent(target)}`);
          return;
        }

        // Silent refresh if expired and refresh token is available
        if ((!token || (expiresAt && Date.now() >= expiresAt)) && hasRefresh) {
          try {
            console.log("[Auth] Silent refresh during init...");
            token = await refreshAccessToken(cloudEnvironment);
          } catch (e) {
            console.warn("[Auth] Silent refresh failed during init.", e);
            // Hard redirect to login with error when refresh fails
            clearAuth();
            const target = `${window.location.pathname}${window.location.search || ""}`;
            window.location.replace(`/login?redirect=${encodeURIComponent(target)}&error=${encodeURIComponent("Token abgelaufen.")}`);
            return;
          }
        }

        if (!token) {
          setIsAuthLoading(false);
          return;
        }
        setAuthToken(token);

        const options = await getOpportunityStatusOptions(token, cloudEnvironment);
        setOpportunityStatusOptions(options);
        const entities = await getIdmEntities(token, cloudEnvironment);
        setIdmEntityNames(entities);

        if (!effectiveOpportunityId) {
          await loadOpportunities(token, companyNumber, cloudEnvironment, false);
        } else {
          setSelectedOpportunityId(effectiveOpportunityId);
          await loadOpportunities(token, companyNumber, cloudEnvironment, true);
        }
      } catch (error) {
        console.error("Initial data fetch failed:", error);
        toast.error("Fehler bei der Initialisierung: Daten konnten nicht geladen werden.");
      } finally {
        setIsAuthLoading(false);
      }
    };
    initWithLoginToken();
  }, [companyNumber, cloudEnvironment, loadOpportunities, effectiveOpportunityId]);

  useEffect(() => {
    if (authToken && companyNumber && cloudEnvironment && !effectiveOpportunityId) {
      const refreshInterval = setInterval(async () => {
        console.log(`[Opportunities] Silent Intervall-Reload um ${new Date().toISOString()}`);
        let token = localStorage.getItem("oauthAccessToken") || authToken;
        const expiresAt = Number(localStorage.getItem("oauthExpiresAt") || 0);
        const hasRefresh = !!localStorage.getItem("oauthRefreshToken");

        if (expiresAt && Date.now() >= expiresAt && hasRefresh) {
          try {
            console.log("[Auth] Silent refresh before interval reload...");
            token = await refreshAccessToken(cloudEnvironment);
            setAuthToken(token);
          } catch (e) {
            console.warn("[Auth] Silent refresh failed before interval reload.", e);
            // Clear all user-related info and redirect to login with error
            clearAuth();
            const target = `${window.location.pathname}${window.location.search || ""}`;
            navigate(`/login?redirect=${encodeURIComponent(target)}&error=${encodeURIComponent("Token abgelaufen.")}`, { replace: true });
            return;
          }
        }

        await loadOpportunities(token, companyNumber, cloudEnvironment, true);
      }, 10000);

      return () => clearInterval(refreshInterval);
    }
  }, [authToken, companyNumber, cloudEnvironment, loadOpportunities, effectiveOpportunityId, navigate]);

  // Effect to update panel sizes based on selectedOpportunityId
  useEffect(() => {
    if (selectedOpportunityId) {
      setLeftPanelSize(0); // Hide left panel when a specific opportunity is selected
      setRightPanelSize(100); // Right panel takes full width
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
      <div className="w-full px-4 space-y-6 flex flex-col flex-grow">
        <AppHeader />
        
        {/* REMOVED: Overview 'Neue Gelegenheit' button */}
        {/* <div className="flex justify-start gap-2 mb-4 flex-shrink-0">
          {!selectedOpportunityId && (
            <Button onClick={handleAddItem}>
              <PlusCircle className="mr-2 h-4 w-4" /> Neue Gelegenheit
            </Button>
          )}
        </div> */}

        <ResizablePanelGroup direction="horizontal" className="flex-grow">
          {selectedOpportunityId ? (
            <ResizablePanel 
              size={rightPanelSize}
              minSize={0}
              collapsible={true}
              collapsedSize={0}
            >
              <RightPanel
                selectedOpportunityId={selectedOpportunityId}
                onClose={async () => {
                  setSelectedOpportunityId(null);
                  let token = localStorage.getItem("oauthAccessToken") || authToken || "";
                  const expiresAt = Number(localStorage.getItem("oauthExpiresAt") || 0);
                  const hasRefresh = !!localStorage.getItem("oauthRefreshToken");

                  if (expiresAt && Date.now() >= expiresAt && hasRefresh) {
                    try {
                      console.log("[Auth] Silent refresh triggered by 'Zur Übersicht'...");
                      token = await refreshAccessToken(cloudEnvironment);
                      setAuthToken(token);
                    } catch (e) {
                      console.warn("[Auth] Silent refresh failed after 'Zur Übersicht'.", e);
                      // Clear all user-related info and redirect to login with error
                      clearAuth();
                      const target = `${window.location.pathname}${window.location.search || ""}`;
                      navigate(`/login?redirect=${encodeURIComponent(target)}&error=${encodeURIComponent("Token abgelaufen.")}`, { replace: true });
                      return;
                    }
                  }

                  if (token) {
                    await loadOpportunities(token, companyNumber, cloudEnvironment, true);
                  }
                }}
                authToken={authToken || ""}
                cloudEnvironment={cloudEnvironment}
                entityNames={idmEntityNames}
                selectedOpportunityProject={
                  opportunities.find((i) => i.id === selectedOpportunityId)?.Project
                }
              />
            </ResizablePanel>
          ) : (
            <ResizablePanel size={leftPanelSize} minSize={10}>
              <GridList
                items={effectiveOpportunityId ? [] : opportunities}
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
          )}
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