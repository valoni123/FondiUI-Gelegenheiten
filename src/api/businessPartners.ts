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