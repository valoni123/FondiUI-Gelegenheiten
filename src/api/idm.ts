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
  console.log("[getIdmEntities] Function called."); // Log function entry
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
    const errorText = await res.text(); // Get more details on error
    console.error(`[IDM] entities request failed: ${res.status} ${res.statusText}`, errorText);
    throw new Error(`[IDM] entities request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  console.log("[getIdmEntities] Raw API response JSON:", json); // Log raw JSON response

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

  // Return ALL entity names (no attribute filtering)
  const names: string[] = [];
  for (const e of entities) {
    if (e?.name) {
      names.push(String(e.name));
    }
  }

  const unique = Array.from(new Set(names.filter(Boolean)));
  console.log("[getIdmEntities] Returning entities:", unique);
  return unique;
};

export type IdmDocPreview = {
  smallUrl: string;
  fullUrl?: string;
  contentType?: string;
  filename?: string;
  entityName?: string;
  attributes?: { name: string; value: string }[];
  pid?: string;
  resourceUrl?: string; // URL der eigentlichen Datei (erstes res mit name == "")
};

export type IdmAttribute = {
  name: string;
  desc?: string;
  valueset?: { name: string; desc: string }[];
  type?: string; // add type to detect date fields
};

export type IdmEntityInfo = {
  name: string;
  desc: string;
  entity: any;
};

// Fetch entities with their desc, keep full entity object for background use
export const getIdmEntityInfos = async (
  token: string,
  environment: CloudEnvironment,
  language: string = "de-DE"
): Promise<IdmEntityInfo[]> => {
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
    const errorText = await res.text();
    throw new Error(`[IDM] entities (desc) request failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const json = await res.json();

  const toArray = (obj: any): any[] => {
    if (Array.isArray(obj)) return obj;
    const entityNode = obj?.entities?.entity ?? obj?.entity ?? obj?.entities;
    if (Array.isArray(entityNode)) return entityNode;
    if (entityNode && typeof entityNode === "object") {
      const values = Object.values(entityNode);
      return Array.isArray(values) ? values : [values];
    }
    return [];
  };

  const list = toArray(json);
  const infos: IdmEntityInfo[] = list
    .map((e: any) => ({
      name: String(e?.name ?? ""),
      desc: String(e?.desc ?? ""),
      entity: e,
    }))
    .filter((i: IdmEntityInfo) => i.name.length > 0);

  return infos;
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
  // NEW: query only by Gelegenheit, ignore Projekt value in query
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

// New: JSON search per single entity, collecting SmallPreview/Preview URLs
export const searchIdmItemsByEntityJson = async (
  token: string,
  environment: CloudEnvironment,
  opportunityId: string,
  entityName: string,
  offset: number = 0,
  limit: number = 50,
  language: string = "de-DE"
): Promise<IdmDocPreview[]> => {
  const base = buildIdmBase(environment);
  const query = `/${entityName}[@Gelegenheit = "${opportunityId}"]`;
  const url =
    `${base}/api/items/search?` +
    `%24query=${encodeURIComponent(query)}&%24offset=${offset}&%24limit=${limit}&%24state=0&%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    // Let caller decide to continue on error
    throw new Error(`[IDM] items/search failed for entity '${entityName}': ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  // Robustly extract items array: items.item[] or item[]
  const itemsNode = (json as any)?.items?.item ?? (json as any)?.item ?? [];
  const items: any[] = Array.isArray(itemsNode) ? itemsNode : itemsNode ? [itemsNode] : [];

  const previews: IdmDocPreview[] = [];
  for (const item of items) {
    // resrs may contain res[] or resr[]
    const resrs = item?.resrs ?? {};
    const resArrayRaw = (resrs?.res ?? resrs?.resr ?? []);
    const resList: any[] = Array.isArray(resArrayRaw) ? resArrayRaw : resArrayRaw ? [resArrayRaw] : [];

    // Prefer SmallPreview; fallback to Preview
    const small = resList.find((r) => (r?.name ?? r?.["name"]) === "SmallPreview");
    const preview = resList.find((r) => (r?.name ?? r?.["name"]) === "Preview");
    const mainRes = resList[0] ?? resList.find((r) => (r?.name ?? r?.["name"]) === ""); // erstes echtes Resource-Objekt

    // Extract attributes robustly
    const attrsRaw =
      item?.attrs?.attr ??
      item?.attrs ??
      item?.attr ??
      [];
    const attrsList: any[] = Array.isArray(attrsRaw) ? attrsRaw : attrsRaw ? [attrsRaw] : [];
    const attributes =
      attrsList
        .map((a) => {
          const n = a?.name ?? a?.n ?? a?.key ?? "";
          const v = a?.value ?? a?.val ?? a?.v ?? a?._ ?? a?.text ?? "";
          return { name: String(n ?? ""), value: String(v ?? "") };
        })
        .filter((a) => a.name || a.value) as { name: string; value: string }[];

    const chosen = small || preview;
    const pidRaw = (item as any)?.pid ?? (item as any)?.PID ?? (item as any)?.Pid; // capture PID
    if (chosen?.url) {
      previews.push({
        smallUrl: String(chosen.url),
        fullUrl: preview?.url ? String(preview.url) : undefined,
        contentType: String(chosen.mimetype || preview?.mimetype || item?.mimetype || ""),
        // USE the real filename from first res if present
        filename: String((mainRes?.filename ?? item?.filename ?? chosen.filename ?? "")),
        entityName: String(entityName),
        attributes,
        pid: pidRaw ? String(pidRaw) : undefined,
        resourceUrl: mainRes?.url ? String(mainRes.url) : undefined,
      });
    }
  }

  return previews;
}

// NEW: Update IDM item attributes using PID
export const updateIdmItemAttributes = async (
  token: string,
  environment: CloudEnvironment,
  pid: string,
  updates: { name: string; value: string }[],
  language: string = "de-DE"
): Promise<void> => {
  const base = buildIdmBase(environment);
  const url =
    `${base}/api/items/${encodeURIComponent(pid)}?` +
    `%24checkout=true&%24checkin=true&%24merge=true&%24language=${encodeURIComponent(language)}`;

  const body = {
    item: {
      attrs: {
        attr: updates.map((u) => ({ name: u.name, value: u.value })),
      },
    },
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/xml;charset=utf-8",
      "Content-Type": "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[IDM] update failed for PID '${pid}': ${res.status} ${res.statusText} - ${errorText}`);
  }
};

// NEW: Replace IDM item resource (upload new file as base64)
export const replaceIdmItemResource = async (
  token: string,
  environment: CloudEnvironment,
  pid: string,
  file: { filename: string; base64: string },
  language: string = "de-DE"
): Promise<void> => {
  const base = buildIdmBase(environment);
  const url =
    `${base}/api/items/${encodeURIComponent(pid)}?` +
    `%24checkout=true&%24checkin=true&%24merge=true&%24language=${encodeURIComponent(language)}`;

  const body = {
    item: {
      resrs: {
        res: [
          {
            filename: file.filename,
            base64: file.base64,
          },
        ],
      },
    },
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/xml;charset=utf-8",
      "Content-Type": "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `[IDM] replace resource failed for PID '${pid}': ${res.status} ${res.statusText} - ${errorText}`
    );
  }
};

// Check if an item exists for given entityName, filename, and opportunityId and return detailed match info
export const existsIdmItemByEntityFilenameOpportunity = async (
  token: string,
  environment: CloudEnvironment,
  entityName: string,
  filename: string,
  opportunityId: string,
  language: string = "de-DE"
): Promise<{ exists: boolean; matchedFields: { filename?: boolean; entityName?: boolean; gelegenheit?: boolean } }> => {
  const base = buildIdmBase(environment);
  const query = `/${entityName}[@RESOURCENAME = "${filename}" AND @Gelegenheit = "${opportunityId}"]`;
  const url =
    `${base}/api/items/search/item?` +
    `%24query=${encodeURIComponent(query)}&%24state=0&%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[IDM] exists check failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const json = await res.json();
  // Robustly extract items array: items.item[] or item[]
  const itemsNode = (json as any)?.items?.item ?? (json as any)?.item ?? [];
  const items: any[] = Array.isArray(itemsNode) ? itemsNode : itemsNode ? [itemsNode] : [];

  if (items.length === 0) {
    return { exists: false, matchedFields: {} };
  }

  // Check the first item for exact matches on all three fields
  const item = items[0];
  const matchedFields: { filename?: boolean; entityName?: boolean; gelegenheit?: boolean } = {};

  // Check filename match
  const itemFilename = item?.resrs?.res?.[0]?.filename || item?.filename || "";
  matchedFields.filename = itemFilename === filename;

  // Check entityName match
  const itemEntityName = item?.entityName || "";
  matchedFields.entityName = itemEntityName === entityName;

  // Check Gelegenheit attribute match
  const attrs = item?.attrs?.attr || [];
  const gelegenheitAttr = Array.isArray(attrs) ? attrs.find((a: any) => a.name === "Gelegenheit") : null;
  matchedFields.gelegenheit = gelegenheitAttr ? gelegenheitAttr.value === opportunityId : false;

  // Only consider it a true duplicate if ALL THREE fields match
  const exists = matchedFields.filename && matchedFields.entityName && matchedFields.gelegenheit;

  return { exists, matchedFields };
};

export const getIdmEntityAttributes = async (
  token: string,
  environment: CloudEnvironment,
  entityName: string,
  language: string = "de-DE"
): Promise<IdmAttribute[]> => {
  const base = buildIdmBase(environment);
  const url =
    `${base}/api/datamodel/entities/${encodeURIComponent(entityName)}?` +
    `%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[IDM] entity '${entityName}' detail failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const json = await res.json();
  const attrsNode = (json as any)?.entity?.attrs?.attr ?? [];
  const attrsList: any[] = Array.isArray(attrsNode) ? attrsNode : attrsNode ? [attrsNode] : [];
  const attributes: IdmAttribute[] = attrsList.map((a) => {
    const vs = a?.valueset?.value;
    const valueset = Array.isArray(vs)
      ? vs.map((v: any) => ({ name: String(v.name ?? ""), desc: String(v.desc ?? "") }))
      : undefined;
    return {
      name: String(a?.name ?? ""),
      desc: String(a?.desc ?? ""),
      valueset,
      type: String(a?.type ?? ""), // capture type (e.g., "7" for date)
    };
  });
  return attributes.filter((attr) => attr.name.length > 0);
};

export const createIdmItem = async (
  token: string,
  environment: CloudEnvironment,
  payload: {
    entityName: string;
    attrs: { name: string; value: string }[];
    resource: { filename: string; base64: string };
    aclName?: string;
    language?: string;
  }
): Promise<void> => {
  const base = buildIdmBase(environment);
  const language = payload.language ?? "de-DE";
  const url =
    `${base}/api/items?` +
    `%24checkout=false&%24language=${encodeURIComponent(language)}`;

  const body: any = {
    item: {
      entityName: payload.entityName,
      attrs: { attr: payload.attrs },
      resrs: { res: [{ filename: payload.resource.filename, base64: payload.resource.base64 }] },
    },
  };

  if (payload.aclName) {
    body.item.acl = { name: payload.aclName };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/xml;charset=utf-8",
      "Content-Type": "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[IDM] create item failed: ${res.status} ${res.statusText} - ${errorText}`);
  }
};

export const deleteIdmItem = async (
  token: string,
  environment: CloudEnvironment,
  pid: string,
  language: string = "de-DE"
): Promise<void> => {
  const base = buildIdmBase(environment);
  const url =
    `${base}/api/items/${encodeURIComponent(pid)}?` +
    `%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[IDM] delete failed for PID '${pid}': ${res.status} ${res.statusText} - ${errorText}`);
  }
};

// NEW: search by arbitrary attributes for a single entity, JSON response, collecting Preview URLs
export const searchIdmItemsByAttributesJson = async (
  token: string,
  environment: CloudEnvironment,
  entityName: string,
  filters: { name: string; value: string }[],
  offset: number = 0,
  limit: number = 50,
  language: string = "de-DE"
): Promise<IdmDocPreview[]> => {
  const base = buildIdmBase(environment);

  const valid = (filters || []).filter((f) => f?.name && typeof f.value === "string" && f.value.length > 0);
  const clause = valid.map((f) => `@${f.name} = "${f.value}"`).join(" AND ");
  const bracket = clause.length ? `[${clause}]` : "";
  const query = `/${entityName}${bracket}`;

  const url =
    `${base}/api/items/search?` +
    `%24query=${encodeURIComponent(query)}&%24offset=${offset}&%24limit=${limit}&%24state=0&%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[IDM] items search by attributes failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const json = await res.json();

  // Robustly extract items array: items.item[] or item[]
  const itemsNode = (json as any)?.items?.item ?? (json as any)?.item ?? [];
  const items: any[] = Array.isArray(itemsNode) ? itemsNode : itemsNode ? [itemsNode] : [];

  const previews: IdmDocPreview[] = [];
  for (const item of items) {
    const resrs = item?.resrs ?? {};
    const resArrayRaw = (resrs?.res ?? resrs?.resr ?? []);
    const resList: any[] = Array.isArray(resArrayRaw) ? resArrayRaw : resArrayRaw ? [resArrayRaw] : [];

    // Wähle Vorschaubilder für die Anzeige
    const smallPreview = resList.find((r) => (r?.name ?? r?.["name"]) === "SmallPreview");
    const preview = resList.find((r) => (r?.name ?? r?.["name"]) === "Preview");

    // ECHTE Ressource: bevorzugt explizit name == "", ansonsten erste Ressource als Fallback
    const mainRes = resList.find((r) => (r?.name ?? r?.["name"]) === "") ?? resList[0];

    // Attribute extrahieren (wie gehabt)
    const attrsRaw = item?.attrs?.attr ?? item?.attrs ?? item?.attr ?? [];
    const attrsList: any[] = Array.isArray(attrsRaw) ? attrsRaw : attrsRaw ? [attrsRaw] : [];
    const attributes =
      attrsList
        .map((a) => {
          const n = a?.name ?? a?.n ?? a?.key ?? "";
          const v = a?.value ?? a?.val ?? a?.v ?? a?._ ?? a?.text ?? "";
          return { name: String(n ?? ""), value: String(v ?? "") };
        })
        .filter((a) => a.name || a.value) as { name: string; value: string }[];

    // Für die Kachel-Anzeige nutzen wir SmallPreview/Preview, aber zum Öffnen liefern wir resourceUrl vom ersten res
    const chosenPreview = smallPreview ?? preview;

    if (chosenPreview?.url || mainRes?.url) {
      previews.push({
        smallUrl: String((chosenPreview?.url ?? preview?.url ?? "")),
        fullUrl: preview?.url ? String(preview.url) : undefined,
        contentType: String(
          chosenPreview?.mimetype || preview?.mimetype || mainRes?.mimetype || item?.mimetype || ""
        ),
        // WICHTIG: Dateiname von der echten Ressource (erstes res/name == "")
        filename: String((mainRes?.filename ?? item?.filename ?? chosenPreview?.filename ?? "")),
        entityName: String(item?.entityName || entityName),
        attributes,
        pid: item?.pid ? String(item.pid) : undefined,
        // WICHTIG: URL der echten Datei
        resourceUrl: mainRes?.url ? String(mainRes.url) : undefined,
      });
    }
  }

  return previews;
};