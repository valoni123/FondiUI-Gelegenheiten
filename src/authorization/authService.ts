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

    const response = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_description || `Failed to retrieve access token: ${response.statusText}`);
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