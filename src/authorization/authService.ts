import ionapiConfig from './ionapi.json';

// IMPORTANT: Storing client secrets and user credentials directly in frontend code is generally NOT recommended for production environments.
// For a production application, these credentials should be managed securely on a backend server.

interface TokenCache {
  accessToken: string | null;
  expiresAt: number | null; // Unix timestamp in milliseconds
  cachedCompanyNumber: string | null; // Store company number with token
}

let tokenCache: TokenCache = {
  accessToken: null,
  expiresAt: null,
  cachedCompanyNumber: null,
};

export const getAccessToken = async (companyNumber: string): Promise<string> => { // Accept companyNumber
  // Check if token is still valid AND for the same company number
  if (tokenCache.accessToken && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt && tokenCache.cachedCompanyNumber === companyNumber) {
    console.log("Using cached OAuth2 Token.");
    return tokenCache.accessToken;
  }

  try {
    // Use the proxy path for the token endpoint
    const PROXY_TOKEN_PATH = `/infor-sso/TTFMRW9QWR47VL78_DEM/as/${ionapiConfig.ot}`;
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

    console.log("Attempting to fetch new access token from proxy:", PROXY_TOKEN_PATH);

    const response = await fetch(PROXY_TOKEN_PATH, { // Request to the proxy
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

    // Cache the new token and its expiry time (e.g., 1 minute before actual expiry)
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000) - (60 * 1000), // Refresh 1 minute before actual expiry
      cachedCompanyNumber: companyNumber, // Store the company number with the token
    };
    console.log("New OAuth2 Token retrieved and cached successfully.");
    return data.access_token;

  } catch (error) {
    console.error("Authentication Error: Failed to get access token", error);
    // Clear cache on error to force re-authentication next time
    tokenCache = { accessToken: null, expiresAt: null, cachedCompanyNumber: null };
    throw error;
  }
};