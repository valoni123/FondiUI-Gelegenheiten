"use client";

import { getIonApiConfig, type CloudEnvironment } from "@/authorization/configLoader";

const buildIdmBase = (environment: CloudEnvironment) => {
  const cfg = getIonApiConfig(environment);
  return `${cfg.iu}/${cfg.ti}/IDM`;
};

export const getIdmThumbnailForOpportunity = async (
  token: string,
  environment: CloudEnvironment,
  opportunityId: string,
  language: string = "de-DE"
): Promise<{ url: string; contentType: string } | null> => {
  const base = buildIdmBase(environment);
  const query = `/Anfrage_Kunde[@Gelegenheit = "${opportunityId}"]`;
  const url =
    `${base}/api/items/search/item/resource?` +
    `%24query=${encodeURIComponent(query)}&%24state=0&%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json", // ask for JSON
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`IDM search failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  // The preview info is under res
  const previewUrl = json?.res?.url;
  const previewType = json?.res?.mimetype || "application/octet-stream";

  if (!previewUrl) return null;

  // Fetch the actual file
  const fileRes = await fetch(previewUrl, {
    method: "GET",
    headers: {
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!fileRes.ok) return null;

  const blob = await fileRes.blob();
  const contentType = fileRes.headers.get("Content-Type") || previewType;

  return { url: URL.createObjectURL(blob), contentType };
};