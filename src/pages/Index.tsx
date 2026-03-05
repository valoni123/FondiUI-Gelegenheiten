import React, { useState, useEffect, useCallback } from "react";
import GridList from "@/components/GridList";
import DetailDialog from "@/components/DetailDialog";
import { Item } from "@/types";
import { toast } from "sonner";
import { createItem, getOpportunities, updateItem } from "@/api/items";
import { getOpportunityStatusOptions } from "@/api/metadata";
import { getBusinessPartnerById } from "@/api/businessPartners";
import { CloudEnvironment } from "@/authorization/configLoader";
import {
  ResizablePanelGroup,
  ResizablePanel,
} from "@/components/ui/resizable";
import RightPanel from "@/components/RightPanel";
import { getIdmEntityInfos } from "@/api/idm";
import AppHeader from "@/components/AppHeader";
import UserStatus from "@/components/UserStatus";
import SettingsButton from "@/components/SettingsButton";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { refreshAccessToken, clearAuth } from "@/authorization/authService";

interface IndexProps {
  companyNumber: string;
  cloudEnvironment: CloudEnvironment;
  isAuthenticated: boolean;
  onSaveCompanyNumber: (newCompanyNumber: string) => void;
  onSaveCloudEnvironment: (newEnvironment: CloudEnvironment) => void;
}

const Index: React.FC<IndexProps> = ({
  companyNumber,
  cloudEnvironment,
  isAuthenticated,
  onSaveCompanyNumber,
  onSaveCloudEnvironment,
}) => {
  const [searchParams] = useSearchParams();
  const { opportunityId: paramOpportunityId } = useParams();
  const navigate = useNavigate();
  const urlOpportunityId = searchParams.get("opportunity");
  const effectiveOpportunityId = paramOpportunityId || urlOpportunityId || null;

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
  // NEW: store name+desc for dropdown display
  const [idmEntityOptions, setIdmEntityOptions] = useState<{ name: string; desc: string }[]>([]);

  // New state for panel sizes
  const [leftPanelSize, setLeftPanelSize] = useState(100);
  const [rightPanelSize, setRightPanelSize] = useState(0);

  // Keep UI selection in sync with the URL (deep-linking / unique URLs)
  useEffect(() => {
    setSelectedOpportunityId(effectiveOpportunityId);
  }, [effectiveOpportunityId]);

  const loadOpportunities = useCallback(async (token: string, currentCompanyNumber: string, currentCloudEnvironment: CloudEnvironment, silent: boolean = false) => {
    if (!silent) {
      setIsLoadingOpportunities(true);
    }
    const loadingToastId = !silent ? toast.loading("Loading opportunities...") : undefined;
    try {
      const fetchedOpportunities = await getOpportunities(token, currentCompanyNumber, currentCloudEnvironment);
      setOpportunities(fetchedOpportunities);
      if (!silent) {
        toast.success("Gelegenheiten erfolgreich geladen!", { id: loadingToastId });
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

        // Load entity infos and filter by desc starting with "*"
        const infos = await getIdmEntityInfos(token, cloudEnvironment);
        const filtered = (infos || []).filter((i) => (i.desc || "").trim().startsWith("*"));
        setIdmEntityNames(filtered.map((i) => i.name));
        setIdmEntityOptions(filtered.map((i) => ({ name: i.name, desc: i.desc })));

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
        let token = localStorage.getItem("oauthAccessToken") || authToken;
        const expiresAt = Number(localStorage.getItem("oauthExpiresAt") || 0);
        const hasRefresh = !!localStorage.getItem("oauthRefreshToken");

        if (expiresAt && Date.now() >= expiresAt && hasRefresh) {
          try {
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

  const handleSelectOpportunity = (opportunityId: string | null) => {
    if (opportunityId) {
      navigate(`/opportunity/${encodeURIComponent(opportunityId)}`);
    } else {
      navigate(`/opportunities`);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
        <p>Authentifizierung und Initialdaten werden geladen …</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
      <div className="w-full px-4 flex flex-col flex-grow">
        <AppHeader
          rightContent={
            <>
              <UserStatus isAuthenticated={isAuthenticated} cloudEnvironment={cloudEnvironment} />
              <SettingsButton
                currentCompanyNumber={companyNumber}
                onSaveCompanyNumber={onSaveCompanyNumber}
                currentCloudEnvironment={cloudEnvironment}
                onSaveCloudEnvironment={onSaveCloudEnvironment}
              />
            </>
          }
        />
        
        {/* REMOVED: Overview 'Neue Gelegenheit' button */}
        {/* <div className="flex justify-start gap-2 mb-4 flex-shrink-0">
          {!selectedOpportunityId && (
            <Button onClick={handleAddItem}>
              <PlusCircle className="mr-2 h-4 w-4" /> Neue Gelegenheit
            </Button>
          )}
        </div> */}

        <ResizablePanelGroup direction="horizontal" className="flex-grow mt-0">
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
                  // When going back to overview, hide stale list content and show only the loading state
                  setOpportunities([]);
                  setIsLoadingOpportunities(true);
                  handleSelectOpportunity(null);

                  let token = localStorage.getItem("oauthAccessToken") || authToken || "";
                  const expiresAt = Number(localStorage.getItem("oauthExpiresAt") || 0);
                  const hasRefresh = !!localStorage.getItem("oauthRefreshToken");

                  if (expiresAt && Date.now() >= expiresAt && hasRefresh) {
                    try {
                      token = await refreshAccessToken(cloudEnvironment);
                      setAuthToken(token);
                    } catch (e) {
                      clearAuth();
                      const target = `${window.location.pathname}${window.location.search || ""}`;
                      navigate(`/login?redirect=${encodeURIComponent(target)}&error=${encodeURIComponent("Token abgelaufen.")}`, { replace: true });
                      setIsLoadingOpportunities(false);
                      return;
                    }
                  }

                  if (token) {
                    // silent fetch (no toast), we control the spinner ourselves
                    await loadOpportunities(token, companyNumber, cloudEnvironment, true);
                  }

                  setIsLoadingOpportunities(false);
                }}
                authToken={authToken || ""}
                cloudEnvironment={cloudEnvironment}
                entityNames={idmEntityNames}
                entityOptions={idmEntityOptions}
                selectedOpportunityProject={
                  opportunities.find((i) => i.id === selectedOpportunityId)?.Project
                }
                selectedOpportunityArticle={
                  opportunities.find((i) => i.id === selectedOpportunityId)?.Artikel
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
                isLoading={isLoadingOpportunities}
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