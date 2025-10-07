import { Item } from "@/types";

// This function simulates a REST API call to create a new item.
// In a real application, this would be an actual fetch or axios call to your backend.
export const createItem = (
  itemData: Omit<Item, "id">
): Promise<Item> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate a successful API response with a new ID
      const newId = (Math.random() * 100000).toFixed(0); // Simple ID generation
      const newItem: Item = { ...itemData, id: newId };
      console.log("Simulated API: Item created", newItem);
      resolve(newItem);
      // For error simulation: reject(new Error("Failed to create item"));
    }, 1000); // Simulate network delay
  });
};