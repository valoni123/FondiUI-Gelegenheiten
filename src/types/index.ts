export interface Item {
  id: string;
  name: string;
  description: string;
  quantity?: number; // Keep as optional for existing local items and if not always present in OData

  // Allow for any other properties that might come from the API
  [key: string]: any;
}