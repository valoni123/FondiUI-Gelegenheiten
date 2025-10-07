import { parseStringPromise } from 'xml2js';

const METADATA_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/txsmi.opp/$metadata";

// IMPORTANT: The Authorization token below is sensitive and should NOT be hardcoded in production.
// It should be managed securely (e.g., fetched from a backend, environment variable, or authentication flow).
// PLEASE REPLACE THIS WITH A FRESH, VALID TOKEN.
const AUTH_TOKEN = "YOUR_NEW_VALID_AUTH_TOKEN_HERE"; // Use the same token as in items.ts

export const getOpportunityStatusOptions = async (): Promise<string[]> => {
  try {
    const response = await fetch(METADATA_URL, {
      method: "GET",
      headers: {
        "Accept": "application/xml",
        "Authorization": `Bearer ${AUTH_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch metadata: ${response.statusText} - ${errorText}`);
    }

    const xmlText = await response.text();
    const result = await parseStringPromise(xmlText);

    const enumTypes = result?.['edmx:Edmx']?.['edmx:DataServices']?.[0]?.['Schema']?.[1]?.['EnumType'];

    if (!enumTypes) {
      console.warn("Could not find EnumType in metadata response.");
      return [];
    }

    const opportunityStatusEnum = enumTypes.find((enumType: any) => enumType.$.Name === "OpportunityStatus");

    if (!opportunityStatusEnum || !opportunityStatusEnum.Member) {
      console.warn("Could not find OpportunityStatus EnumType or its Members.");
      return [];
    }

    const statusOptions = opportunityStatusEnum.Member.map((member: any) => member.$.Name);
    return statusOptions;

  } catch (error) {
    console.error("API Error: Failed to fetch opportunity status options", error);
    throw error;
  }
};