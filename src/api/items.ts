import { Item } from "@/types";
// Removed import for BUSINESS_PARTNERS_API_URL as it's no longer needed for @odata.bind

// Define your API base URL for the OData service.
const API_BASE_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/txsmi.opp";

export const createItem = async (
  itemData: Item,
  authToken: string,
  companyNumber: string,
): Promise<Item> => {
  try {
    const payload: Record<string, any> = {
      OpportunityName: itemData.name,
      Description: itemData.description,
      Quantity: itemData.quantity,
      // Handle SoldtoBusinessPartner as a direct string property
      ...(itemData.SoldtoBusinessPartner !== undefined ? { SoldtoBusinessPartner: itemData.SoldtoBusinessPartner || null } : {}),
      // Status is also a direct property
      ...(itemData.Status && { Status: itemData.Status }),
      // IncludeInForecast is also a direct property
      ...(itemData.IncludeInForecast !== undefined && { IncludeInForecast: itemData.IncludeInForecast }),
      // ProbabilityPercentage
      ...(itemData.ProbabilityPercentage !== undefined && { ProbabilityPercentage: itemData.ProbabilityPercentage }),
      // ExpectedRevenue
      ...(itemData.ExpectedRevenue !== undefined && { ExpectedRevenue: itemData.ExpectedRevenue }),
      // Type, Source, SalesProcess, Phase, Reason, AssignedTo
      ...(itemData.Type && { Type: itemData.Type }),
      ...(itemData.Source && { Source: itemData.Source }),
      ...(itemData.SalesProcess && { SalesProcess: itemData.SalesProcess }),
      ...(itemData.Phase && { Phase: itemData.Phase }),
      ...(itemData.Reason && { Reason: itemData.Reason }),
      ...(itemData.AssignedTo && { AssignedTo: itemData.AssignedTo }),
      // Dates
      ...(itemData.FirstContactDate && { FirstContactDate: itemData.FirstContactDate }),
      ...(itemData.ExpectedCompletionDate && { ExpectedCompletionDate: itemData.ExpectedCompletionDate }),
      ...(itemData.ActualCompletionDate && { ActualCompletionDate: itemData.ActualCompletionDate }),
    };

    // Dynamically add other properties from itemData to the payload,
    // but explicitly exclude derived/expanded fields that are not direct properties of Opportunity.
    const excludedKeys = new Set([
      "id", "name", "description", "quantity", "@odata.etag", "@odata.context",
      // SoldtoBusinessPartner is now handled directly above, so it's not excluded here
      "SoldtoBusinessPartnerName", "SoldtoBusinessPartnerStreet",
      "SoldtoBusinessPartnerHouseNumber", "SoldtoBusinessPartnerZIPCodePostalCode",
      "SoldtoBusinessPartnerCountry",
      // Also exclude fields already explicitly handled above to avoid duplication or incorrect type handling
      "Status", "IncludeInForecast", "ProbabilityPercentage", "ExpectedRevenue",
      "Type", "Source", "SalesProcess", "Phase", "Reason", "AssignedTo",
      "FirstContactDate", "ExpectedCompletionDate", "ActualCompletionDate",
      // Read-only fields that should not be sent in POST (some might be set by API)
      "BusinessPartnerStatus", "WeightedRevenue", "ItemRevenue", "CreatedBy", "CreationDate", "LastModifiedBy", "LastTransactionDate"
    ]);

    for (const key in itemData) {
      // This loop adds any other dynamic properties not explicitly listed or excluded.
      // We already handled SoldtoBusinessPartner explicitly above, so ensure it's not re-added here.
      if (!excludedKeys.has(key) && itemData[key] !== undefined && key !== "SoldtoBusinessPartner") {
        payload[key] = itemData[key];
      }
    }

    console.log("API: Creating item with payload:", payload); // Added logging
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
      const errorText = await response.text(); // Get raw text for better error inspection
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

    // Map the OData response back to your Item interface, including all dynamic fields.
    const newItem: Item = {
      id: odataResponse.Opportunity || String(Math.random() * 100000), // Map 'Opportunity' to 'id'
      name: odataResponse.Name || odataResponse.Opportunity || "N/A", // Map 'Name' to 'name', fallback to 'Opportunity'
      description: odataResponse.Description || "No description", // Map 'Description' to 'description'
      quantity: odataResponse.Quantity || 0, // Keep quantity, if it exists in OData, otherwise default to 0
    };

    // Dynamically add all other properties from OData response
    for (const key in odataResponse) {
      if (key !== "Opportunity" && key !== "Name" && key !== "Description" && key !== "Quantity" && key !== "@odata.etag" && key !== "@odata.context") {
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
    // The OData key for an Opportunity is 'Opportunity', which we map to 'id' in our Item interface.
    // We need to use the original OData 'Opportunity' value for the URL.
    // Assuming itemData.id holds the 'Opportunity' value from the API.
    const opportunityId = itemData.id; 

    const payload: Record<string, any> = {
      OpportunityName: itemData.name,
      Description: itemData.description,
      Quantity: itemData.quantity,
      // Handle SoldtoBusinessPartner as a direct string property
      ...(itemData.SoldtoBusinessPartner !== undefined ? { SoldtoBusinessPartner: itemData.SoldtoBusinessPartner || null } : {}),
      // Status is also a direct property
      ...(itemData.Status && { Status: itemData.Status }),
      // IncludeInForecast is also a direct property
      ...(itemData.IncludeInForecast !== undefined && { IncludeInForecast: itemData.IncludeInForecast }),
      // ProbabilityPercentage
      ...(itemData.ProbabilityPercentage !== undefined && { ProbabilityPercentage: itemData.ProbabilityPercentage }),
      // ExpectedRevenue
      ...(itemData.ExpectedRevenue !== undefined && { ExpectedRevenue: itemData.ExpectedRevenue }),
      // Type, Source, SalesProcess, Phase, Reason, AssignedTo
      ...(itemData.Type && { Type: itemData.Type }),
      ...(itemData.Source && { Source: itemData.Source }),
      ...(itemData.SalesProcess && { SalesProcess: itemData.SalesProcess }),
      ...(itemData.Phase && { Phase: itemData.Phase }),
      ...(itemData.Reason && { Reason: itemData.Reason }),
      ...(itemData.AssignedTo && { AssignedTo: itemData.AssignedTo }),
      // Dates
      ...(itemData.FirstContactDate && { FirstContactDate: itemData.FirstContactDate }),
      ...(itemData.ExpectedCompletionDate && { ExpectedCompletionDate: itemData.ExpectedCompletionDate }),
      ...(itemData.ActualCompletionDate && { ActualCompletionDate: itemData.ActualCompletionDate }),
    };

    // Dynamically add other properties from itemData to the payload,
    // but explicitly exclude derived/expanded fields that are not direct properties of Opportunity.
    const excludedKeys = new Set([
      "id", "name", "description", "quantity", "@odata.etag", "@odata.context",
      // SoldtoBusinessPartner is now handled directly above, so it's not excluded here
      "SoldtoBusinessPartnerName", "SoldtoBusinessPartnerStreet",
      "SoldtoBusinessPartnerHouseNumber", "SoldtoBusinessPartnerZIPCodePostalCode",
      "SoldtoBusinessPartnerCountry",
      // Also exclude fields already explicitly handled above to avoid duplication or incorrect type handling
      "Status", "IncludeInForecast", "ProbabilityPercentage", "ExpectedRevenue",
      "Type", "Source", "SalesProcess", "Phase", "Reason", "AssignedTo",
      "FirstContactDate", "ExpectedCompletionDate", "ActualCompletionDate",
      // Read-only fields that should not be sent in PATCH
      "BusinessPartnerStatus", "WeightedRevenue", "ItemRevenue", "CreatedBy", "CreationDate", "LastModifiedBy", "LastTransactionDate"
    ]);

    for (const key in itemData) {
      // This loop adds any other dynamic properties not explicitly listed or excluded.
      // We already handled SoldtoBusinessPartner explicitly above, so ensure it's not re-added here.
      if (!excludedKeys.has(key) && itemData[key] !== undefined && key !== "SoldtoBusinessPartner") { // Only include if not undefined
        payload[key] = itemData[key];
      }
    }

    console.log("API: Updating item with payload:", payload); // Added logging
    const response = await fetch(`${API_BASE_URL}/Opportunities('${opportunityId}')`, {
      method: "PATCH", // Use PATCH for partial updates
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Language": "en-US",
        "X-Infor-LnCompany": companyNumber,
        "Authorization": `Bearer ${authToken}`,
        "If-Match": itemData["@odata.etag"] || "*", // Include ETag for optimistic concurrency, or '*' to always update
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text(); // Get raw text for better error inspection
      console.error(`API request failed for update item with status: ${response.status} ${response.statusText}`);
      console.error("Error response body:", errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || `Failed to update item: ${response.statusText}`);
      } catch (jsonParseError) {
        throw new Error(`Failed to update item: ${response.statusText} - ${errorText}`);
      }
    }

    // OData PATCH typically returns 204 No Content on success, or the updated entity.
    // If it returns 204, we can return the itemData as is, or refetch.
    // For simplicity, we'll assume the update was successful and return the itemData.
    // If the API returns the updated entity, you might want to parse it.
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
        id: odataItem.Opportunity || String(Math.random() * 100000), // Map 'Opportunity' to 'id'
        name: odataItem.Name || odataItem.Opportunity || "N/A", // Map 'Name' to 'name', fallback to 'Opportunity'
        description: odataItem.Description || "No description", // Map 'Description' to 'description'
        quantity: odataItem.Quantity || 0, // Keep quantity, if it exists in OData, otherwise default to 0
      };

      // Dynamically add all other properties from OData response
      for (const key in odataItem) {
        if (key !== "Opportunity" && key !== "Name" && key !== "Description" && key !== "Quantity" && key !== "@odata.etag" && key !== "@odata.context") {
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