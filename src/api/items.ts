import { Item } from "@/types";

// Define your API base URL for the OData service.
const API_BASE_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/txsmi.opp";

// Helper function to prepare the payload, converting empty strings to null for API compatibility
const preparePayload = (itemData: Item): Record<string, any> => {
  const payload: Record<string, any> = {
    Name: itemData.name ? String(itemData.name) : null,
    Description: itemData.description ? String(itemData.description) : null,
    SoldtoBusinessPartner: itemData.SoldtoBusinessPartner ? String(itemData.SoldtoBusinessPartner) : null,
    Status: itemData.Status ? String(itemData.Status) : null,
    IncludeInForecast: itemData.IncludeInForecast ?? false,
    ProbabilityPercentage: itemData.ProbabilityPercentage ?? 0,
    ExpectedRevenue: itemData.ExpectedRevenue ?? 0,
    Source: itemData.Source ? String(itemData.Source) : null,
    SalesProcess: itemData.SalesProcess ? String(itemData.SalesProcess) : null,
    Phase: itemData.Phase ? String(itemData.Phase) : null,
    Reason: itemData.Reason ? String(itemData.Reason) : null,
    AssignedTo: itemData.AssignedTo ? String(itemData.AssignedTo) : null,
  };

  const excludedKeys = new Set([
    "id", "name", "description", "@odata.etag", "@odata.context",
    // Derived/expanded fields
    "SoldtoBusinessPartnerName", "SoldtoBusinessPartnerStreet",
    "SoldtoBusinessPartnerHouseNumber", "SoldtoBusinessPartnerZIPCodePostalCode",
    "SoldtoBusinessPartnerCountry",
    // Fields explicitly handled above to avoid duplication or incorrect type handling
    "SoldtoBusinessPartner", "Status", "IncludeInForecast", "ProbabilityPercentage", "ExpectedRevenue",
    "Type", "Source", "SalesProcess", "Phase", "Reason", "AssignedTo",
    "FirstContactDate", "ExpectedCompletionDate", "ActualCompletionDate",
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
  return payload;
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
      const errorText = await response.text();
      console.error(`API request failed for create item with status: ${response.status} ${response.statusText}`);
      console.error("Error response body:", errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || `Failed to create item: ${response.statusText}`);
      } catch (jsonParseError) {
        throw new Error(`Failed to create item: ${response.statusText} - ${errorText}`);
      }
    }

    const odataResponse = await response.json();
    console.log("API: Item created successfully", odataResponse);

    const newItem: Item = {
      id: odataResponse.Opportunity || String(Math.random() * 100000),
      name: odataResponse.Name || odataResponse.Opportunity || "N/A",
      description: odataResponse.Description || "No description",
    };

    for (const key in odataResponse) {
      if (key !== "Opportunity" && key !== "Name" && key !== "Description" && key !== "@odata.etag" && key !== "@odata.context") {
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
      const errorText = await response.text();
      console.error(`API request failed for update item with status: ${response.status} ${response.statusText}`);
      console.error("Error response body:", errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || `Failed to update item: ${response.statusText}`);
      } catch (jsonParseError) {
        throw new Error(`Failed to update item: ${response.statusText} - ${errorText}`);
      }
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
      };

      // Dynamically add all other properties from OData response
      for (const key in odataItem) {
        if (key !== "Opportunity" && key !== "Name" && key !== "Description" && key !== "@odata.etag" && key !== "@odata.context") {
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