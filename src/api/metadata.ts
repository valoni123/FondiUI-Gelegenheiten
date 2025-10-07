const METADATA_URL = "https://mingle-ionapi.eu1.inforcloudsuite.com/TTFMRW9QWR47VL78_DEM/LN/lnapi/odata/txsmi.opp/$metadata";

// IMPORTANT: The Authorization token below is sensitive and should NOT be hardcoded in production.
// It should be managed securely (e.g., fetched from a backend, environment variable, or authentication flow).
// PLEASE REPLACE THIS WITH A FRESH, VALID TOKEN.
const AUTH_TOKEN = "eyJraWQiOiJrZzpiYTU0NTFhOS0wMzIxLTRlYjUtOGUzNS0wNTM3OTFlMTBkMmUiLCJhbGciOiJSUzI1NiJ9.eyJUZW5hbnQiOiJUVEZNUlc5UVdSNDdWTDc4X0RFTSIsIklkZW50aXR5MiI6ImJmNTY5ZTNlLTkzMjUtNGQzNi1iZjU2LWQzMjRkYjA0Y2ZmMiIsIlNTT1Nlc3Npb25JRCI6IlRURk1SVzlRV1I0N1ZMNzhfREVNfmVjMjJlOTI2LWYxOWUtNGRkOS1iMzBkLTVlYzRiMjhlNzY0YSIsInNjb3BlIjoib3BlbmlkIiwiSUZTQXV0aGVudGljYXRpb25Nb2RlIjoiQ0xPVURfSURFTlRJVElFUyIsIkVuZm9yY2VTY29wZXNGb3JDbGllbnQiOiIwIiwiZ3JhbnRfaWQiOiIxZGNiZDU4NC0yNGRhLTQzNTctOWYzZS04NTFlMTdiN2M3ZDciLCJJbmZvclNUU0lzc3VlZFR5cGUiOiJBUyIsImNsaWVudF9pZCI6ImluZm9yfmtFRHg4TmxMeUtyU1lSWlR0NGFwb2JjSzQyMEJDZldhNDFyMXJwX3V5RndfT0lEQyIsImp0aSI6IjRhMmE0YzMxLTk4NzktNDU0YS05NTMzLTFmZjNjOTM0ZTg2OCIsImlhdCI6MTc1OTg3MTAzNywibmJmIjoxNzU5ODcxMDM3LCJleHAiOjE3NTk4NzgyMzcsImlzcyI6Imh0dHBzOi8vbWluZ2xlLXNzby5ldTEuaW5mb3JjbG91ZHN1aXRlLmNvbTo0NDMiLCJhdWQiOiJodHRwczovL21pbmdsZS1pb25hcGkuZXUxLmluZm9yY2xvdWRzdWl0ZS5jb20ifQ.WVM0XjF9HpjiXfzsisvWqdhRgBlvdm7_I_uSZrnW5hqnoKUSHm_yBNNpx44766Z26JHEkL0bTBSRw2Xvy1NNHJ_OVwSt7kze4015Ddyp3g0_jzrN6Pg7wr7kJVdP3qPXrjE6bSuDGXNRAG-eNWaeOqf3ftkSf9KKSSVC7jdIIs7DloAiojoFmgkMtEYvNMRt1oLdzOUoEkY6lEszlGxoqGMEL1rn-kRiATiMFa8V2GS_I7b2YteJkTG7QSLClqRE5iazo4FxX8VRtYjA4tep057dmKIKXs8i23tyMHEdSiL8P7IVoQbvNjAzzRO8zx-GQ54qi4ui9iAT4UddInHg3Q"; // Use the same token as in items.ts

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