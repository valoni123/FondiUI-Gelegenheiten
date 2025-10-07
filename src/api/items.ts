import { Item } from "@/types";

// Define your API base URL for the OData service.
// This is derived from your curl command, excluding the collection and query parameters.
const API_BASE_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/txsmi.opp";

export const createItem = async (
  itemData: Omit<Item, "id">
): Promise<Item> => {
  // IMPORTANT: The Authorization token below is sensitive and should NOT be hardcoded in production.
  // It should be managed securely (e.g., fetched from a backend, environment variable, or authentication flow).
  const AUTH_TOKEN = "eyJraWQiOiJrZzpiYTU0NTFhOS0wMzIxLTRlYjUtOGUzNS0wNTM3OTFlMTBkMmUiLCJhbGciOiJSUzI1NiJ9.eyJUZW5hbnQiOiJUVEZNUlc5UVdSNDdWTDc4X0RFTSIsIklkZW50aXR5MiI6ImJmNTY5ZTNlLTkzMjUtNGQzNi1iZjU2LWQzMjRkYjA0Y2ZmMiIsIlNTT1Nlc3Npb25JRCI6IlRURk1SVzlRV1I0N1ZMNzhfREVNfmVjMjJlOTI2LWYxOWUtNGRkOS1iMzBkLTVlYzRiMjhlNzY0YSIsInNjb3BlIjoib3BlbmlkIiwiSUZTQXV0aGVudGljYXRpb25Nb2RlIjoiQ0xPVURfSURFTlRJVElFUyIsIkVuZm9yY2VTY29wZXNGb3JDbGllbnQiOiIwIiwiZ3JhbnRfaWQiOiIxZGNiZDU4NC0yNGRhLTQzNTctOWYzZS04NTFlMTdiN2M3ZDciLCJJbmZvclNUU0lzc3VlZFR5cGUiOiJBUyIsImNsaWVudF9pZCI6ImluZm9yfmtFRHg4TmxMeUtyU1lSWlR0NGFwb2JjSzQyMEJDZldhNDFyMXJwX3V5RndfT0lEQyIsImp0aSI6IjRhMmE0YzMxLTk4NzktNDU0YS05NTMzLTFmZjNjOTM0ZTg2OCIsImlhdCI6MTc1OTg3MTAzNywibmJmIjoxNzU5ODcxMDM3LCJleHAiOjE3NTk4NzgyMzcsImlzcyI6Imh0dHBzOi8vbWingleLXNzby5ldTEuaW5mb3JjbG91ZHN1aXRlLmNvbTo0NDMiLCJhdWQiOiJodHRwczovL21pbmdsZS1pb25hcGkuZXUxLmluZm9yY2xvdWRzdWl0ZS5jb20ifQ.WVM0XjF9HpjiXfzsisvWqdhRgBlvdm7_I_uSZrnW5hqnoKUSHm_yBNNpx44766Z26JHEkL0bTBSRw2Xvy1NNHJ_OVwSt7kze4015Ddyp3g0_jzrN6Pg7wr7kJVdP3qPXrjE6bSuDGXNRAG-eNWaeOqf3ftkSf9KKSSVC7jdIIs7DloAiojoFmgkMtEYvNMRt1oLdzOUoEkY6lEszlGxoqGMEL1rn-kRiATiMFa8V2GS_I7b2YteJkTG7QSLClqRE5iazo4FxX8VRtYjA4tep057dmKIKXs8i23tyMHEdSiL8P7IVoQbvNjAzzRO8zx-GQ54qi3ui9iAT4UddInHg3Q";

  try {
    // The endpoint for creating a new Opportunity in OData is typically the collection name.
    const response = await fetch(`${API_BASE_URL}/Opportunities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json", // As per your curl command
        "Content-Language": "en-US", // As per your curl command
        "X-Infor-LnCompany": "1000", // As per your curl command
        "Authorization": `Bearer ${AUTH_TOKEN}`, // Your provided Bearer token
      },
      // Map your Item data to the expected OData entity structure for Opportunities.
      // Assuming properties like OpportunityName, Description, Quantity.
      body: JSON.stringify({
        OpportunityName: itemData.name,
        Description: itemData.description,
        Quantity: itemData.quantity, // Assuming 'Quantity' is a valid field for an Opportunity
        // Add other OData entity properties as required by your API
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to create item: ${response.statusText}`);
    }

    const odataResponse = await response.json();
    console.log("API: Item created successfully", odataResponse);

    // Map the OData response back to your Item interface.
    // Assuming the OData service returns an 'Id' field and the properties you sent.
    const newItem: Item = {
      id: odataResponse.Id || odataResponse.OpportunityId || String(Math.random() * 100000), // Fallback ID if not returned
      name: odataResponse.OpportunityName || itemData.name,
      description: odataResponse.Description || itemData.description,
      quantity: odataResponse.Quantity || itemData.quantity,
    };
    return newItem;
  } catch (error) {
    console.error("API Error: Failed to create item", error);
    throw error;
  }
};

// You would add similar functions for other CRUD operations (GET, PUT, DELETE)
// For example, a function to fetch all items:
/*
export const getItems = async (): Promise<Item[]> => {
  const AUTH_TOKEN = "YOUR_SECURELY_MANAGED_AUTH_TOKEN"; // Use a securely managed token
  try {
    const response = await fetch(`${API_BASE_URL}/Opportunities?$top=10&$select=*`, { // Example GET with query params
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
      throw new Error(errorData.message || "Failed to fetch items from the server.");
    }
    const odataResponse = await response.json();
    // OData responses often have a 'value' array for collections
    const items: Item[] = odataResponse.value.map((odataItem: any) => ({
      id: odataItem.Id || odataItem.OpportunityId,
      name: odataItem.OpportunityName,
      description: odataItem.Description,
      quantity: odataItem.Quantity,
    }));
    return items;
  } catch (error) {
    console.error("API Error: Failed to fetch items", error);
    throw error;
  }
};
*/