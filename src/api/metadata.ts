const METADATA_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/txsmi.opp/$metadata";

export const getOpportunityStatusOptions = async (authToken: string): Promise<string[]> => {
  try {
    const response = await fetch(METADATA_URL, {
      method: "GET",
      headers: {
        "Accept": "application/xml",
        "Authorization": `Bearer ${authToken}`,
        "Content-Language": "de-DE", // Changed from en-US to de-DE
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