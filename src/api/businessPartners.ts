import { getCompanyNumber } from "@/authorization/authService";

const BUSINESS_PARTNERS_API_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/tcapi.comBusinessPartner/BusinessPartners";

export interface AddressRef {
  Street?: string;
  HouseNumber?: string;
  ZIPCodePostalCode?: string;
  City?: string;
  Country?: string;
  CityDescription?: string; // Added CityDescription as it's in your example response
  // Add other fields if needed from the AddressRef response
}

export interface BusinessPartner {
  BusinessPartner: string;
  Name: string;
  AddressRef?: AddressRef; // Add AddressRef to the BusinessPartner interface
}

export const getActiveBusinessPartners = async (authToken: string): Promise<BusinessPartner[]> => {
  const companyNumber = getCompanyNumber();
  const filter = "BusinessPartnerStatus eq tcapi.comBusinessPartner.BusinessPartnerStatus'Active'";
  const select = "BusinessPartner,Name";
  const expand = "AddressRef";
  
  let allBusinessPartners: BusinessPartner[] = [];
  let nextLink: string | null = null;

  // Initial URL for the first request
  let currentUrl = `${BUSINESS_PARTNERS_API_URL}?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(select)}&$expand=${encodeURIComponent(expand)}`;

  try {
    do {
      console.log("Fetching business partners from:", currentUrl); // Log the URL for debugging
      const response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Language": "en-US",
          "X-Infor-LnCompany": companyNumber,
          "Authorization": `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text(); // Get raw text first
        console.error(`API request failed for URL: ${currentUrl} with status: ${response.status} ${response.statusText}`);
        console.error("Error response body:", errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || `Failed to fetch business partners: ${response.statusText}`);
        } catch (jsonParseError) {
          throw new Error(`Failed to fetch business partners: ${response.statusText} - ${errorText}`);
        }
      }

      const data = await response.json();
      if (Array.isArray(data.value)) { // Ensure data.value is an array
        allBusinessPartners = allBusinessPartners.concat(data.value);
      } else {
        console.warn("API response 'value' is not an array or is missing:", data);
        // If data.value is not an array, it might be the last page with no more items, or an unexpected format.
        // We should probably stop here if it's not an array.
        nextLink = null; // Stop the loop
        continue; // Skip to next iteration to check nextLink
      }
      
      nextLink = data["@odata.nextLink"] || null;
      console.log("Next link:", nextLink); // Log nextLink for debugging

      if (nextLink) {
        currentUrl = nextLink;
      }

    } while (nextLink); // Continue fetching as long as there's a nextLink

    return allBusinessPartners;
  } catch (error) {
    console.error("API Error: Failed to fetch active business partners", error);
    throw error;
  }
};

export const getBusinessPartnerById = async (
  authToken: string,
  businessPartnerId: string,
): Promise<BusinessPartner | null> => {
  const companyNumber = getCompanyNumber();
  // OData endpoint for a single entity
  const expand = "AddressRef"; // New: expand AddressRef
  const url = `${BUSINESS_PARTNERS_API_URL}('${businessPartnerId}')?$select=BusinessPartner,Name&$expand=${encodeURIComponent(expand)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Language": "en-US",
        "X-Infor-LnCompany": companyNumber,
        "Authorization": `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      // If 404 or other error, it means partner not found or inaccessible
      console.warn(`Business partner with ID ${businessPartnerId} not found or inaccessible. Status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data; // OData for single entity returns the object directly
  } catch (error) {
    console.error(`API Error: Failed to fetch business partner ${businessPartnerId}`, error);
    return null;
  }
};