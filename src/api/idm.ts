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
): Promise<string | null> => {
  const base = buildIdmBase(environment);
  const query = `/Anfrage_Kunde[@Gelegenheit = "${opportunityId}"]`;
  const url =
    `${base}/api/items/search/item/resource?` +
    `%24query=${encodeURIComponent(query)}&%24state=0&%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/xml;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`IDM search failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();

  // Use DOMParser instead of xml2js for browser compatibility
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, "application/xml");

  const entry = xmlDoc.querySelector("feed > entry");
  if (!entry) return null;

  let thumbnailHref: string | null = null;

  // Try to find a link with rel="thumbnail" first, then "preview", then "enclosure"
  for (const relName of ["thumbnail", "preview", "enclosure"]) {
    const link = entry.querySelector(`link[rel="${relName}"]`);
    if (link) {
      thumbnailHref = link.getAttribute("href");
      if (thumbnailHref) break;
    }
  }

  // Fallback: Atom content src
  if (!thumbnailHref) {
    const content = entry.querySelector("content");
    if (content) {
      thumbnailHref = content.getAttribute("src");
    }
  }

  if (!thumbnailHref) return null;

  // Fetch the thumbnail blob and return an object URL
  const thumbRes = await fetch(thumbnailHref, {
    method: "GET",
    headers: {
      Accept: "image/*",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!thumbRes.ok) {
    // If thumbnail fetch fails, return null rather than throwing
    return null;
  }

  const blob = await thumbRes.blob();
  return URL.createObjectURL(blob);
};