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
  // Updated URL to include /Thumbnail
  const url =
    `${base}/api/items/search/item/resource/Thumbnail?` +
    `%24query=${encodeURIComponent(query)}&%24state=0&%24language=${encodeURIComponent(language)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.warn("[IDM] search request failed:", res.status, res.statusText);
      return null;
    }

    const json = await res.json();
    console.log("[IDM] JSON response:", json);

    const previewUrl = json?.res?.url;
    const previewType = json?.res?.mimetype || "application/octet-stream";

    if (!previewUrl) {
      console.warn("[IDM] no res.url in response");
      return null;
    }

    // Fetch the actual file (thumbnail) using the URL from the response
    const fileRes = await fetch(previewUrl, {
      method: "GET",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!fileRes.ok) {
      console.warn("[IDM] file fetch failed:", fileRes.status, fileRes.statusText, "URL:", previewUrl);
      return null;
    }

    const blob = await fileRes.blob();
    const contentType = fileRes.headers.get("Content-Type") || previewType;

    console.log("[IDM] returning blob URL, type:", contentType);
    return { url: URL.createObjectURL(blob), contentType };
  } catch (err) {
    console.error("[IDM] unexpected error:", err);
    return null;
  }
};