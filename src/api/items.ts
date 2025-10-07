import { Item } from "@/types";

// Define your API base URL. You might want to store this in an environment variable.
const API_BASE_URL = "http://localhost:3000/api"; // <--- REPLACE WITH YOUR ACTUAL API BASE URL

export const createItem = async (
  itemData: Omit<Item, "id">
): Promise<Item> => {
  try {
    const response = await fetch(`${API_BASE_URL}/items`, { // <--- REPLACE '/items' WITH YOUR ACTUAL ENDPOINT PATH
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add any other headers your API requires, e.g., Authorization: `Bearer ${yourAuthToken}`
      },
      body: JSON.stringify(itemData), // Send the item data as JSON
    });

    if (!response.ok) {
      // If the response is not OK (e.g., 400, 500 status codes)
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to create item on the server.");
    }

    const newItem: Item = await response.json(); // Parse the JSON response from your API
    console.log("API: Item created successfully", newItem);
    return newItem;
  } catch (error) {
    console.error("API Error: Failed to create item", error);
    throw error; // Re-throw the error so it can be caught by the toast in Index.tsx
  }
};

// You would add similar functions for other CRUD operations (GET, PUT, DELETE)
// For example, a function to fetch all items:
/*
export const getItems = async (): Promise<Item[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/items`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch items from the server.");
    }
    const items: Item[] = await response.json();
    return items;
  } catch (error) {
    console.error("API Error: Failed to fetch items", error);
    throw error;
  }
};
*/