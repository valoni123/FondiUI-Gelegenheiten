import { Item } from "@/types";

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
    };

    // Add other dynamic fields from itemData to the payload, excluding 'id' and internal OData keys
    for (const key in itemData) {
      if (key !== "id" && key !== "name" && key !== "description" && key !== "quantity" && key !== "@odata.etag" && key !== "@odata.context") {
        payload[key] = itemData[key];
      }
    }

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
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to create item: ${response.statusText}`);
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
    };

    // Add other dynamic fields from itemData to the payload, excluding 'id' and internal OData keys
    for (const key in itemData) {
      if (key !== "id" && key !== "name" && key !== "description" && key !== "quantity" && key !== "@odata.etag" && key !== "@odata.context") {
        payload[key] = itemData[key];
      }
    }

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
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to update item: ${response.statusText}`);
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