export interface Item {
  id: string;
  name: string;
  description: string;
  quantity?: number; // Keep as optional for existing local items and if not always present in OData

  // New fields based on the requested layout
  SoldtoBusinessPartner?: string;
  SoldtoBusinessPartnerName?: string; // To store the name for display
  BusinessPartnerStatus?: string;
  AssignedTo?: string;
  Type?: string;
  Source?: string;
  FirstContactDate?: string; // Storing as string, will parse for date picker
  ExpectedCompletionDate?: string;
  ActualCompletionDate?: string;
  Status?: string; // Already exists, but ensuring it's here
  SalesProcess?: string;
  Phase?: string;
  ProbabilityPercentage?: number;
  Reason?: string;
  IncludeInForecast?: boolean;
  ExpectedRevenue?: number;
  WeightedRevenue?: number;
  ItemRevenue?: number;
  CreatedBy?: string;
  CreationDate?: string;
  LastModifiedBy?: string;
  LastTransactionDate?: string;

  // Allow for any other properties that might come from the API
  [key: string]: any;
}