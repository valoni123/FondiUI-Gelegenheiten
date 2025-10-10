import ionapiConfig from './ionapi.json';

// IMPORTANT: Storing client secrets and user credentials directly in frontend code is generally NOT recommended for production environments.
// For a production application, these credentials should be managed securely on a backend server.

const COMPANY_NUMBER = "1000"; // As requested, hardcoded

export const getAccessToken = async (): Promise<string> => {
  try {
    const ACCESS_TOKEN_URL = `${ionapiConfig.pu}${ionapiConfig.ot}`;
    const CLIENT_ID = ionapiConfig.ci;
    const CLIENT_SECRET = ionapiConfig.cs;
    const USERNAME = ionapiConfig.saak;
    const PASSWORD = ionapiConfig.sask;
    const GRANT_TYPE = "password";

    const params = new URLSearchParams();
    params.append('grant_type', GRANT_TYPE);
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('username', USERNAME);
    params.append('password', PASSWORD);

    console.log("Attempting to fetch access token from:", ACCESS_TOKEN_URL);
    console.log("Request body params:", params.toString());

    const response = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text(); // Get raw text to avoid JSON parsing errors on non-JSON responses
      console.error(`Authentication request failed with status: ${response.status} ${response.statusText}`);
      console.error("Authentication error response body:", errorText);
      try {
        const errorData = JSON.parse(errorText); // Try parsing as JSON if it looks like JSON
        throw new Error(errorData.error_description || `Failed to retrieve access token: ${response.statusText}`);
      } catch (jsonError) {
        // If it's not JSON, just throw the raw text error
        throw new Error(`Failed to retrieve access token: ${response.statusText} - ${errorText}`);
      }
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error("Access token not found in the response.");
    }
    console.log("OAuth2 Token retrieved successfully.");
    return data.access_token;

  } catch (error) {
    console.error("Authentication Error: Failed to get access token", error);
    throw error;
  }
};

export const getCompanyNumber = (): string => COMPANY_NUMBER;