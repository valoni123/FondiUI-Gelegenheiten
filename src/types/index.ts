export interface Item {
  id: string;
  name: string;
  description: string; // This will be for the separate 'Beschreibung' field, mapped to API's 'Description'
  opportunityText?: string; // New field for 'Allgemeine Daten', mapped to API's 'OpportunityText'
  // quantity?: number; // Removed as it's not a mappable property for the API

  // New fields based on the requested layout
  SoldtoBusinessPartner?: string;
  SoldtoBusinessPartnerName?: string; // To store the name for display
  SoldtoBusinessPartnerStreet?: string; // New: Street from AddressRef
  SoldtoBusinessPartnerHouseNumber?: string; // New: HouseNumber from AddressRef
  SoldtoBusinessPartnerZIPCodePostalCode?: string; // New: ZIPCodePostalCode from AddressRef
  SoldtoBusinessPartnerCountry?: string; // New: Country from AddressRef
  BusinessPartnerStatus?: string;
  AssignedTo?: string;
  Type?: string;
  Source?: string;
  DateOfFirstContact?: string; // Renamed from FirstContactDate
  ExpectedCloseDate?: string; // Renamed from ExpectedCompletionDate
  ActualCloseDate?: string; // Renamed from ActualCompletionDate
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
  "tdsmi110.text"?: string; // This will be a read-only field from API, used as fallback for 'opportunityText'
  Description?: string; // This is the API field that 'description' maps to for writing
  OpportunityText?: string; // This is the API field that 'opportunityText' maps to for writing
  Project?: string; // Added Project field

  // Allow for any other properties that might come from the API
  [key: string]: any;
}