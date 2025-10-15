"use client";

import { getIonApiConfig, type CloudEnvironment } from "@/authorization/configLoader";

const buildIdmBase = (environment: CloudEnvironment) => {
  const cfg = getIonApiConfig(environment);
  return `${cfg.iu}/${cfg.ti}/IDM`;
};

type PreviewResult = { url: string; contentType: string } | null;

const pickPreviewFromEntry = (entry: Element): { href: string | null; typeHint: string | null } => {
  const links = Array.from(entry.getElementsByTagNameNS("*", "link"));
  const byRel = (rel: string) => links.find((l) => l.getAttribute("rel") === rel);

  // Priority: thumbnail -> preview -> enclosure -> alternate
  const priorityRels = ["thumbnail", "preview", "enclosure", "alternate"];
  for (const rel of priorityRels) {
    const link = byRel(rel);
    if (link?.getAttribute("href")) {
      console.log(`Found link with rel="${rel}":`, { href: link.getAttribute("href"), typeHint: link.getAttribute("type") });
      return { href: link.getAttribute("href"), typeHint: link.getAttribute("type") };
    }
  }

  // Fallback: first link with href
  const anyLink = links.find((l) => l.getAttribute("href"));
  if (anyLink) {
    console.log("Found any link with href:", { href: anyLink.getAttribute("href"), typeHint: anyLink.getAttribute("type") });
    return { href: anyLink.getAttribute("href"), typeHint: anyLink.getAttribute("type") };
  }

  // Fallback: content src
  const content = entry.getElementsByTagNameNS("*", "content")[0];
  if (content?.getAttribute("src")) {
    console.log("Found content src:", { href: content.getAttribute("src"), typeHint: content.getAttribute("type") });
    return { href: content.getAttribute("src"), typeHint: content.getAttribute("type") };
  }

  console.log("No preview link or content src found in entry.");
  return { href: null, typeHint: null };
};

export const getIdmThumbnailForOpportunity = async (
  token: string,
  environment: CloudEnvironment,
  opportunityId: string,
  language: string = "de-DE"
): Promise<PreviewResult> => {
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
  console.log("IDM XML Response:", xml); // Log the raw XML

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, "application/xml");

  const entry =
    xmlDoc.getElementsByTagNameNS("*", "entry")[0] ??
    xmlDoc.querySelector("entry"); // very last resort

  if (!entry) {
    console.log("No <entry> element found in IDM XML.");
    return null;
  }
  console.log("Found <entry> element:", entry);

  const { href, typeHint } = pickPreviewFromEntry(entry);
  console.log("Extracted href and typeHint:", { href, typeHint });

  if (!href) {
    return null;
  }

  const thumbRes = await fetch(href, {
    method: "GET",
    headers: {
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!thumbRes.ok) {
    console.error(`Failed to fetch thumbnail from ${href}: ${thumbRes.status} ${thumbRes.statusText}`);
    return null;
  }

  const blob = await thumbRes.blob();
  const contentType = thumbRes.headers.get("Content-Type") || typeHint || "application/octet-stream";

  return { url: URL.createObjectURL(blob), contentType };
};