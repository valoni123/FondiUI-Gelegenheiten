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
    `${base}/api/items/search/item/resource/SmallPreview?` +
    `%24query=${encodeURIComponent(query)}&%24state=0&%24language=${encodeURIComponent(language)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json;charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.warn("[IDM] search request failed:", res.status, res.statusText);
      return null;
    }

    const json = await res.json();
    console.log("[IDM] JSON response:", json);

    const previewUrl: string | undefined = json?.res?.url;
    const previewType: string = json?.res?.mimetype || "image/*";

    if (!previewUrl) {
      console.warn("[IDM] no res.url in response");
      return null;
    }

    return { url: previewUrl, contentType: previewType };
  } catch (err) {
    console.error("[IDM] unexpected error:", err);
    return null;
  }
};

export const getIdmFullPreviewForOpportunity = async (
  token: string,
  environment: CloudEnvironment,
  opportunityId: string,
  language: string = "de-DE"
): Promise<{ url: string; contentType: string } | null> => {
  const base = buildIdmBase(environment);
  const query = `/Anfrage_Kunde[@Gelegenheit = "${opportunityId}"]`;
  const url =
    `${base}/api/items/search/item/resource/Preview?` + // Changed to /Preview
    `%24query=${encodeURIComponent(query)}&%24state=0&%24language=${encodeURIComponent(language)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json;charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.warn("[IDM] full preview search request failed:", res.status, res.statusText);
      return null;
    }

    const json = await res.json();
    console.log("[IDM] full preview JSON response:", json);

    const previewUrl: string | undefined = json?.res?.url;
    const previewType: string = json?.res?.mimetype || "image/*";

    if (!previewUrl) {
      console.warn("[IDM] no res.url in full preview response");
      return null;
    }

    return { url: previewUrl, contentType: previewType };
  } catch (err) {
    console.error("[IDM] unexpected error in full preview:", err);
    return null;
  }
};