export const BUSINESS_PARTNERS_API_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/tcapi.comBusinessPartner/BusinessPartners";

export interface AddressRef {
  Street?: string;
  HouseNumber?: string;
  ZIPCodePostalCode?: string;
  City?: string;
  Country?: string;
  CityDescription?: string;
}

export interface BusinessPartner {
  BusinessPartner: string;
  Name: string;
  AddressRef?: AddressRef;
}

export const getActiveBusinessPartners = async (
  authToken: string,
  companyNumber: string,
  searchTerm: string = "",
  top: number = 50
): Promise<BusinessPartner[]> => {
  let filter = "BusinessPartnerStatus eq tcapi.comBusinessPartner.BusinessPartnerStatus'Active'";
  
  if (searchTerm) {
    const encodedSearchTerm = encodeURIComponent(searchTerm.toLowerCase());
    filter += ` and (contains(tolower(Name), '${encodedSearchTerm}') or startswith(BusinessPartner, '${encodedSearchTerm}'))`;
  }

  const select = "BusinessPartner,Name";
  const expand = "AddressRef";
  
  const url = `${BUSINESS_PARTNERS_API_URL}?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(select)}&$expand=${encodeURIComponent(expand)}&$top=${top}`;

  try {
    console.log("Fetching business partners with URL:", url);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Language": "de-DE",
        "X-Infor-LnCompany": companyNumber,
        "Authorization": `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed for URL: ${url} with status: ${response.status} ${response.statusText}`);
      console.error("Error response body:", errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || `Failed to fetch business partners: ${response.statusText}`);
      } catch (jsonParseError) {
        throw new Error(`Failed to fetch business partners: ${response.statusText} - ${errorText}`);
      }
    }

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error("API Error: Failed to fetch active business partners", error);
    throw error;
  }
};

export const getBusinessPartnerById = async (
  authToken: string,
  businessPartnerId: string,
  companyNumber: string,
): Promise<BusinessPartner | null> => {
  const expand = "AddressRef";
  const url = `${BUSINESS_PARTNERS_API_URL}('${businessPartnerId}')?$select=BusinessPartner,Name&$expand=${encodeURIComponent(expand)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Language": "de-DE",
        "X-Infor-LnCompany": companyNumber,
        "Authorization": `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      console.warn(`Business partner with ID ${businessPartnerId} not found or inaccessible. Status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Error: Failed to fetch business partner ${businessPartnerId}`, error);
    return null;
  }
};