import { Item } from "@/types";
import { getApiBaseUrl, CloudEnvironment } from "@/authorization/configLoader";

const preparePayload = (itemData: Item): Record<string, any> => {
  const payload: Record<string, any> = {};
  const itemDataCopy = { ...itemData };
  delete itemDataCopy["tdsmi110.text"];

  payload.Description = String(itemDataCopy.description || "");
  payload.OpportunityText = String(itemDataCopy.opportunityText || "");
  payload.Name = String(itemDataCopy.name || "");
  
  if (itemDataCopy.SoldtoBusinessPartner) payload.SoldtoBusinessPartner = String(itemDataCopy.SoldtoBusinessPartner);
  if (itemDataCopy.Status) payload.Status = String(itemDataCopy.Status);
  
  payload.IncludeInForecast = itemDataCopy.IncludeInForecast ? "Yes" : "No";

  payload.ProbabilityPercentage = itemDataCopy.ProbabilityPercentage ?? 0;
  payload.ExpectedRevenue = itemDataCopy.ExpectedRevenue ?? 0;
  if (itemDataCopy.Source) payload.Source = String(itemDataCopy.Source);
  if (itemDataCopy.SalesProcess) payload.SalesProcess = String(itemDataCopy.SalesProcess);
  if (itemDataCopy.Phase) payload.Phase = String(itemDataCopy.Phase);
  if (itemDataCopy.Reason) payload.Reason = String(itemDataCopy.Reason);
  if (itemDataCopy.AssignedTo) payload.AssignedTo = String(itemDataCopy.AssignedTo);

  if (itemDataCopy.DateOfFirstContact) payload.DateOfFirstContact = String(itemDataCopy.DateOfFirstContact);
  if (itemDataCopy.ExpectedCloseDate) payload.ExpectedCloseDate = String(itemDataCopy.ExpectedCloseDate);

  const excludedKeys = new Set([
    "id", "name", "@odata.etag", "@odata.context",
    "Series", "Guid",
    "SoldtoBusinessPartnerName", "SoldtoBusinessPartnerStreet",
    "SoldtoBusinessPartnerHouseNumber", "SoldtoBusinessPartnerZIPCodePostalCode",
    "SoldtoBusinessPartnerCountry",
    "SoldtoBusinessPartner", "Status", "IncludeInForecast", "ProbabilityPercentage", "ExpectedRevenue",
    "Type", "Source", "SalesProcess", "Phase", "Reason", "AssignedTo",
    "DateOfFirstContact", "ExpectedCloseDate", "ActualCloseDate",
    "BusinessPartnerStatus", "WeightedRevenue", "ItemRevenue", "CreatedBy", "CreationDate", "LastModifiedBy", "LastTransactionDate",
    "description", "opportunityText",
    "Description", "OpportunityText",
  ]);

  for (const key in itemDataCopy) {
    if (!excludedKeys.has(key) && itemDataCopy[key] !== undefined) {
      if (typeof itemDataCopy[key] === 'string' && itemDataCopy[key] === '') {
        payload[key] = null;
      } else {
        payload[key] = itemDataCopy[key];
      }
    }
  }
  return payload;
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const errorText = await response.text();
    const errorData = JSON.parse(errorText);
    if (errorData.error && errorData.error.details && errorData.error.details.length > 0) {
      return errorData.error.details[0].message;
    }
    return errorData.error?.message || `API Error: ${response.statusText}`;
  } catch (jsonError) {
    return `API Error: ${response.statusText} - ${await response.text()}`;
  }
};

export const createItem = async (
  itemData: Item,
  authToken: string,
  companyNumber: string,
  cloudEnvironment: CloudEnvironment,
): Promise<Item> => {
  try {
    const API_BASE_URL = getApiBaseUrl(cloudEnvironment);
    const payload = preparePayload(itemData);

    const response = await fetch(`${API_BASE_URL}/Opportunities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Language": "de-DE",
        "X-Infor-LnCompany": companyNumber,
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMessage = await parseApiError(response);
      throw new Error(errorMessage);
    }

    const odataResponse = await response.json();

    const newItem: Item = {
      id: odataResponse.Opportunity || String(Math.random() * 100000),
      name: odataResponse.Name || odataResponse.Opportunity || "N/A",
      description: odataResponse.Description || "No description",
      opportunityText: odataResponse.OpportunityText || odataResponse["tdsmi110.text"] || "No Allgemeine Daten text",
      "tdsmi110.text": odataResponse["tdsmi110.text"] || "No Allgemeine Daten text (raw)",
      DateOfFirstContact: odataResponse.DateOfFirstContact,
      ExpectedCloseDate: odataResponse.ExpectedCloseDate,
      ActualCloseDate: odataResponse.ActualCloseDate,
    };

    const keysToExcludeFromNewItem = new Set([
      "Opportunity", "Name", "Description", "OpportunityText", "@odata.etag", "@odata.context",
      "DateOfFirstContact", "ExpectedCloseDate", "ActualCloseDate",
      "tdsmi110.text"
    ]);

    for (const key in odataResponse) {
        if (!keysToExcludeFromNewItem.has(key)) {
            newItem[key] = odataResponse[key];
        }
    }
    return newItem;
  } catch (error) {
    console.error("API Error: Failed to create item", error);
    throw error;
  }
};

export const updateItem = async (
  itemData: Item,
  authToken: string,
  companyNumber: string,
  cloudEnvironment: CloudEnvironment,
): Promise<Item> => {
  try {
    const API_BASE_URL = getApiBaseUrl(cloudEnvironment);
    const opportunityId = itemData.id; 
    const payload = preparePayload(itemData);

    const response = await fetch(`${API_BASE_URL}/Opportunities('${opportunityId}')`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Language": "de-DE",
        "X-Infor-LnCompany": companyNumber,
        "Authorization": `Bearer ${authToken}`,
        "If-Match": itemData["@odata.etag"] || "*",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMessage = await parseApiError(response);
      throw new Error(errorMessage);
    }

    return itemData; 
  } catch (error) {
    console.error("API Error: Failed to update item", error);
    throw error;
  }
};

export const getOpportunityById = async (
  authToken: string,
  companyNumber: string,
  cloudEnvironment: CloudEnvironment,
  opportunityId: string
): Promise<Item> => {
  const API_BASE_URL = getApiBaseUrl(cloudEnvironment);
  const safeId = String(opportunityId).replace(/'/g, "''");
  const params = new URLSearchParams();
  // Keep it broad: different LN tenants sometimes differ in available fields.
  params.set("$select", "*");

  const response = await fetch(`${API_BASE_URL}/Opportunities('${safeId}')?${params.toString()}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Content-Language": "de-DE",
      "X-Infor-LnCompany": companyNumber,
      "Authorization": `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      (errorData as any)?.message || `Failed to fetch opportunity '${opportunityId}': ${response.statusText}`
    );
  }

  const odataItem: any = await response.json();

  const mappedItem: Item = {
    id: odataItem.Opportunity || opportunityId,
    name: odataItem.Name || odataItem.Opportunity || "N/A",
    description: odataItem.Description || "No description",
    opportunityText:
      odataItem.OpportunityText || odataItem["tdsmi110.text"] || "No Allgemeine Daten text",
    "tdsmi110.text": odataItem["tdsmi110.text"] || "No Allgemeine Daten text (raw)",
    DateOfFirstContact: odataItem.DateOfFirstContact,
    ExpectedCloseDate: odataItem.ExpectedCloseDate,
    ActualCloseDate: odataItem.ActualCloseDate,
  };

  const keysToExcludeFromNewItem = new Set([
    "Opportunity",
    "Name",
    "Description",
    "OpportunityText",
    "@odata.etag",
    "@odata.context",
    "DateOfFirstContact",
    "ExpectedCloseDate",
    "ActualCloseDate",
    "tdsmi110.text",
  ]);

  for (const key in odataItem) {
    if (!keysToExcludeFromNewItem.has(key)) {
      mappedItem[key] = odataItem[key];
    }
  }

  return mappedItem;
};

export type GetOpportunitiesOptions = {
  top?: number;
  skip?: number;
  filter?: string;
  orderBy?: string;
  select?: string;
  count?: boolean;
};

export type OpportunitiesWithCount = {
  items: Item[];
  totalCount: number | null;
};

export const getOpportunitiesWithCount = async (
  authToken: string,
  companyNumber: string,
  cloudEnvironment: CloudEnvironment,
  options?: GetOpportunitiesOptions
): Promise<OpportunitiesWithCount> => {
  const API_BASE_URL = getApiBaseUrl(cloudEnvironment);
  const desiredTop = options?.top ?? 100;

  const baseParams = new URLSearchParams();
  baseParams.set("$select", options?.select ?? "*");
  if (options?.filter) baseParams.set("$filter", options.filter);
  if (options?.orderBy) baseParams.set("$orderby", options.orderBy);
  baseParams.set("$count", "true");

  const collected: any[] = [];
  let skip = options?.skip ?? 0;
  let totalCount: number | null = null;

  try {
    while (collected.length < desiredTop) {
      const remaining = desiredTop - collected.length;
      const params = new URLSearchParams(baseParams);
      params.set("$top", String(remaining));
      params.set("$skip", String(skip));

      const url = `${API_BASE_URL}/Opportunities?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Language": "de-DE",
          "X-Infor-LnCompany": companyNumber,
          "Authorization": `Bearer ${authToken}`,
          "Prefer": `odata.maxpagesize=${desiredTop}`,
        },
      });

      if (!response.ok) {
        const raw = await response.text();
        let msg = `Failed to fetch opportunities: ${response.status} ${response.statusText}`;
        try {
          const errorData = JSON.parse(raw);
          msg = (errorData as any)?.message || (errorData as any)?.error?.message || msg;
        } catch {
          // keep msg
        }

        console.error("[LN] Opportunities request failed", {
          url,
          status: response.status,
          statusText: response.statusText,
          body: raw?.slice(0, 2000),
        });

        throw new Error(msg);
      }

      const odataResponse = await response.json();
      if (totalCount == null) {
        const raw = (odataResponse as any)?.["@odata.count"];
        if (typeof raw === "number") totalCount = raw;
        else if (typeof raw === "string" && raw.trim()) totalCount = Number(raw);
      }

      const pageItems: any[] = Array.isArray(odataResponse?.value) ? odataResponse.value : [];
      if (pageItems.length === 0) break;

      collected.push(...pageItems);
      skip += pageItems.length;
    }

    const items: Item[] = collected.slice(0, desiredTop).map((odataItem: any) => {
      const mappedItem: Item = {
        id: odataItem.Opportunity || String(Math.random() * 100000),
        name: odataItem.Name || odataItem.Opportunity || "N/A",
        description: odataItem.Description || "No description",
        opportunityText: odataItem.OpportunityText || odataItem["tdsmi110.text"] || "No Allgemeine Daten text",
        "tdsmi110.text": odataItem["tdsmi110.text"] || "No Allgemeine Daten text (raw)",
        DateOfFirstContact: odataItem.DateOfFirstContact,
        ExpectedCloseDate: odataItem.ExpectedCloseDate,
        ActualCloseDate: odataItem.ActualCloseDate,
      };

      const keysToExcludeFromNewItem = new Set([
        "Opportunity",
        "Name",
        "Description",
        "OpportunityText",
        "@odata.etag",
        "@odata.context",
        "DateOfFirstContact",
        "ExpectedCloseDate",
        "ActualCloseDate",
        "tdsmi110.text",
      ]);

      for (const key in odataItem) {
        if (!keysToExcludeFromNewItem.has(key)) {
          mappedItem[key] = odataItem[key];
        }
      }
      return mappedItem;
    });

    return { items, totalCount: Number.isFinite(totalCount as number) ? (totalCount as number) : null };
  } catch (error) {
    console.error("API Error: Failed to fetch opportunities", error);
    throw error;
  }
};

export const getOpportunities = async (
  authToken: string,
  companyNumber: string,
  cloudEnvironment: CloudEnvironment,
  options?: GetOpportunitiesOptions
): Promise<Item[]> => {
  const API_BASE_URL = getApiBaseUrl(cloudEnvironment);
  const desiredTop = options?.top ?? 100;

  const baseParams = new URLSearchParams();
  baseParams.set("$select", options?.select ?? "*");
  if (options?.filter) baseParams.set("$filter", options.filter);
  if (options?.orderBy) baseParams.set("$orderby", options.orderBy);
  if (options?.count) baseParams.set("$count", "true");

  const collected: any[] = [];
  let skip = options?.skip ?? 0;

  try {
    while (collected.length < desiredTop) {
      const remaining = desiredTop - collected.length;
      const params = new URLSearchParams(baseParams);
      params.set("$top", String(remaining));
      params.set("$skip", String(skip));

      const url = `${API_BASE_URL}/Opportunities?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Language": "de-DE",
          "X-Infor-LnCompany": companyNumber,
          "Authorization": `Bearer ${authToken}`,
          // LN often limits page size; request a larger page size explicitly.
          "Prefer": `odata.maxpagesize=${desiredTop}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch opportunities: ${response.statusText}`);
      }

      const odataResponse = await response.json();
      const pageItems: any[] = Array.isArray(odataResponse?.value) ? odataResponse.value : [];
      if (pageItems.length === 0) break;

      collected.push(...pageItems);
      skip += pageItems.length;
    }

    const opportunities: Item[] = collected.slice(0, desiredTop).map((odataItem: any) => {
      const mappedItem: Item = {
        id: odataItem.Opportunity || String(Math.random() * 100000),
        name: odataItem.Name || odataItem.Opportunity || "N/A",
        description: odataItem.Description || "No description",
        opportunityText: odataItem.OpportunityText || odataItem["tdsmi110.text"] || "No Allgemeine Daten text",
        "tdsmi110.text": odataItem["tdsmi110.text"] || "No Allgemeine Daten text (raw)",
        DateOfFirstContact: odataItem.DateOfFirstContact,
        ExpectedCloseDate: odataItem.ExpectedCloseDate,
        ActualCloseDate: odataItem.ActualCloseDate,
      };

      const keysToExcludeFromNewItem = new Set([
        "Opportunity", "Name", "Description", "OpportunityText", "@odata.etag", "@odata.context",
        "DateOfFirstContact", "ExpectedCloseDate", "ActualCloseDate",
        "tdsmi110.text"
      ]);

      for (const key in odataItem) {
        if (!keysToExcludeFromNewItem.has(key)) {
          mappedItem[key] = odataItem[key];
        }
      }
      return mappedItem;
    });

    return opportunities;
  } catch (error) {
    console.error("API Error: Failed to fetch opportunities", error);
    throw error;
  }
};