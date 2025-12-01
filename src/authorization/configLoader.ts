import gacDemConfig from './GAC_DEM.json';
import fonTrnConfig from './FONDIUM_TRN.json';
import ionapiConfig from './ionapi.json'; // Default config, will be replaced by selected one

export type CloudEnvironment = 'GAC_DEM' | 'FONDIUM_TRN';

interface IonApiConfig {
  ti: string;
  cn: string;
  dt: string;
  ci: string;
  cs: string;
  iu: string;
  pu: string;
  oa: string;
  ot: string;
  or: string;
  ev: string;
  v: string;
  saak?: string;
  sask?: string;
  ru?: string; // optional redirect URI from ionapi
}

const configs: Record<CloudEnvironment, IonApiConfig> = {
  'GAC_DEM': gacDemConfig as IonApiConfig,
  'FONDIUM_TRN': fonTrnConfig as IonApiConfig,
};

export const getIonApiConfig = (environment: CloudEnvironment): IonApiConfig => {
  const config = configs[environment];
  if (!config) {
    // Fallback to default if environment is not recognized, though it should be handled by UI
    console.warn(`Invalid cloud environment: ${environment}. Falling back to default ionapi.json.`);
    return ionapiConfig as IonApiConfig;
  }
  console.log(`Loaded config for ${environment}:`, config);
  return config;
};

export const getApiBaseUrl = (environment: CloudEnvironment): string => {
  const config = getIonApiConfig(environment);
  // Use local proxy to avoid CORS
  return `/ionapi/${config.ti}/LN/lnapi/odata/txsmi.opp`;
};

export const getBusinessPartnersApiUrl = (environment: CloudEnvironment): string => {
  const config = getIonApiConfig(environment);
  // Use local proxy to avoid CORS
  return `/ionapi/${config.ti}/LN/lnapi/odata/tcapi.comBusinessPartner/BusinessPartners`;
};

export const getMetadataUrl = (environment: CloudEnvironment): string => {
  const config = getIonApiConfig(environment);
  // Use local proxy to avoid CORS
  return `/ionapi/${config.ti}/LN/lnapi/odata/txsmi.opp/$metadata`;
};

export const getSsoProxyPath = (environment: CloudEnvironment): string => {
  const config = getIonApiConfig(environment);
  // Use a stable relative proxy path, independent of ot content
  return `/infor-sso/${config.ti}/as/token.oauth2`;
};

export const getAuthUrl = (environment: CloudEnvironment): string => {
  const config = getIonApiConfig(environment);
  const authUrl = `${config.pu}${config.oa}`;
  console.log(`Auth URL for ${environment}:`, authUrl);
  return authUrl;
};

export const getTokenUrl = (environment: CloudEnvironment): string => {
  const config = getIonApiConfig(environment);
  return `${config.pu}${config.ot}`;
};

// Provide redirect URI, prefer ionapi.ru if present, else fallback to current origin + /callback
export const getRedirectUri = (environment: CloudEnvironment): string => {
  const config = getIonApiConfig(environment);
  const desired = `${window.location.origin}/callback`;
  if (config.ru && config.ru !== desired) {
    console.warn(
      `ionapi.ru (${config.ru}) differs from current origin. Using dynamic redirect: ${desired}. ` +
      `Ensure this URL is registered as an allowed redirect URI in ION for ${environment}.`
    );
  }
  return desired;
};

// Build proxied revoke endpoint: /infor-sso/{ti}/as/{or}
export const getRevokeProxyPath = (environment: CloudEnvironment): string => {
  const config = getIonApiConfig(environment);
  return `/infor-sso/${config.ti}/as/${config.or}`;
};