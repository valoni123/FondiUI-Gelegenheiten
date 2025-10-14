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
    "Description", "OpportunityText", "Project", // Exclude Project from generic loop if already mapped
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
  console.log("Final payload before JSON.stringify:", payload);
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

    console.log("API: Creating item with payload:", payload);
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
    console.log("API: Item created successfully", odataResponse);

    const newItem: Item = {
      id: odataResponse.Opportunity || String(Math.random() * 100000),
      name: odataResponse.Name || odataResponse.Opportunity || "N/A",
      description: odataResponse.Description || "No description",
      opportunityText: odataResponse.OpportunityText || odataResponse["tdsmi110.text"] || "No Allgemeine Daten text",
      "tdsmi110.text": odataResponse["tdsmi110.text"] || "No Allgemeine Daten text (raw)",
      DateOfFirstContact: odataResponse.DateOfFirstContact,
      ExpectedCloseDate: odataResponse.ExpectedCloseDate,
      ActualCloseDate: odataResponse.ActualCloseDate,
      Project: odataResponse.Project || "", // Map Project field
    };

    const keysToExcludeFromNewItem = new Set([
      "Opportunity", "Name", "Description", "OpportunityText", "@odata.etag", "@odata.context",
      "DateOfFirstContact", "ExpectedCloseDate", "ActualCloseDate",
      "tdsmi110.text", "Project"
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

    console.log("API: Updating item with payload:", payload);
    console.log("API: Sending X-Infor-LnCompany header with value:", companyNumber);
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

    console.log("API: Item updated successfully", itemData);
    return itemData; 
  } catch (error) {
    console.error("API Error: Failed to update item", error);
    throw error;
  }
};

export const getOpportunities = async (authToken: string, companyNumber: string, cloudEnvironment: CloudEnvironment): Promise<Item[]> => {
  const API_BASE_URL = getApiBaseUrl(cloudEnvironment);
  
  let selectFields = "Opportunity,Description";
  if (cloudEnvironment === "FON_TRN") {
    selectFields += ",Project";
  }

  const OPPORTUNITIES_FETCH_URL = `${API_BASE_URL}/Opportunities?$top=10&$select=${selectFields}`;

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
    console.log("API: Opportunities fetched successfully", odataResponse);

    const opportunities: Item[] = odataResponse.value.map((odataItem: any) => {
      const mappedItem: Item = {
        id: odataItem.Opportunity || String(Math.random() * 100000),
        name: odataItem.Opportunity || "N/A", // Name will be the Opportunity ID if 'Name' is not selected
        description: odataItem.Description || "No description",
        Project: odataItem.Project || "", // Map Project field
        // Other fields will be undefined as they are not selected
      };

      // Only include explicitly selected fields or those derived from them
      const keysToInclude = new Set([
        "Opportunity", "Description", "Project"
      ]);

      for (const key in odataItem) {
        if (keysToInclude.has(key)) {
          // These are already mapped above, but this ensures any other selected fields are included
          // if the $select query were to change.
          // For now, this loop is mostly redundant for the specific $select=Opportunity,Description,Project
          // but good for robustness.
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