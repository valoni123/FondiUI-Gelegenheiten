"use client";

import { getIonApiConfig, type CloudEnvironment } from "@/authorization/configLoader";
import { parseStringPromise } from "xml2js";

const buildIdmBase = (environment: CloudEnvironment) => {
  const cfg = getIonApiConfig(environment);
  // Always use local proxy to avoid any direct external calls
  const hostBase = "/ionapi";
  return `${hostBase}/${cfg.ti}/IDM`;
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
  resourceUrl?: string;
  // NEW: system fields for created/modified info
  createdByName?: string;
  createdTS?: string; // ISO string, e.g. 2026-02-20T08:45:29.052Z
  lastChangedByName?: string;
  lastChangedTS?: string; // ISO string
  // NEW: ACL info (used when updating items so IDM keeps the existing ACL)
  acl?: { id?: string; name?: string };
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
  project?: string,
  language: string = "de-DE"
): Promise<{ url: string; contentType: string } | null> => {
  const base = buildIdmBase(environment);
  const query = `/Anfrage_Kunde[@Gelegenheit = "${opportunityId}"${project ? ` OR @Projekt = "${project}"` : ""}]`;
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
  project?: string,
  language: string = "de-DE"
): Promise<{ url: string; contentType: string } | null> => {
  const base = buildIdmBase(environment);
  const query = `/Anfrage_Kunde[@Gelegenheit = "${opportunityId}"${project ? ` OR @Projekt = "${project}"` : ""}]`;
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

  // DEBUG: helps to see the exact $query and the full request URL used by the document list
  console.log("[IDM] searchIdmItemsByEntityJson request:", {
    entityName,
    opportunityId,
    query,
    url,
  });

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

  // DEBUG: dump what fields the API actually returns so we can map created/modified fields correctly
  if (items.length > 0) {
    const first = items[0];
    const firstKeys = first && typeof first === "object" ? Object.keys(first) : [];

    const attrsRaw = first?.attrs?.attr ?? first?.attrs ?? first?.attr ?? [];
    const attrsList: any[] = Array.isArray(attrsRaw) ? attrsRaw : attrsRaw ? [attrsRaw] : [];
    const attrNames = attrsList
      .map((a) => String(a?.name ?? a?.n ?? a?.key ?? "").trim())
      .filter(Boolean);

    const resrs = first?.resrs ?? {};
    const resArrayRaw = (resrs?.res ?? resrs?.resr ?? []);
    const resList: any[] = Array.isArray(resArrayRaw) ? resArrayRaw : resArrayRaw ? [resArrayRaw] : [];
    const resNames = resList
      .map((r) => String(r?.name ?? r?.["name"] ?? "").trim())
      .filter((v, i, arr) => arr.indexOf(v) === i);

    console.log("[IDM] items/search first item field overview:", {
      entityName,
      opportunityId,
      topLevelKeys: firstKeys,
      attrNames,
      resourceNames: resNames,
      firstItemSample: first,
    });
  }

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

    // NEW: top-level created/changed fields (keep case-insensitive fallbacks for robustness)
    const createdByName: string | undefined =
      item?.createdByName ?? item?.CreatedByName ?? item?.createdBy ?? item?.CreatedBy;
    const createdTS: string | undefined =
      item?.createdTS ?? item?.CreatedTS ?? item?.createdAt ?? item?.CreatedAt;
    const lastChangedByName: string | undefined =
      item?.lastChangedByName ?? item?.LastChangedByName ?? item?.modifiedBy ?? item?.ModifiedBy;
    const lastChangedTS: string | undefined =
      item?.lastChangedTS ?? item?.LastChangedTS ?? item?.modifiedAt ?? item?.ModifiedAt;

    const chosen = small || preview;
    const pidRaw = (item as any)?.pid ?? (item as any)?.PID ?? (item as any)?.Pid; // capture PID

    const aclRaw = (item as any)?.acl;
    const acl = aclRaw
      ? {
          id: aclRaw?.id != null ? String(aclRaw.id) : undefined,
          name: aclRaw?.name != null ? String(aclRaw.name) : undefined,
        }
      : undefined;

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
        // NEW: attach system fields
        createdByName: createdByName ? String(createdByName) : undefined,
        createdTS: createdTS ? String(createdTS) : undefined,
        lastChangedByName: lastChangedByName ? String(lastChangedByName) : undefined,
        lastChangedTS: lastChangedTS ? String(lastChangedTS) : undefined,
        acl,
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
  options?: { aclName?: string; language?: string }
): Promise<void> => {
  const language = options?.language ?? "de-DE";
  const base = buildIdmBase(environment);
  const url =
    `${base}/api/items/${encodeURIComponent(pid)}?` +
    `%24checkout=true&%24checkin=true&%24merge=true&%24language=${encodeURIComponent(language)}`;

  const body: any = {
    item: {
      attrs: {
        attr: updates.map((u) => ({ name: u.name, value: u.value })),
      },
    },
  };

  if (options?.aclName) {
    body.item.acl = { name: options.aclName };
  }

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

/**
 * Change the document type (entityName) of an existing IDM item.
 *
 * Important: Some IDM document types don't support all attributes. Therefore we filter the given attributes
 * by the target entity schema before sending the PUT.
 */
export const changeIdmItemDocumentType = async (
  token: string,
  environment: CloudEnvironment,
  pid: string,
  newEntityName: string,
  attrs: { name: string; value: string }[] = [],
  options?: { aclName?: string; language?: string }
): Promise<void> => {
  const language = options?.language ?? "de-DE";
  const base = buildIdmBase(environment);

  const schemaAttrs = await getIdmEntityAttributes(token, environment, newEntityName, language);
  const allowed = new Set(schemaAttrs.map((a) => a.name));
  const filtered = (attrs || []).filter((a) => a?.name && allowed.has(a.name));

  const url =
    `${base}/api/items/${encodeURIComponent(pid)}?` +
    `%24checkout=true&%24checkin=true&%24merge=true&%24language=${encodeURIComponent(language)}`;

  const body: any = {
    item: {
      pid,
      entityName: newEntityName,
    },
  };

  if (options?.aclName) {
    body.item.acl = { name: options.aclName };
  }

  // Only include attrs if there is at least one valid attribute.
  // Sending an empty attr array can lead to "Attribute name: null" errors in some IDM setups.
  if (filtered.length > 0) {
    body.item.attrs = {
      attr: filtered.map((a) => ({ name: a.name, value: a.value })),
    };
  }

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
      `[IDM] change document type failed for PID '${pid}' -> '${newEntityName}': ${res.status} ${res.statusText} - ${errorText}`
    );
  }
};

// NEW: Replace IDM item resource (upload new file as base64)
export const replaceIdmItemResource = async (
  token: string,
  environment: CloudEnvironment,
  pid: string,
  file: { filename: string; base64: string },
  options?: { aclName?: string; language?: string }
): Promise<void> => {
  const language = options?.language ?? "de-DE";
  const base = buildIdmBase(environment);
  const url =
    `${base}/api/items/${encodeURIComponent(pid)}?` +
    `%24checkout=true&%24checkin=true&%24merge=true&%24language=${encodeURIComponent(language)}`;

  const body: any = {
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

  if (options?.aclName) {
    body.item.acl = { name: options.aclName };
  }

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

    const aclRaw = (item as any)?.acl;
    const acl = aclRaw
      ? {
          id: aclRaw?.id != null ? String(aclRaw.id) : undefined,
          name: aclRaw?.name != null ? String(aclRaw.name) : undefined,
        }
      : undefined;

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
        acl,
      });
    }
  }

  return previews;
};

export const getExistingLinkedPids = async (
  token: string,
  environment: CloudEnvironment,
  mainPid: string,
  language: string = "de-DE"
): Promise<string[]> => {
  const base = buildIdmBase(environment);
  const url = `${base}/api/items/${encodeURIComponent(mainPid)}?%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[IDM] get existing links failed for PID '${mainPid}': ${res.status} ${res.statusText} - ${errorText}`);
  }

  const json = await res.json();
  const root = (json as any)?.item ?? json;

  const collsContainer = root?.colls ?? {};
  const groupsRaw = (collsContainer?.coll ?? collsContainer) as any;
  const groups: any[] = Array.isArray(groupsRaw) ? groupsRaw : groupsRaw ? [groupsRaw] : [];

  const linkGroup = groups.find((g) => (g?.name ?? g?.["name"]) === "Dokument_Verlinkung");
  if (!linkGroup) return [];

  const entriesRaw = (linkGroup?.coll ?? linkGroup?.item ?? []) as any;
  const entries: any[] = Array.isArray(entriesRaw) ? entriesRaw : entriesRaw ? [entriesRaw] : [];

  const pids: string[] = [];
  for (const entry of entries) {
    const attrsRaw = (entry?.attrs?.attr ?? entry?.attrs ?? []) as any;
    const attrs: any[] = Array.isArray(attrsRaw) ? attrsRaw : attrsRaw ? [attrsRaw] : [];
    const valueAttr = attrs.find((a) => (a?.name ?? a?.n ?? a?.key) === "Value");
    const value = valueAttr?.value ?? valueAttr?.val ?? valueAttr?.v ?? valueAttr?._;
    if (value) pids.push(String(value));
  }

  return Array.from(new Set(pids.filter(Boolean)));
};

export const linkIdmItemDocuments = async (
  token: string,
  environment: CloudEnvironment,
  mainPid: string,
  mainEntityName: string,
  linkedPids: string[],
  language: string = "de-DE",
  options?: { aclName?: string }
): Promise<void> => {
  const base = buildIdmBase(environment);
  const url =
    `${base}/api/items/${encodeURIComponent(mainPid)}?` +
    `%24checkout=true&%24checkin=true&%24merge=true&%24language=${encodeURIComponent(language)}`;

  const collItems = linkedPids.map((pid) => ({
    entityName: "Dokument_Verlinkung",
    attrs: {
      attr: [
        {
          name: "Value",
          type: "1",
          qual: "Dokument_Verlinkung/Value",
          value: pid,
        },
      ],
    },
  }));

  const body: any = {
    item: {
      colls: [
        {
          name: "Dokument_Verlinkung",
          coll: collItems,
        },
      ],
      entityName: mainEntityName,
      pid: mainPid,
    },
  };

  if (options?.aclName) {
    body.item.acl = { name: options.aclName };
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/json;charset=utf-8",
      "Content-Type": "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[IDM] link documents failed for PID '${mainPid}': ${res.status} ${res.statusText} - ${errorText}`);
  }
};

export const getIdmItemByPid = async (
  token: string,
  environment: CloudEnvironment,
  pid: string,
  language: string = "de-DE"
): Promise<{ pid: string; filename?: string; entityName?: string; drillbackurl?: string; resourceUrl?: string; previewUrl?: string; aclName?: string }> => {
  const base = buildIdmBase(environment);
  const url = `${base}/api/items/${encodeURIComponent(pid)}?%24language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[IDM] get item by PID failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const json = await res.json();
  const item = (json as any)?.item ?? json;
  const filename =
    item?.filename ??
    (Array.isArray(item?.resrs?.res) ? item?.resrs?.res?.[0]?.filename : item?.resrs?.res?.filename) ??
    undefined;
  const entityName = item?.entityName ?? undefined;
  const drillbackurl = item?.drillbackurl ?? undefined;

  const aclName: string | undefined = item?.acl?.name != null ? String(item.acl.name) : undefined;

  // Extract main resource and preview URLs
  const resNodeRaw = item?.resrs?.res;
  const resList: any[] = Array.isArray(resNodeRaw) ? resNodeRaw : resNodeRaw ? [resNodeRaw] : [];
  const mainRes = resList.find((r) => (r?.name ?? r?.["name"]) === "") ?? resList[0];
  const previewRes = resList.find((r) => (r?.name ?? r?.["name"]) === "Preview");
  const resourceUrl = mainRes?.url ? String(mainRes.url) : undefined;
  const previewUrl = previewRes?.url ? String(previewRes.url) : undefined;

  return { pid, filename, entityName, drillbackurl, resourceUrl, previewUrl, aclName };
};

/**
 * INTERNAL: Updates ONLY the 'Dokument_Verlinkung' collection for a PID.
 * This is intentionally narrow because some entity types have other collections that we must not PUT back.
 */
const setIdmItemLinkedPids = async (
  token: string,
  environment: CloudEnvironment,
  pid: string,
  linkedPids: string[],
  language: string = "de-DE"
): Promise<void> => {
  const info = await getIdmItemByPid(token, environment, pid, language);
  const entityName = String(info?.entityName ?? "");
  if (!entityName) {
    throw new Error(`[IDM] Cannot determine entityName for PID '${pid}' when updating links.`);
  }
  await linkIdmItemDocuments(token, environment, pid, entityName, linkedPids, language, {
    aclName: info?.aclName,
  });
};

export const unlinkIdmItemDocument = async (
  token: string,
  environment: CloudEnvironment,
  mainPid: string,
  removePid: string,
  language: string = "de-DE"
): Promise<void> => {
  const existing = await getExistingLinkedPids(token, environment, mainPid, language);
  if (!existing.length) return;

  const remaining = existing.filter((p) => String(p) !== String(removePid));
  // Nothing to do
  if (remaining.length === existing.length) return;

  await setIdmItemLinkedPids(token, environment, mainPid, remaining, language);
};

export const unlinkIdmItemDocuments = async (
  token: string,
  environment: CloudEnvironment,
  mainPid: string,
  removePids: string[],
  language: string = "de-DE"
): Promise<void> => {
  const toRemove = new Set((removePids || []).map(String));
  if (toRemove.size === 0) return;

  const existing = await getExistingLinkedPids(token, environment, mainPid, language);
  if (!existing.length) return;

  const remaining = existing.filter((p) => !toRemove.has(String(p)));
  if (remaining.length === existing.length) return;

  await setIdmItemLinkedPids(token, environment, mainPid, remaining, language);
};

// NEW: Create bidirectional links (A<->B). Ensures both sides contain each other's PID in 'Dokument_Verlinkung'.
export const linkIdmItemDocumentsBidirectional = async (
  token: string,
  environment: CloudEnvironment,
  mainPid: string,
  mainEntityName: string,
  linkedPids: string[],
  language: string = "de-DE"
): Promise<void> => {
  // Normalize and remove self-links
  const cleanTargets = Array.from(new Set((linkedPids || []).map(String))).filter((p) => p && p !== mainPid);

  // Update main item (A) to include all target PIDs (B...)
  const existingMain = await getExistingLinkedPids(token, environment, mainPid, language);
  const combinedMain = Array.from(new Set([...(existingMain || []), ...cleanTargets]));

  // Fetch current ACL for main item so we can re-send it with the PUT
  const mainInfo = await getIdmItemByPid(token, environment, mainPid, language);

  await linkIdmItemDocuments(token, environment, mainPid, mainEntityName, combinedMain, language, {
    aclName: mainInfo?.aclName,
  });

  // For each target PID (B), include back-link to main (A)
  for (const pid of cleanTargets) {
    const existingTarget = await getExistingLinkedPids(token, environment, pid, language);
    const needsBacklink = !(existingTarget || []).includes(mainPid);
    const combinedTarget = needsBacklink
      ? Array.from(new Set([...(existingTarget || []), mainPid]))
      : existingTarget || [];

    // Find correct entityName + ACL for target item
    const targetInfo = await getIdmItemByPid(token, environment, pid, language);
    const targetEntityName = String(targetInfo?.entityName || "");
    if (!targetEntityName) {
      throw new Error(`[IDM] Cannot determine entityName for PID '${pid}' when creating backlink to '${mainPid}'.`);
    }

    await linkIdmItemDocuments(token, environment, pid, targetEntityName, combinedTarget, language, {
      aclName: targetInfo?.aclName,
    });
  }
};

// NEW: Remove a single link bidirectionally (A-×-B removes A->B and B->A)
export const unlinkIdmItemDocumentBidirectional = async (
  token: string,
  environment: CloudEnvironment,
  mainPid: string,
  removePid: string,
  language: string = "de-DE"
): Promise<void> => {
  // Entferne Link von Hauptdokument (A -> B)
  await unlinkIdmItemDocument(token, environment, mainPid, removePid, language);

  // Rückverlinkung nur entfernen, wenn sie existiert (B -> A)
  const existingTarget = await getExistingLinkedPids(token, environment, removePid, language);
  if ((existingTarget || []).includes(mainPid)) {
    await unlinkIdmItemDocument(token, environment, removePid, mainPid, language);
  }
};

export const unlinkIdmItemDocumentsBidirectional = async (
  token: string,
  environment: CloudEnvironment,
  mainPid: string,
  removePids: string[],
  language: string = "de-DE"
): Promise<void> => {
  if (!removePids?.length) return;

  // Entferne alle Links vom Hauptdokument (A -> [B...])
  await unlinkIdmItemDocuments(token, environment, mainPid, removePids, language);

  // Rückverlinkungen nur dort entfernen, wo sie existieren (B -> A)
  for (const pid of removePids) {
    const existingTarget = await getExistingLinkedPids(token, environment, pid, language);
    if ((existingTarget || []).includes(mainPid)) {
      await unlinkIdmItemDocument(token, environment, pid, mainPid, language);
    }
  }
};