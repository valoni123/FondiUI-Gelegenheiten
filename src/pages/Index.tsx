import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import GridList from "@/components/GridList";
import DetailDialog from "@/components/DetailDialog";
import { Item } from "@/types";
import { toast } from "sonner";
import { createItem, getOpportunitiesWithCount, updateItem, getOpportunityById } from "@/api/items";
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
  const initInFlightRef = useRef(false);
  const initDoneRef = useRef(false);
  const needsOverviewReloadRef = useRef(false);

  const appHeaderRef = useRef<HTMLDivElement | null>(null);
  const [appHeaderHeight, setAppHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const el = appHeaderRef.current;
    if (!el) return;

    const measure = () => setAppHeaderHeight(el.offsetHeight);
    measure();

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const [searchParams] = useSearchParams();
  const { opportunityId: paramOpportunityId } = useParams();
  const navigate = useNavigate();
  const urlOpportunityId = searchParams.get("opportunity");
  const effectiveOpportunityId = paramOpportunityId || urlOpportunityId || null;

  const [opportunities, setOpportunities] = useState<Item[]>([]);
  const [opportunitiesTotalCount, setOpportunitiesTotalCount] = useState<number | null>(null);
  const [opportunitiesLoadError, setOpportunitiesLoadError] = useState<string | null>(null);
  // Server-side filter state (sent as OData $filter)
  const [opportunityFilters, setOpportunityFilters] = useState<Record<string, string>>({});
  const [opportunityOdataFilter, setOpportunityOdataFilter] = useState<string | undefined>(undefined);
  const [opportunitySortConfig, setOpportunitySortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
    key: "id",
    direction: "desc",
  });
  const [opportunityOrderBy, setOpportunityOrderBy] = useState<string | undefined>("Opportunity desc");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [opportunityStatusOptions, setOpportunityStatusOptions] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(effectiveOpportunityId);
  const [selectedOpportunityMeta, setSelectedOpportunityMeta] = useState<{ project?: string; artikel?: string; customer?: string; description?: string } | null>(null);
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

  // Ensure Project/Artikel are available even when the selected opportunity isn't part of the currently loaded list.
  useEffect(() => {
    if (!selectedOpportunityId) {
      setSelectedOpportunityMeta(null);
      return;
    }

    const fromList = opportunities.find((i) => i.id === selectedOpportunityId);
    const projectFromList = (fromList?.Project ?? "").toString().trim();
    const artikelFromList = (fromList?.Artikel ?? "").toString().trim();
    const customerFromList = ((fromList as any)?.Customer ?? "").toString().trim();
    const descriptionFromList = (fromList?.description ?? "").toString().trim();

    if (projectFromList || artikelFromList || customerFromList || descriptionFromList) {
      setSelectedOpportunityMeta({
        project: fromList?.Project,
        artikel: fromList?.Artikel,
        customer: (fromList as any)?.Customer,
        description: fromList?.description,
      });
      return;
    }

    if (!authToken) return;

    let cancelled = false;
    (async () => {
      try {
        const full = await getOpportunityById(authToken, companyNumber, cloudEnvironment, selectedOpportunityId);
        if (cancelled) return;
        setSelectedOpportunityMeta({
          project: (full as any)?.Project != null ? String((full as any).Project) : undefined,
          artikel: (full as any)?.Artikel != null ? String((full as any).Artikel) : undefined,
          customer: (full as any)?.Customer != null ? String((full as any).Customer) : undefined,
          description: full?.description != null ? String(full.description) : undefined,
        });
      } catch {
        if (!cancelled) setSelectedOpportunityMeta({ project: undefined, artikel: undefined, customer: undefined, description: undefined });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedOpportunityId, opportunities, authToken, companyNumber, cloudEnvironment]);

  const mapGridKeyToOrderByField = useCallback((key: string) => {
    // Map visible grid keys to LN API $orderby values.
    if (key === "id") return "Opportunity";
    if (key === "description") return "Description";
    if (key === "Project") return "Project";
    if (key === "Artikel") return "Artikel";
    if (key === "Customer") return "Customer";
    if (key === "PartNoOriginalRequest") return "PartNoOriginalRequest";
    if (key === "DrawingNoOriginalRequest") return "DrawingNoOriginalRequest";
    return null;
  }, []);

  const buildOpportunityODataFilter = useCallback((filters: Record<string, string>): string | undefined => {
    const escapeODataString = (v: string) => v.replace(/'/g, "''");

    const mapKeyToODataField = (key: string): string | null => {
      if (key === "id") return "Opportunity";
      if (key === "description") return "Description";
      if (key === "Project") return "Project";
      if (key === "Artikel") return "Artikel";
      if (key === "Customer") return "Customer";
      if (key === "PartNoOriginalRequest") return "PartNoOriginalRequest";
      if (key === "DrawingNoOriginalRequest") return "DrawingNoOriginalRequest";
      return null;
    };

    const clauses: string[] = [];
    for (const [key, raw] of Object.entries(filters)) {
      const value = (raw || "").trim();
      if (!value) continue;
      const field = mapKeyToODataField(key);
      if (!field) continue;

      const safe = escapeODataString(value);

      // Infor LN does not support substringof() on this endpoint.
      // Prefer OData v4-style contains(...) for "contains" semantics.
      clauses.push(`contains(${field},'${safe}')`);
    }

    if (clauses.length === 0) return undefined;
    return clauses.join(" and ");
  }, []);

  const loadOpportunities = useCallback(
    async (
      token: string,
      currentCompanyNumber: string,
      currentCloudEnvironment: CloudEnvironment,
      silent: boolean = false,
      odataFilter?: string,
      orderBy?: string
    ) => {
      if (!silent) {
        setIsLoadingOpportunities(true);
      }
      setOpportunitiesLoadError(null);
      const loadingToastId = !silent ? toast.loading("Loading opportunities...") : undefined;
      try {
        const res = await getOpportunitiesWithCount(token, currentCompanyNumber, currentCloudEnvironment, {
          top: 100,
          filter: odataFilter,
          orderBy,
          select: "*",
        });
        setOpportunities(res.items);
        setOpportunitiesTotalCount(res.totalCount);
        if (!silent) {
          toast.success("Gelegenheiten erfolgreich geladen!", { id: loadingToastId });
        }
      } catch (error) {
        console.error(`[Opportunities] Reload fehlgeschlagen (silent=${silent})`, error);
        setOpportunitiesLoadError(error instanceof Error ? error.message : String(error));
        setOpportunitiesTotalCount(null);
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
    },
    []
  );

  useEffect(() => {
    const initWithLoginToken = async () => {
      if (initDoneRef.current || initInFlightRef.current) return;
      initInFlightRef.current = true;

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

        try {
          const options = await getOpportunityStatusOptions(token, cloudEnvironment);
          setOpportunityStatusOptions(options);
        } catch (e) {
          console.warn("[Metadata] OpportunityStatus konnte nicht geladen werden; fahre ohne Status-Optionen fort.", e);
          setOpportunityStatusOptions([]);
        }

        // Load entity infos and filter by desc starting with "*"
        const infos = await getIdmEntityInfos(token, cloudEnvironment);
        const filtered = (infos || []).filter((i) => (i.desc || "").trim().startsWith("*"));
        setIdmEntityNames(filtered.map((i) => i.name));
        setIdmEntityOptions(filtered.map((i) => ({ name: i.name, desc: i.desc })));

        if (!effectiveOpportunityId) {
          await loadOpportunities(token, companyNumber, cloudEnvironment, false, opportunityOdataFilter, opportunityOrderBy);
        } else {
          setSelectedOpportunityId(effectiveOpportunityId);
          await loadOpportunities(token, companyNumber, cloudEnvironment, true, opportunityOdataFilter, opportunityOrderBy);
        }

        initDoneRef.current = true;
      } catch (error) {
        console.error("Initial data fetch failed:", error);
        toast.error("Fehler bei der Initialisierung: Daten konnten nicht geladen werden.");
      } finally {
        initInFlightRef.current = false;
        setIsAuthLoading(false);
      }
    };
    initWithLoginToken();
  }, [companyNumber, cloudEnvironment, loadOpportunities, effectiveOpportunityId, opportunityOdataFilter, opportunityOrderBy]);

  // When coming back from detail view to overview, refresh opportunities once without showing stale content.
  useEffect(() => {
    if (!authToken) return;
    if (effectiveOpportunityId) return;
    if (!needsOverviewReloadRef.current) return;

    let cancelled = false;
    const run = async () => {
      let token = localStorage.getItem("oauthAccessToken") || authToken;
      const expiresAt = Number(localStorage.getItem("oauthExpiresAt") || 0);
      const hasRefresh = !!localStorage.getItem("oauthRefreshToken");

      if (expiresAt && Date.now() >= expiresAt && hasRefresh) {
        try {
          token = await refreshAccessToken(cloudEnvironment);
          setAuthToken(token);
        } catch (e) {
          clearAuth();
          const target = `${window.location.pathname}${window.location.search || ""}`;
          navigate(
            `/login?redirect=${encodeURIComponent(target)}&error=${encodeURIComponent("Token abgelaufen.")}`,
            { replace: true }
          );
          if (!cancelled) setIsLoadingOpportunities(false);
          return;
        }
      }

      await loadOpportunities(token, companyNumber, cloudEnvironment, true, opportunityOdataFilter, opportunityOrderBy);
      if (cancelled) return;
      needsOverviewReloadRef.current = false;
      setIsLoadingOpportunities(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [authToken, effectiveOpportunityId, companyNumber, cloudEnvironment, loadOpportunities, navigate, opportunityOdataFilter, opportunityOrderBy]);

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

        await loadOpportunities(token, companyNumber, cloudEnvironment, true, opportunityOdataFilter, opportunityOrderBy);
      }, 10000);

      return () => clearInterval(refreshInterval);
    }
  }, [authToken, companyNumber, cloudEnvironment, loadOpportunities, effectiveOpportunityId, navigate, opportunityOdataFilter, opportunityOrderBy]);

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

  const handleSortChange = useCallback(
    async (next: { key: string; direction: "asc" | "desc" } | null) => {
      setOpportunitySortConfig(next);

      const field = next ? mapGridKeyToOrderByField(next.key) : null;
      const orderBy = next && field ? `${field}${next.direction === "desc" ? " desc" : ""}` : undefined;
      setOpportunityOrderBy(orderBy);

      if (!authToken) return;
      await loadOpportunities(authToken, companyNumber, cloudEnvironment, false, opportunityOdataFilter, orderBy);
    },
    [authToken, companyNumber, cloudEnvironment, loadOpportunities, mapGridKeyToOrderByField, opportunityOdataFilter]
  );

  const handleCommitOpportunityFilters = useCallback(
    async (filters: Record<string, string>) => {
      setOpportunityFilters(filters);
      const odataFilter = buildOpportunityODataFilter(filters);
      setOpportunityOdataFilter(odataFilter);

      if (!authToken) return;
      await loadOpportunities(authToken, companyNumber, cloudEnvironment, false, odataFilter, opportunityOrderBy);
    },
    [authToken, buildOpportunityODataFilter, loadOpportunities, companyNumber, cloudEnvironment, opportunityOrderBy]
  );

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
        <p>Authentifizierung und Initialdaten werden geladen …</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col items-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
      <div className="w-full px-4 flex flex-col flex-grow min-h-0 overflow-hidden">
        <div
          ref={appHeaderRef}
          className={!selectedOpportunityId ? "sticky top-0 z-50" : undefined}
        >
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
        </div>

        {!selectedOpportunityId && opportunitiesLoadError && !isLoadingOpportunities ? (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-900 px-4 py-3">
            <div className="text-sm font-medium">Gelegenheiten konnten nicht geladen werden.</div>
            <div className="mt-1 text-xs opacity-90 break-words">{opportunitiesLoadError}</div>
            <div className="mt-3">
              <button
                className="text-xs underline"
                onClick={() => {
                  const token = localStorage.getItem("oauthAccessToken") || authToken;
                  if (!token) return;
                  loadOpportunities(token, companyNumber, cloudEnvironment, false, opportunityOdataFilter, opportunityOrderBy);
                }}
              >
                Erneut laden
              </button>
            </div>
          </div>
        ) : null}

        <ResizablePanelGroup direction="horizontal" className="flex-1 mt-0 min-h-0">
          {selectedOpportunityId ? (
            <ResizablePanel
              size={rightPanelSize}
              minSize={0}
              collapsible={true}
              collapsedSize={0}
              className="min-h-0"
            >
              <RightPanel
                selectedOpportunityId={selectedOpportunityId}
                onClose={async () => {
                  // Hide stale list content while returning; the actual reload is triggered by an effect after navigation.
                  needsOverviewReloadRef.current = true;
                  setIsLoadingOpportunities(true);
                  handleSelectOpportunity(null);
                }}
                authToken={authToken || ""}
                cloudEnvironment={cloudEnvironment}
                entityNames={idmEntityNames}
                entityOptions={idmEntityOptions}
                selectedOpportunityProject={
                  opportunities.find((i) => i.id === selectedOpportunityId)?.Project ?? selectedOpportunityMeta?.project
                }
                selectedOpportunityArticle={
                  opportunities.find((i) => i.id === selectedOpportunityId)?.Artikel ?? selectedOpportunityMeta?.artikel
                }
                selectedOpportunityCustomer={
                  (opportunities.find((i) => i.id === selectedOpportunityId) as any)?.Customer ?? selectedOpportunityMeta?.customer
                }
                selectedOpportunityDescription={
                  opportunities.find((i) => i.id === selectedOpportunityId)?.description ?? selectedOpportunityMeta?.description
                }
              />
            </ResizablePanel>
          ) : (
            <ResizablePanel size={leftPanelSize} minSize={10} className="min-h-0">
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
                filters={opportunityFilters}
                onCommitFilters={handleCommitOpportunityFilters}
                sortConfig={opportunitySortConfig}
                onSortChange={handleSortChange}
                totalCount={opportunitiesTotalCount}
                showTopBorder={false}
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