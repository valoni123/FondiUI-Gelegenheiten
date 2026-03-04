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

export type OpportunitiesPage = {
  items: Item[];
  totalCount?: number;
};

export const getOpportunities = async (
  authToken: string,
  companyNumber: string,
  cloudEnvironment: CloudEnvironment,
  options?: { top?: number; skip?: number; count?: boolean }
): Promise<OpportunitiesPage> => {
  const API_BASE_URL = getApiBaseUrl(cloudEnvironment);
  const top = options?.top ?? 50;
  const skip = options?.skip ?? 0;
  const count = options?.count ?? false;

  const params = new URLSearchParams();
  params.set("$top", String(top));
  if (skip > 0) params.set("$skip", String(skip));
  params.set("$select", "*");
  if (count) params.set("$count", "true");

  const OPPORTUNITIES_FETCH_URL = `${API_BASE_URL}/Opportunities?${params.toString()}`;

  try {
    const response = await fetch(OPPORTUNITIES_FETCH_URL, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Language": "de-DE",
        "X-Infor-LnCompany": companyNumber,
        "Authorization": `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to fetch opportunities: ${response.statusText}`);
    }

    const odataResponse = await response.json();

    const opportunities: Item[] = (odataResponse.value ?? []).map((odataItem: any) => {
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

    const totalCountRaw = (odataResponse["@odata.count"] ?? odataResponse["@count"] ?? odataResponse.count);
    const totalCount = totalCountRaw != null ? Number(totalCountRaw) : undefined;

    return { items: opportunities, totalCount: Number.isFinite(totalCount) ? totalCount : undefined };
  } catch (error) {
    console.error("API Error: Failed to fetch opportunities", error);
    throw error;
  }
};