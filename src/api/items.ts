import { Item } from "@/types";

// Define your API base URL for the OData service.
const API_BASE_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/txsmi.opp";

// Helper function to prepare the payload, converting empty strings to null for API compatibility
const preparePayload = (itemData: Item): Record<string, any> => {
  const payload: Record<string, any> = {}; // Start with an empty payload

  // Add fields only if they have a value, or if they are boolean/number and explicitly set
  if (itemData.name) payload.Name = String(itemData.name);
  if (itemData.SoldtoBusinessPartner) payload.SoldtoBusinessPartner = String(itemData.SoldtoBusinessPartner);
  if (itemData.Status) payload.Status = String(itemData.Status);
  // Boolean and number fields should always be sent if they exist, even if 0 or false
  payload.IncludeInForecast = itemData.IncludeInForecast ?? false;
  payload.ProbabilityPercentage = itemData.ProbabilityPercentage ?? 0;
  payload.ExpectedRevenue = itemData.ExpectedRevenue ?? 0;
  if (itemData.Source) payload.Source = String(itemData.Source);
  if (itemData.SalesProcess) payload.SalesProcess = String(itemData.SalesProcess);
  if (itemData.Phase) payload.Phase = String(itemData.Phase);
  if (itemData.Reason) payload.Reason = String(itemData.Reason);
  if (itemData.AssignedTo) payload.AssignedTo = String(itemData.AssignedTo);

  // Date fields: only send if they have a value
  if (itemData.DateOfFirstContact) payload.DateOfFirstContact = String(itemData.DateOfFirstContact);
  // ExpectedCloseDate: only send if it has a value
  if (itemData.ExpectedCloseDate) payload.ExpectedCloseDate = String(itemData.ExpectedCloseDate);
  // ActualCloseDate should NOT be added to the payload as it's read-only.

  const excludedKeys = new Set([
    "id", "name", "description", "@odata.etag", "@odata.context",
    "tdsmi110.text", // Explicitly exclude this system-managed text number field
    "Series", // Exclude Series as it cannot be modified
    "Guid", // Exclude Guid as it cannot be modified
    // Derived/expanded fields
    "SoldtoBusinessPartnerName", "SoldtoBusinessPartnerStreet",
    "SoldtoBusinessPartnerHouseNumber", "SoldtoBusinessPartnerZIPCodePostalCode",
    "SoldtoBusinessPartnerCountry",
    // Fields explicitly handled above to avoid duplication or incorrect type handling
    "SoldtoBusinessPartner", "Status", "IncludeInForecast", "ProbabilityPercentage", "ExpectedRevenue",
    "Type", "Source", "SalesProcess", "Phase", "Reason", "AssignedTo",
    // Date field names, already handled above or explicitly excluded
    "DateOfFirstContact", "ExpectedCloseDate", "ActualCloseDate",
    // Read-only fields that should not be sent in POST/PATCH
    "BusinessPartnerStatus", "WeightedRevenue", "ItemRevenue", "CreatedBy", "CreationDate", "LastModifiedBy", "LastTransactionDate",
  ]);

  for (const key in itemData) {
    if (!excludedKeys.has(key) && itemData[key] !== undefined) {
      // For dynamically added fields, if they are strings and empty, also send null
      if (typeof itemData[key] === 'string' && itemData[key] === '') {
        payload[key] = null;
      } else {
        payload[key] = itemData[key];
      }
    }
  }
  console.log("Final payload before JSON.stringify:", payload); // Added for debugging
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
): Promise<Item> => {
  try {
    const payload = preparePayload(itemData);

    console.log("API: Creating item with payload:", payload);
    const response = await fetch(`${API_BASE_URL}/Opportunities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Language": "en-US",
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
      DateOfFirstContact: odataResponse.DateOfFirstContact,
      ExpectedCloseDate: odataResponse.ExpectedCloseDate,
      ActualCloseDate: odataResponse.ActualCloseDate,
    };

    const keysToExcludeFromNewItem = new Set([
      "Opportunity", "Name", "Description", "@odata.etag", "@odata.context",
      "DateOfFirstContact", "ExpectedCloseDate", "ActualCloseDate",
      "tdsmi110.text" // Explicitly exclude from being copied into our Item object
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
): Promise<Item> => {
  try {
    const opportunityId = itemData.id; 
    const payload = preparePayload(itemData);

    console.log("API: Updating item with payload:", payload);
    console.log("API: Sending X-Infor-LnCompany header with value:", companyNumber);
    const response = await fetch(`${API_BASE_URL}/Opportunities('${opportunityId}')`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Language": "en-US",
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

export const getOpportunities = async (authToken: string, companyNumber: string): Promise<Item[]> => {
  // The full URL for fetching opportunities, including query parameters.
  const OPPORTUNITIES_FETCH_URL = `${API_BASE_URL}/Opportunities?$top=10&$select=*`;

  try {
    const response = await fetch(OPPORTUNITIES_FETCH_URL, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Language": "en-US",
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

    // OData responses for collections typically have a 'value' array.
    const opportunities: Item[] = odataResponse.value.map((odataItem: any) => {
      const mappedItem: Item = {
        id: odataItem.Opportunity || String(Math.random() * 100000),
        name: odataItem.Name || odataItem.Opportunity || "N/A",
        description: odataItem.Description || "No description",
        // Map the correct date fields from OData response
        DateOfFirstContact: odataItem.DateOfFirstContact,
        ExpectedCloseDate: odataItem.ExpectedCloseDate,
        ActualCloseDate: odataItem.ActualCloseDate,
      };

      const keysToExcludeFromNewItem = new Set([
        "Opportunity", "Name", "Description", "@odata.etag", "@odata.context",
        "DateOfFirstContact", "ExpectedCloseDate", "ActualCloseDate",
        "tdsmi110.text" // Explicitly exclude from being copied into our Item object
      ]);

      // Dynamically add all other properties from OData response, excluding already mapped date fields
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