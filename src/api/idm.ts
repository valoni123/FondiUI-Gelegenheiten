"use client";

import { getIonApiConfig, type CloudEnvironment } from "@/authorization/configLoader";
import { parseStringPromise } from "xml2js";

const buildIdmBase = (environment: CloudEnvironment) => {
  const cfg = getIonApiConfig(environment);
  return `${cfg.iu}/${cfg.ti}/IDM`;
};

/**
 * Load all IDM entities and return their names.
 * Only entities that have BOTH attributes 'Projekt' and 'Dokumentenpaket' are returned.
 */
export const getIdmEntities = async (
  token: string,
  environment: CloudEnvironment,
  language: string = "de-DE"
): Promise<string[]> => {
  const base = buildIdmBase(environment);
  const url = `${base}/api/datamodel/entities?%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`[IDM] entities request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  // Helper to extract entities array robustly
  const getEntitiesArray = (obj: any): any[] => {
    if (Array.isArray(obj?.entities)) return obj.entities;
    if (Array.isArray(obj?.entities?.entity)) return obj.entities.entity;
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === "object") {
      const maybe = obj.entities;
      if (maybe && typeof maybe === "object") {
        const list = Array.isArray(maybe.entity) ? maybe.entity : Object.values(maybe);
        return Array.isArray(list) ? list : [list];
      }
    }
    return [];
  };

  const entities = getEntitiesArray(json);

  const validNames: string[] = [];
  for (const e of entities) {
    if (!e?.name) continue;

    // Check for attributes
    const attrs = e.attr;
    if (!Array.isArray(attrs)) continue;

    const hasProjekt = attrs.some((a: any) => a?.name === "Projekt");
    const hasDokumentenpaket = attrs.some((a: any) => a?.name === "Dokumentenpaket");

    if (hasProjekt && hasDokumentenpaket) {
      validNames.push(String(e.name));
    }
  }

  // Deduplicate and filter empties
  const unique = Array.from(new Set(validNames.filter(Boolean)));
  return unique;
};

export type IdmDocPreview = {
  smallUrl: string;
  fullUrl?: string;
  contentType?: string;
  filename?: string;
  entityName?: string;
};

/**
 * Search union of entities for a given opportunity and return SmallPreview + Preview URLs per item.
 */
export const searchIdmItemsForOpportunityUnion = async (
  token: string,
  environment: CloudEnvironment,
  opportunityId: string,
  entityNames: string[],
  offset: number = 0,
  limit: number = 50
): Promise<IdmDocPreview[]> => {
  const base = buildIdmBase(environment);
  const segments = (entityNames || []).map((name) => `/${name}[@Gelegenheit = "${opportunityId}"]`);
  if (!segments.length) return [];

  const query = segments.join(" UNION ");
  const url =
    `${base}/api/items/search?` +
    `%24query=${encodeURIComponent(query)}&%24offset=${offset}&%24limit=${limit}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/xml;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`[IDM] union search failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });

  // Try common layouts: items.item[]
  const itemsNode = (parsed as any)?.items?.item ?? (parsed as any)?.item ?? [];
  const items: any[] = Array.isArray(itemsNode) ? itemsNode : itemsNode ? [itemsNode] : [];

  const previews: IdmDocPreview[] = [];
  for (const item of items) {
    const resArray = item?.resrs?.res;
    const resList: any[] = Array.isArray(resArray) ? resArray : resArray ? [resArray] : [];

    const small = resList.find((r) => (r?.name ?? r?.["name"]) === "SmallPreview");
    const preview = resList.find((r) => (r?.name ?? r?.["name"]) === "Preview");

    if (small?.url) {
      previews.push({
        smallUrl: String(small.url),
        fullUrl: preview?.url ? String(preview.url) : undefined,
        contentType: String(small.mimetype || preview?.mimetype || item?.mimetype || ""),
        filename: String(small.filename || preview?.filename || item?.filename || ""),
        entityName: String(item?.entityName || item?.name || ""),
      });
    }
  }

  return previews;
};

// Kept helpers for direct single-entity previews when needed
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
    `${base}/api/items/search/item/resource/Preview?` +
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