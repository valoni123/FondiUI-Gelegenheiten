import { Item } from "@/types";

// Define your API base URL for the OData service.
// This is derived from your curl command, excluding the collection and query parameters.
const API_BASE_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/txsmi.opp";

// The full URL for fetching opportunities, including query parameters.
const OPPORTUNITIES_FETCH_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/txsmi.opp/Opportunities?$top=10&$select=*";

// IMPORTANT: The Authorization token below is sensitive and should NOT be hardcoded in production.
// It should be managed securely (e.g., fetched from a backend, environment variable, or authentication flow).
// PLEASE REPLACE THIS WITH A FRESH, VALID TOKEN.
const AUTH_TOKEN = "YOUR_NEW_VALID_AUTH_TOKEN_HERE";


export const createItem = async (
  itemData: Item // Now accepts full Item, including dynamic fields
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
        "Accept": "application/json", // As per your curl command
        "Content-Language": "en-US", // As per your curl command
        "X-Infor-LnCompany": "1000", // As per your curl command
        "Authorization": `Bearer ${AUTH_TOKEN}`, // Your provided Bearer token
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

export const getOpportunities = async (): Promise<Item[]> => {
  try {
    const response = await fetch(OPPORTUNITIES_FETCH_URL, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Language": "en-US",
        "X-Infor-LnCompany": "1000",
        "Authorization": `Bearer ${AUTH_TOKEN}`,
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