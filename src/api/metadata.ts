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
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");

    // Check for parsing errors
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
      console.error("XML parsing error:", errorNode.textContent);
      throw new Error("Failed to parse XML metadata.");
    }

    const enumTypes = xmlDoc.querySelectorAll('Schema[Namespace="txsmi.opp"] EnumType[Name="OpportunityStatus"] Member');

    if (!enumTypes || enumTypes.length === 0) {
      console.warn("Could not find OpportunityStatus EnumType or its Members in metadata response.");
      return [];
    }

    const statusOptions: string[] = [];
    enumTypes.forEach(member => {
      const name = member.getAttribute('Name');
      if (name) {
        statusOptions.push(name);
      }
    });

    return statusOptions;

  } catch (error) {
    console.error("API Error: Failed to fetch opportunity status options", error);
    throw error;
  }
};