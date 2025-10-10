import { getCompanyNumber } from "@/authorization/authService";

const BUSINESS_PARTNERS_API_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/tcapi.comBusinessPartner/BusinessPartners";

export interface BusinessPartner {
  BusinessPartner: string;
  Name: string;
}

export const getActiveBusinessPartners = async (authToken: string): Promise<BusinessPartner[]> => {
  const companyNumber = getCompanyNumber();
  const filter = "BusinessPartnerStatus eq tcapi.comBusinessPartner.BusinessPartnerStatus'Active'";
  const select = "BusinessPartner,Name";
  const url = `${BUSINESS_PARTNERS_API_URL}?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(select)}`;

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
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to fetch business partners: ${response.statusText}`);
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
): Promise<BusinessPartner | null> => {
  const companyNumber = getCompanyNumber();
  // OData endpoint for a single entity
  const url = `${BUSINESS_PARTNERS_API_URL}('${businessPartnerId}')?$select=BusinessPartner,Name`;

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