"use client";

import { parseStringPromise } from "xml2js";
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
  const parsed = await parseStringPromise(xml, { explicitArray: true });

  const entries: any[] = parsed?.feed?.entry ?? [];
  if (!entries.length) return null;

  const entry = entries[0];

  // Try to find a link with rel="thumbnail" first, then "preview", then "enclosure"
  const links: any[] = entry?.link ?? [];
  let thumbnailHref: string | null = null;

  for (const relName of ["thumbnail", "preview", "enclosure"]) {
    const link = links.find((l) => l?.$?.rel === relName);
    if (link?.$?.href) {
      thumbnailHref = link.$.href as string;
      break;
    }
  }

  // Fallback: Atom content src
  if (!thumbnailHref) {
    const contentSrc = entry?.content?.[0]?.$?.src;
    if (typeof contentSrc === "string") {
      thumbnailHref = contentSrc;
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