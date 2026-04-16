import { getMetadataUrl, CloudEnvironment } from "@/authorization/configLoader";

export const getOpportunityStatusOptions = async (
  authToken: string,
  cloudEnvironment: CloudEnvironment
): Promise<string[]> => {
  const METADATA_URL = getMetadataUrl(cloudEnvironment);
  try {
    const response = await fetch(METADATA_URL, {
      method: "GET",
      headers: {
        Accept: "application/xml",
        Authorization: `Bearer ${authToken}`,
        "Content-Language": "de-DE",
      },
    });

    const raw = await response.text();

    if (!response.ok) {
      console.error("[LN] Metadata request failed", {
        url: METADATA_URL,
        status: response.status,
        statusText: response.statusText,
        body: raw?.slice(0, 2000),
      });
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText} - ${raw}`);
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(raw, "application/xml");

    // Check for parsing errors
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
      console.error("[LN] XML parsing error for $metadata", {
        url: METADATA_URL,
        parserError: errorNode.textContent,
        body: raw?.slice(0, 2000),
      });
      throw new Error("Failed to parse XML metadata.");
    }

    const enumTypes = xmlDoc.querySelectorAll(
      'Schema[Namespace="txsmi.opp"] EnumType[Name="OpportunityStatus"] Member'
    );

    if (!enumTypes || enumTypes.length === 0) {
      console.warn("Could not find OpportunityStatus EnumType or its Members in metadata response.");
      return [];
    }

    const statusOptions: string[] = [];
    enumTypes.forEach((member) => {
      const name = member.getAttribute("Name");
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