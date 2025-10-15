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
      return { href: link.getAttribute("href"), typeHint: link.getAttribute("type") };
    }
  }

  // Fallback: first link with href
  const anyLink = links.find((l) => l.getAttribute("href"));
  if (anyLink) {
    return { href: anyLink.getAttribute("href"), typeHint: anyLink.getAttribute("type") };
  }

  // Fallback: content src
  const content = entry.getElementsByTagNameNS("*", "content")[0];
  if (content?.getAttribute("src")) {
    return { href: content.getAttribute("src"), typeHint: content.getAttribute("type") };
  }

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

  // Namespace-aware XML parsing
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, "application/xml");

  // Try to find an <entry> regardless of namespace
  const entry =
    xmlDoc.getElementsByTagNameNS("*", "entry")[0] ??
    xmlDoc.querySelector("entry"); // very last resort

  if (!entry) {
    return null;
  }

  const { href, typeHint } = pickPreviewFromEntry(entry);
  if (!href) return null;

  // Fetch the resource to get a blob and real content type
  const thumbRes = await fetch(href, {
    method: "GET",
    headers: {
      // Accept all types; we'll read the header
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!thumbRes.ok) {
    return null;
  }

  const blob = await thumbRes.blob();
  const contentType = thumbRes.headers.get("Content-Type") || typeHint || "application/octet-stream";

  return { url: URL.createObjectURL(blob), contentType };
};