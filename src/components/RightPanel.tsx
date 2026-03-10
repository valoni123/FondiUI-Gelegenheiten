"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

import { ChevronLeft, FileWarning, Loader2, Check, X, ArrowLeftRight, ChevronRight, Trash2, Link as LinkIcon, ExternalLink, Upload, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/utils/toast";
import {
  searchIdmItemsByEntityJson,
  type IdmDocPreview,
  updateIdmItemAttributes,
  changeIdmItemDocumentType,
  searchIdmItemsByXQueryJson,
  getIdmItemByPid,
} from "@/api/idm";
import { toast } from "@/components/ui/use-toast";
import { type CloudEnvironment } from "@/authorization/configLoader";
import {
  Dialog,
  DialogContent,
  DialogHeader, // Keep DialogHeader import for other uses if any, but not used directly here
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import DocAttributesGrid, { type DocAttributesGridHandle } from "./DocAttributesGrid";
import { replaceIdmItemResource, deleteIdmItem } from "@/api/idm";
import ReplacementDropzone from "@/components/ReplacementDropzone"; // Import ReplacementDropzone
import UploadDialog from "@/components/UploadDialog"; // Import UploadDialog
import LinkDocumentsDialog from "@/components/LinkDocumentsDialog"; // Import LinkDocumentsDialog
import LinkedDocumentsDialog from "@/components/LinkedDocumentsDialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface RightPanelProps {
  selectedOpportunityId: string;
  onClose: () => void;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  entityNames: string[];
  entityOptions?: { name: string; desc: string }[];
  selectedOpportunityProject?: string; // New optional prop
  selectedOpportunityArticle?: string; // New optional prop
}

const RightPanel: React.FC<RightPanelProps> = ({
  selectedOpportunityId,
  onClose,
  authToken,
  cloudEnvironment,
  entityNames,
  entityOptions,
  selectedOpportunityProject, // New optional prop
  selectedOpportunityArticle, // New optional prop
}) => {
  const forceDownload = React.useCallback(async (url: string, filename?: string) => {
    const safeName = (filename || "download")
      .trim()
      .replace(/[\\/?:%*|"<>]/g, "_")
      .slice(0, 180);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: let the browser handle it (may open inline for some types)
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleShare = React.useCallback(async () => {
    const url = window.location.href;
    const title = `Gelegenheit ${selectedOpportunityId}`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      showSuccess("Link kopiert");
    } catch (e) {
      showError("Teilen nicht möglich");
    }
  }, [selectedOpportunityId]);

  const lastInitialLoadKeyRef = React.useRef<string | null>(null);
  const silentReloadInFlightRef = React.useRef(false);

  const [files, setFiles] = React.useState<File[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [docPreviews, setDocPreviews] = React.useState<IdmDocPreview[]>([]);
  // CHANGED: Start in loading state to avoid initial "Keine Dokumente gefunden" flicker on first mount.
  const [isPreviewsLoading, setIsPreviewsLoading] = React.useState<boolean>(true);

  // Full preview state
  const [fullPreviewData, setFullPreviewData] = React.useState<IdmDocPreview | null>(null);
  const [isFullPreviewDialogOpen, setIsFullPreviewDialogOpen] = React.useState(false);
  const [fullPreviewIndex, setFullPreviewIndex] = React.useState<number | null>(null);
  const [isFullPreviewLoading, setIsFullPreviewLoading] = React.useState(false);

  // Dialog state inside full preview
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = React.useState(false);
  const [isReplacing, setIsReplacing] = React.useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = React.useState(false);

  const docListGridRef = React.useRef<DocAttributesGridHandle | null>(null);
  const detailGridRef = React.useRef<DocAttributesGridHandle | null>(null);

  const [backUnsavedDialogOpen, setBackUnsavedDialogOpen] = React.useState(false);
  const [backUnsavedSaving, setBackUnsavedSaving] = React.useState(false);
  const [backUnsavedSaveFailed, setBackUnsavedSaveFailed] = React.useState(false);

  const handleBackToOverview = React.useCallback(() => {
    const hasUnsavedList = !!docListGridRef.current?.hasUnsavedChanges();
    const hasUnsavedDetail = !!detailGridRef.current?.hasUnsavedChanges();

    if (hasUnsavedList || hasUnsavedDetail) {
      setBackUnsavedSaveFailed(false);
      setBackUnsavedDialogOpen(true);
      return;
    }

    // Any navigation/close clears the one-time highlight
    setHighlightedDocKeys([]);
    onClose();
  }, [onClose]);

  const getDocKey = React.useCallback((doc: IdmDocPreview) => {
    if (doc.pid) return `pid:${doc.pid}`;
    // fallback when pid is missing (avoid preview URLs because they can be re-signed every poll)
    return `f:${doc.entityName ?? ""}|${doc.filename ?? ""}|${doc.createdTS ?? ""}|${doc.lastChangedTS ?? ""}`;
  }, []);

  const sortDocsByCreatedAt = React.useCallback((docs: IdmDocPreview[]) => {
    const toMs = (v?: string) => {
      if (!v) return Number.NEGATIVE_INFINITY;
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
    };

    // Newest first (descending). Stable tie-breakers for deterministic ordering.
    return [...docs].sort((a, b) => {
      const diff = toMs(b.createdTS) - toMs(a.createdTS);
      if (diff !== 0) return diff;

      const diffChanged = toMs(b.lastChangedTS) - toMs(a.lastChangedTS);
      if (diffChanged !== 0) return diffChanged;

      const aKey = getDocKey(a);
      const bKey = getDocKey(b);
      return aKey.localeCompare(bKey, "de");
    });
  }, [getDocKey]);

  const [highlightedDocKeys, setHighlightedDocKeys] = React.useState<string[]>([]);

  const highlightedDocKeySet = React.useMemo(
    () => new Set(highlightedDocKeys),
    [highlightedDocKeys]
  );

  const isDocHighlighted = React.useCallback(
    (doc: IdmDocPreview) => highlightedDocKeySet.has(getDocKey(doc)),
    [highlightedDocKeySet, getDocKey]
  );

  const linkedProjectXQuery = React.useMemo(() => {
    const project = (selectedOpportunityProject ?? "").toString().trim();
    if (!project) return null;
    return (
      `/Anfrage_Kunde[Projekt_Verlinkung/@Value = "${project}"] ` +
      `UNION /_Anfrage__Lieferant_[Projekt_Verlinkung/@Value = "${project}"] ` +
      `SORTBY(@LASTCHANGEDTS DESCENDING)`
    );
  }, [selectedOpportunityProject]);

  const mergeDocs = React.useCallback((primary: IdmDocPreview[], linked: IdmDocPreview[]) => {
    const byKey = new Map<string, IdmDocPreview>();

    for (const d of primary) {
      byKey.set(getDocKey(d), d);
    }

    for (const d of linked) {
      const key = getDocKey(d);
      const existing = byKey.get(key);
      if (existing) {
        byKey.set(key, {
          ...existing,
          linkedViaProject: existing.linkedViaProject || true,
          linkedProjectValue: existing.linkedProjectValue || d.linkedProjectValue,
        });
      } else {
        byKey.set(key, d);
      }
    }

    return Array.from(byKey.values());
  }, [getDocKey]);

  const mergePreservePrevOrder = React.useCallback(
    (prev: IdmDocPreview[], next: IdmDocPreview[]) => {
      const nextByKey = new Map(next.map((d) => [getDocKey(d), d] as const));
      const used = new Set<string>();
      const ordered: IdmDocPreview[] = [];

      for (const d of prev) {
        const key = getDocKey(d);
        const n = nextByKey.get(key);
        if (n) {
          ordered.push(n);
          used.add(key);
        }
      }

      for (const d of next) {
        const key = getDocKey(d);
        if (used.has(key)) continue;
        ordered.push(d);
        used.add(key);
      }

      return ordered;
    },
    [getDocKey]
  );

  const getDocSig = React.useCallback((doc: IdmDocPreview) => {
    const attrsSig = (doc.attributes ?? [])
      .filter((a) => a?.name)
      .map((a) => `${a.name}=${String(a.value ?? "")}`)
      .sort()
      .join("|");

    // IMPORTANT: Do NOT include preview URLs in the signature.
    // IDM often returns freshly signed URLs on each request which would cause unnecessary
    // state updates and visible thumbnail reload flicker, even when the document did not change.
    return [
      String(doc.pid ?? ""),
      String(doc.entityName ?? ""),
      String(doc.filename ?? ""),
      String(doc.lastChangedTS ?? ""),
      String(doc.createdTS ?? ""),
      String(doc.linkedViaProject ? "1" : "0"),
      String(doc.linkedProjectValue ?? ""),
      attrsSig,
    ].join("||");
  }, []);

  const areDocListsEqual = React.useCallback(
    (a: IdmDocPreview[], b: IdmDocPreview[]) => {
      if (a.length !== b.length) return false;
      const mapA = new Map(a.map((d) => [getDocKey(d), getDocSig(d)]));
      for (const d of b) {
        const key = getDocKey(d);
        if (!mapA.has(key)) return false;
        if (mapA.get(key) !== getDocSig(d)) return false;
      }
      return true;
    },
    [getDocKey, getDocSig]
  );

  const fetchLinkedProjectDocs = React.useCallback(async (): Promise<IdmDocPreview[]> => {
    if (!linkedProjectXQuery || !authToken) return [];
    const project = (selectedOpportunityProject ?? "").toString().trim();
    const docs = await searchIdmItemsByXQueryJson(
      authToken,
      cloudEnvironment,
      linkedProjectXQuery,
      0,
      200,
      "de-DE"
    );
    return docs.map((d) => ({
      ...d,
      linkedViaProject: true,
      linkedProjectValue: project,
    }));
  }, [linkedProjectXQuery, authToken, cloudEnvironment, selectedOpportunityProject]);

  type DocFilterKey =
    | "FME_GEOM_KUNDE"
    | "FME_SERIE_GUELTIG"
    | "FME_VERSUCH_GUELTIG"
    | "FSI_GEOM_KUNDE"
    | "FSI_SERIE_GUELTIG"
    | "FSI_VERSUCH_GUELTIG";

  const docFilters = React.useMemo(
    () =>
      [
        {
          key: "FME_GEOM_KUNDE" as const,
          label: "FME Geometrien‑Kunde",
          xquery: `/_Geometriedaten[@Gelegenheit = "${selectedOpportunityId}" AND @Ort = "10"]`,
        },
        {
          key: "FME_SERIE_GUELTIG" as const,
          label: "Serie gültig FME",
          xquery:
            `/_Geometriedaten[@Gelegenheit = "${selectedOpportunityId}" AND @Ort = "10" AND (` +
            `@Status = "60" OR @Status = "50"` +
            `) AND (` +
            `@Serienstatus = "2" OR @Serienstatus = "1" OR @Serienstatus = "3"` +
            `)]`,
        },
        {
          key: "FME_VERSUCH_GUELTIG" as const,
          label: "Versuch gültig FME",
          xquery:
            `/_Geometriedaten[@Gelegenheit = "${selectedOpportunityId}" AND @Ort = "10" AND (` +
            `@Status = "60" OR @Status = "50"` +
            `) AND (` +
            `@Versuchsstatus = "10" OR @Versuchsstatus = "20" OR @Versuchsstatus = "30"` +
            `)]`,
        },
        {
          key: "FSI_GEOM_KUNDE" as const,
          label: "FSI Geometrie‑Kunde",
          xquery: `/_Geometriedaten[@Gelegenheit = "${selectedOpportunityId}" AND @Ort = "20"]`,
        },
        {
          key: "FSI_SERIE_GUELTIG" as const,
          label: "Serie gültig FSI",
          xquery:
            `/_Geometriedaten[@Gelegenheit = "${selectedOpportunityId}" AND @Ort = "20" AND (` +
            `@Status = "60" OR @Status = "50"` +
            `) AND (` +
            `@Serienstatus = "2" OR @Serienstatus = "1" OR @Serienstatus = "3"` +
            `)]`,
        },
        {
          key: "FSI_VERSUCH_GUELTIG" as const,
          label: "Versuch gültig FSI",
          xquery:
            `/_Geometriedaten[@Gelegenheit = "${selectedOpportunityId}" AND @Ort = "20" AND (` +
            `@Status = "60" OR @Status = "50"` +
            `) AND (` +
            `@Versuchsstatus = "10" OR @Versuchsstatus = "20" OR @Versuchsstatus = "30"` +
            `)]`,
        },
      ] as const,
    [selectedOpportunityId]
  );

  const fetchDocsForFilter = React.useCallback(
    async (filterKey: DocFilterKey | null): Promise<IdmDocPreview[]> => {
      if (!selectedOpportunityId || !authToken) return [];

      if (!filterKey) {
        const [results, linkedResults] = await Promise.all([
          Promise.allSettled(
            entityNames.map((name) =>
              searchIdmItemsByEntityJson(authToken, cloudEnvironment, selectedOpportunityId, name)
            )
          ),
          fetchLinkedProjectDocs().catch(() => []),
        ]);

        const merged: IdmDocPreview[] = [];
        results.forEach((r) => {
          if (r.status === "fulfilled" && Array.isArray(r.value)) {
            merged.push(...r.value);
          }
        });
        return sortDocsByCreatedAt(mergeDocs(merged, linkedResults));
      }

      const filter = docFilters.find((f) => f.key === filterKey);
      if (!filter) {
        return fetchDocsForFilter(null);
      }

      const [docs, linked] = await Promise.all([
        searchIdmItemsByXQueryJson(authToken, cloudEnvironment, filter.xquery, 0, 200, "de-DE"),
        fetchLinkedProjectDocs().catch(() => []),
      ]);

      return sortDocsByCreatedAt(mergeDocs(docs, linked));
    },
    [
      selectedOpportunityId,
      authToken,
      entityNames,
      cloudEnvironment,
      docFilters,
      fetchLinkedProjectDocs,
      mergeDocs,
      sortDocsByCreatedAt,
    ]
  );

  // Reload with visible loader (used for initial load and user-triggered actions)
  const reloadPreviews = React.useCallback(
    async (opts?: { highlightNewFromKeys?: string[] }) => {
      if (!selectedOpportunityId || !authToken || !entityNames?.length) return;

      if (!opts?.highlightNewFromKeys) {
        setHighlightedDocKeys([]);
      }

      setIsPreviewsLoading(true);
      try {
        const combined = await fetchDocsForFilter(null);

        if (opts?.highlightNewFromKeys) {
          const prev = new Set(opts.highlightNewFromKeys);
          const newKeys = combined.map(getDocKey).filter((k) => !prev.has(k));
          setHighlightedDocKeys(newKeys);
        }

        setDocPreviews(combined);
      } finally {
        setIsPreviewsLoading(false);
      }
    },
    [selectedOpportunityId, authToken, entityNames, fetchDocsForFilter, getDocKey]
  );

  const [activeDocFilter, setActiveDocFilter] = React.useState<DocFilterKey | null>(null);

  const applyDocFilter = React.useCallback(
    async (filterKey: DocFilterKey | null) => {
      if (!selectedOpportunityId || !authToken) return;
      setActiveDocFilter(filterKey);

      // clear any full preview highlight when changing filters
      setHighlightedDocKeys([]);

      if (!filterKey) {
        await reloadPreviews();
        return;
      }

      setIsPreviewsLoading(true);
      try {
        const combined = await fetchDocsForFilter(filterKey);
        setDocPreviews(combined);
      } catch (err: any) {
        const raw = String(err?.message ?? err ?? "Unbekannter Fehler");

        const jsonStart = raw.indexOf("{");
        const jsonText = jsonStart >= 0 ? raw.slice(jsonStart) : "";

        let title = "Filter konnte nicht angewendet werden";
        let description = raw;

        if (jsonText) {
          try {
            const parsed = JSON.parse(jsonText);
            const msg = parsed?.error?.message;
            const detail = parsed?.error?.detail;
            if (msg) title = String(msg);
            if (detail) description = String(detail);
          } catch {
            // ignore
          }
        }

        toast({
          title: (
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4 text-white" />
              {title}
            </span>
          ),
          description,
          variant: "destructive",
        });
      } finally {
        setIsPreviewsLoading(false);
      }
    },
    [selectedOpportunityId, authToken, reloadPreviews, fetchDocsForFilter]
  );

  // Initial load for this opportunity when no filter is active.
  React.useEffect(() => {
    if (!selectedOpportunityId || !authToken) {
      setDocPreviews([]);
      setIsPreviewsLoading(false);
      return;
    }
    if (activeDocFilter) return;
    reloadPreviews();
  }, [selectedOpportunityId, authToken, entityNames, activeDocFilter, reloadPreviews]);

  // Silent reload every 10 seconds (like overview). If the user has unsaved edits, we skip the reload
  // to avoid overwriting what they're currently editing.
  React.useEffect(() => {
    if (!selectedOpportunityId || !authToken) return;

    const id = window.setInterval(async () => {
      if (silentReloadInFlightRef.current) return;

      const hasUnsavedList = !!docListGridRef.current?.hasUnsavedChanges();
      const hasUnsavedDetail = !!detailGridRef.current?.hasUnsavedChanges();
      if (hasUnsavedList || hasUnsavedDetail) return;

      silentReloadInFlightRef.current = true;
      try {
        const combined = await fetchDocsForFilter(activeDocFilter);
        setDocPreviews((prev) => {
          if (areDocListsEqual(prev, combined)) return prev;
          // Sorting is required: keep the canonical order from the backend data.
          return combined;
        });
      } finally {
        silentReloadInFlightRef.current = false;
      }
    }, 10000);

    return () => window.clearInterval(id);
  }, [selectedOpportunityId, authToken, activeDocFilter, fetchDocsForFilter, areDocListsEqual]);

  // Re-apply active filter if opportunity changes
  React.useEffect(() => {
    if (!activeDocFilter) return;
    applyDocFilter(activeDocFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOpportunityId, authToken]);

  const openFullPreview = React.useCallback(
    (doc: IdmDocPreview) => {
      // Any user action can clear the one-time highlight
      setHighlightedDocKeys([]);
      setFullPreviewData(doc);
      setIsFullPreviewDialogOpen(true);

      // Enrich with drillbackurl/resourceUrl for actions (view in IDM / download)
      // without blocking the UI.
      if (doc.pid) {
        getIdmItemByPid(authToken, cloudEnvironment, doc.pid, "de-DE")
          .then((info) => {
            setFullPreviewData((prev) => {
              if (!prev || prev.pid !== doc.pid) return prev;
              return {
                ...prev,
                drillbackurl: prev.drillbackurl ?? info.drillbackurl,
                resourceUrl: prev.resourceUrl ?? info.resourceUrl,
                previewUrl: prev.previewUrl ?? info.previewUrl,
              };
            });
          })
          .catch(() => {
            // ignore; actions will just stay disabled
          });
      }

      // compute index in current docPreviews
      const byPid = docPreviews.findIndex((d) => d.pid && d.pid === doc.pid);
      let idx = byPid;
      if (idx < 0) {
        idx = docPreviews.findIndex((d) => d.smallUrl === doc.smallUrl && d.filename === doc.filename);
      }
      if (idx < 0) {
        idx = docPreviews.findIndex((d) => d.filename === doc.filename);
      }
      setFullPreviewIndex(idx >= 0 ? idx : null);
      setIsFullPreviewLoading(false);
    },
    [docPreviews, authToken, cloudEnvironment]
  );

  // Keep index in sync if the list or doc changes (e.g., after replacements or reloads)
  React.useEffect(() => {
    if (!fullPreviewData) {
      setFullPreviewIndex(null);
      return;
    }
    const byPid = docPreviews.findIndex((d) => d.pid && d.pid === fullPreviewData.pid);
    let idx = byPid;
    if (idx < 0) {
      idx = docPreviews.findIndex(
        (d) => d.smallUrl === fullPreviewData.smallUrl && d.filename === fullPreviewData.filename
      );
    }
    if (idx < 0) {
      idx = docPreviews.findIndex((d) => d.filename === fullPreviewData.filename);
    }
    setFullPreviewIndex(idx >= 0 ? idx : null);
  }, [docPreviews, fullPreviewData]);

  const goToPrev = React.useCallback(() => {
    if (fullPreviewIndex == null) return;
    const prevIdx = fullPreviewIndex - 1;
    if (prevIdx >= 0) {
      const doc = docPreviews[prevIdx];
      if (doc) openFullPreview(doc);
    }
  }, [fullPreviewIndex, docPreviews, openFullPreview]);

  const goToNext = React.useCallback(() => {
    if (fullPreviewIndex == null) return;
    const nextIdx = fullPreviewIndex + 1;
    if (nextIdx < docPreviews.length) {
      const doc = docPreviews[nextIdx];
      if (doc) openFullPreview(doc);
    }
  }, [fullPreviewIndex, docPreviews, openFullPreview]);

  // ADD: Save handler
  const handleSaveRow = async (
    doc: IdmDocPreview,
    updates: { name: string; value: string }[],
    options?: { entityName?: string }
  ) => {
    if (!doc.pid) return { ok: false, errorAttributes: [] };

    const newEntityName = options?.entityName?.trim();
    const aclName = doc.acl?.name;

    try {
      if (newEntityName && newEntityName.length > 0 && newEntityName !== (doc.entityName ?? "")) {
        await changeIdmItemDocumentType(authToken, cloudEnvironment, doc.pid, newEntityName, updates, {
          language: "de-DE",
          aclName,
        });
      } else {
        await updateIdmItemAttributes(authToken, cloudEnvironment, doc.pid, updates, {
          language: "de-DE",
          aclName,
        });
      }

      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" />
            Änderungen gespeichert
          </span>
        ),
        variant: "success",
      });
      await reloadPreviews();
      return { ok: true };
    } catch (err: any) {
      const xml = err.message || "";
      const messageMatch = xml.match(/<message>(.*?)<\/message>/i);
      const detailMatch = xml.match(/<detail>(.*?)<\/detail>/i);
      const userMsg = messageMatch?.[1] || "Fehler beim Speichern";
      const userDetail = detailMatch?.[1] || "";

      const detailText = userDetail || "";
      const attrNameMatch = detailText.match(/Attribute name:\s*([^,]+)/i);
      const failedAttr = attrNameMatch?.[1]?.trim();
      const failedAttrs = failedAttr ? [failedAttr] : undefined;

      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 text-white" />
            {userMsg}
          </span>
        ),
        description: userDetail,
        variant: "destructive",
      });
      return { ok: false, errorAttributes: failedAttrs };
    }
  };

  // ADD: Replace handler
  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleReplaceDoc = async (doc: IdmDocPreview, file: File) => {
    if (!doc.pid) return false;
    try {
      const base64 = await fileToBase64(file);
      await replaceIdmItemResource(authToken, cloudEnvironment, doc.pid, {
        filename: file.name,
        base64,
      }, {
        language: "de-DE",
        aclName: doc.acl?.name,
      });
      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" />
            Dokument ersetzt
          </span>
        ),
        variant: "success",
      });
      await reloadPreviews();
      return true;
    } catch (err: any) {
      const errorText = String(err?.message ?? err ?? "Unbekannter Fehler");
      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 text-white" />
            Ersetzen fehlgeschlagen
          </span>
        ),
        description: errorText,
        variant: "destructive",
      });
      return false;
    }
  };

  // DELETE handler
  const handleDeleteDoc = async (doc: IdmDocPreview) => {
    if (!doc.pid) return false;
    try {
      await deleteIdmItem(authToken, cloudEnvironment, doc.pid);
      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" />
            Dokument gelöscht
          </span>
        ),
        variant: "success",
      });
      // If the deleted doc is currently open in full preview, close it
      if (fullPreviewData?.pid && fullPreviewData.pid === doc.pid) {
        setIsFullPreviewDialogOpen(false);
      }
      await reloadPreviews();
      return true;
    } catch (err: any) {
      const errorText = String(err?.message ?? err ?? "Unbekannter Fehler");
      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 text-white" />
            Löschen fehlgeschlagen
          </span>
        ),
        description: errorText,
        variant: "destructive",
      });
      return false;
    }
  };

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const toAdd = incoming.filter(
        (f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`)
      );
      const combined = [...prev, ...toAdd];
      if (toAdd.length) {
        showSuccess(`${toAdd.length} Datei(en) hinzugefügt`);
        setIsUploadDialogOpen(true); // OPEN dialog when new files are added
      }
      return combined;
    });
  };

  return (
    <div className="flex h-full flex-col p-4 overflow-hidden">
      {/* Header: title + actions on first row, info block on its own row below */}
      <div className="mb-3 flex flex-col">
        <div className="flex items-center">
          <div className="flex-1">
            <div className="text-lg font-semibold">
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>Auswahl: {selectedOpportunityId}</span>
                {(() => {
                  const projectText = (selectedOpportunityProject ?? "").toString();
                  if (!projectText.trim()) return null;
                  return (
                    <>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="max-w-[360px] truncate" title={projectText}>
                        Projekt: {projectText}
                      </span>
                    </>
                  );
                })()}
                {(() => {
                  const articleText = (selectedOpportunityArticle ?? "").toString();
                  if (!articleText.trim()) return null;
                  return (
                    <>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="max-w-[420px] truncate" title={articleText}>
                        Artikel: {articleText}
                      </span>
                    </>
                  );
                })()}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={handleBackToOverview} size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Zur Übersicht
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(
                  "https://fondiumeu.sharepoint.com/sites/Managementsystem-Nachweise/_layouts/15/listforms.aspx",
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
              title="Zu SharePoint"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Zu SharePoint
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              title="Link zur Gelegenheit teilen"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Teilen
            </Button>
            {/* Upload button with icon; same size and style as others */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              title="Neue Dokumente hochladen"
            >
              <Upload className="mr-2 h-4 w-4" />
              Dokumente hochladen
            </Button>
            {/* Hidden file input to trigger native picker */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = e.target.files;
                if (!list || list.length === 0) return;
                addFiles(Array.from(list));
                // Reset the input value so the same files can be selected again if needed
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      </div>

      <Card className="flex-grow flex flex-col min-h-0">
        <CardContent className="p-6 flex flex-1 flex-col min-h-0 overflow-hidden">
          {/* Upload dialog remains mounted; opened via header button */}
          <UploadDialog
            open={isUploadDialogOpen}
            onOpenChange={(open) => {
              setIsUploadDialogOpen(open);
              if (!open) {
                // Clear pending files when dialog closes so reopening starts fresh
                setFiles([]);
              }
            }}
            files={files}
            entityNames={entityNames}
            entityOptions={entityOptions}
            authToken={authToken}
            cloudEnvironment={cloudEnvironment}
            onCompleted={async () => {
              setFiles([]);
              const prevKeys = docPreviews.map(getDocKey);
              await reloadPreviews({ highlightNewFromKeys: prevKeys });
            }}
            defaultOpportunityNumber={selectedOpportunityId}
            defaultProjectName={(selectedOpportunityProject ?? "").toString()}
          />
          {/* REMOVED: Separator above filter section */}

          {/* FILTER: Quick filters for document list */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="text-sm font-medium text-muted-foreground">Filter:</div>
            {docFilters.map((f) => {
              const active = activeDocFilter === f.key;
              return (
                <Button
                  key={f.key}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className={active ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                  onClick={() => applyDocFilter(active ? null : f.key)}
                >
                  {f.label}
                </Button>
              );
            })}
            {activeDocFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => applyDocFilter(null)}
              >
                Filter zurücksetzen
              </Button>
            )}
          </div>

          {/* MITTE: Dokumentenliste (scrolls, sticky header inside) */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <DocAttributesGrid
                ref={docListGridRef}
                title="Dokumentenliste"
                docs={docPreviews}
                contextKey={selectedOpportunityId}
                maxDataColumnWidthPx={200}
                highlightedDocKeys={highlightedDocKeys}
                onOpenFullPreview={openFullPreview}
                onSaveRow={handleSaveRow}
                onReplaceDoc={handleReplaceDoc}
                onDeleteDoc={handleDeleteDoc}
                authToken={authToken}
                cloudEnvironment={cloudEnvironment}
                entityOptions={entityOptions}
                hideProjectColumn={true}
                isLoading={isPreviewsLoading}
                activeDocFilter={activeDocFilter}
              />
            </div>
          </div>

          <Separator className="mt-4 mb-4" />

          {/* UNTEN: Dokumentenvorschau (no fixed-height scroll; let outer page scroll) */}
          <div className="flex-shrink-0">
            <div className="mb-2 text-sm font-medium text-muted-foreground">Dokumentenvorschau</div>
            <div className="rounded-md border p-3">
              {isPreviewsLoading ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Vorschauen werden geladen…
                </div>
              ) : docPreviews.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Keine Vorschauen gefunden.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {docPreviews.map((doc, idx) => (
                    <div
                      key={getDocKey(doc)}
                      className={cn(
                        "group relative flex h-40 items-center justify-center overflow-hidden rounded-md border bg-accent/30 cursor-pointer",
                        isDocHighlighted(doc) && "border-red-400 ring-1 ring-red-400"
                      )}
                      onClick={() => openFullPreview(doc)}
                      title={doc.filename || "Vorschau öffnen"}
                    >
                      {doc.linkedViaProject ? (
                        <Badge
                          variant="default"
                          className="absolute left-2 top-2 z-10 bg-gray-700 text-white border border-gray-800 shadow-sm text-[11px] px-2 py-0.5 font-semibold"
                        >
                          verlinkt
                        </Badge>
                      ) : null}
                      {doc.smallUrl ? (
                        <img
                          src={doc.smallUrl}
                          alt={doc.filename || `Vorschau ${idx + 1}`}
                          className="max-h-full max-w-full object-contain transition-transform group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <FileWarning className="h-10 w-10 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Keine SmallPreview</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {doc.filename || "Dokument"}
                        {doc.entityName ? (
                          <span className="text-white/80"> · {doc.entityName}</span>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 bg-white/80 hover:bg-white text-black opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFullPreview(doc);
                        }}
                        title="Details anzeigen"
                      >
                        <ChevronLeft className="h-3 w-3 rotate-180" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Preview Dialog */}
      <Dialog open={isFullPreviewDialogOpen} onOpenChange={setIsFullPreviewDialogOpen}>
        <DialogContent className="max-w-6xl sm:max-w-7xl h-[90vh] flex flex-col">
          {/* Custom header area with title, description, and replace button */}
          <div className="flex flex-col pb-4">
            <div className="flex flex-col">
              <DialogTitle>Vollständige Vorschau</DialogTitle>
              <DialogDescription>
                {fullPreviewData?.filename ? `Vorschau für: ${fullPreviewData.filename}` : "Vorschau"}
              </DialogDescription>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                {fullPreviewData && (
                  <>
                    <LinkedDocumentsDialog
                      authToken={authToken}
                      cloudEnvironment={cloudEnvironment}
                      mainPid={fullPreviewData?.pid}
                      trigger={({ setOpen }) => (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!fullPreviewData?.pid}
                          onClick={() => setOpen(true)}
                          title={fullPreviewData?.pid ? "Verlinkte Dokumente anzeigen" : "Kein Hauptdokument ausgewählt"}
                        >
                          <LinkIcon className="mr-2 h-4 w-4" />
                          Verlinkte Dokumente
                        </Button>
                      )}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!fullPreviewData.drillbackurl}
                      onClick={() => {
                        if (fullPreviewData.drillbackurl) {
                          window.open(fullPreviewData.drillbackurl, "_blank", "noopener,noreferrer");
                        }
                      }}
                      title="in IDM anzeigen"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      in IDM anzeigen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!fullPreviewData.resourceUrl}
                      onClick={() => {
                        if (fullPreviewData.resourceUrl) {
                          forceDownload(fullPreviewData.resourceUrl, fullPreviewData.filename);
                        }
                      }}
                      title="Herunterladen"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Herunterladen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsLinkDialogOpen(true)}
                      title="Dokument(e) verlinken"
                    >
                      <LinkIcon className="mr-2 h-4 w-4" /> Dokument(e) verlinken
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsReplaceDialogOpen(true)}
                      title="Dokument ersetzen"
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" /> Dokument ersetzen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      title="Dokument löschen"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Dokument löschen
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {typeof fullPreviewIndex === "number" && docPreviews.length > 0 && (
                  <>
                    <div className="flex items-center">
                      {fullPreviewIndex > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={goToPrev}
                          title="Vorheriges Dokument"
                          aria-label="Vorheriges Dokument"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                      )}
                      {fullPreviewIndex < docPreviews.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={goToNext}
                          title="Nächstes Dokument"
                          aria-label="Nächstes Dokument"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* The actual preview content */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            {isFullPreviewLoading ? (
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" /> Vorschau wird geladen…
              </div>
            ) : fullPreviewData ? (
              fullPreviewData.contentType?.startsWith("image/") ? (
                <img
                  src={fullPreviewData.fullUrl || fullPreviewData.smallUrl}
                  alt="Vollständige Vorschau"
                  className="max-h-full max-w-full object-contain"
                />
              ) : fullPreviewData.contentType === "application/pdf" ? (
                <iframe
                  src={fullPreviewData.fullUrl || fullPreviewData.smallUrl}
                  title="Vollständige PDF-Vorschau"
                  className="w-full h-full border-none"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <FileWarning className="h-16 w-16" />
                  <span className="text-lg">Dateityp für Vorschau nicht unterstützt.</span>
                  <a
                    href={fullPreviewData.fullUrl || fullPreviewData.smallUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-base"
                  >
                    Dokument in neuem Tab öffnen
                  </a>
                </div>
              )
            ) : (
              <div className="text-muted-foreground">Keine vollständige Vorschau verfügbar.</div>
            )}
          </div>

          {/* DocAttributesGrid for the current document */}
          {fullPreviewData && (
            <div className="flex-shrink-0 max-h-56 md:max-h-72 overflow-y-auto mt-4 border-t pt-4 px-6">
              <DocAttributesGrid
                ref={detailGridRef}
                docs={[fullPreviewData]} // Pass the single document as an array
                contextKey={fullPreviewData?.pid || selectedOpportunityId}
                onOpenFullPreview={openFullPreview} // Pass the existing handler
                onSaveRow={handleSaveRow} // Pass the existing handler
                onReplaceDoc={handleReplaceDoc} // Pass the existing handler
                hideSaveAllButton={true} // New prop to hide the "Save All" button
                onDeleteDoc={handleDeleteDoc}
                authToken={authToken}
                cloudEnvironment={cloudEnvironment}
                entityOptions={entityOptions}
                hideProjectColumn={true}
                // For single-doc detail grid, usually not loading; omit or set false
                isLoading={false}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Replacement Dialog for Full Preview */}
      <Dialog
        open={isReplaceDialogOpen}
        onOpenChange={(open) => {
          if (!open || !isReplacing) setIsReplaceDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument ersetzen</DialogTitle>
            <DialogDescription>
              Legen Sie eine Datei ab oder klicken Sie, um eine neue Datei auszuwählen.
              {fullPreviewData?.filename && ` (Aktuelles Dokument: ${fullPreviewData.filename})`}
            </DialogDescription>
          </DialogHeader>
          <ReplacementDropzone
            disabled={isReplacing}
            onFileSelected={async (file) => {
              if (!fullPreviewData) return;
              setIsReplacing(true);
              const ok = await handleReplaceDoc(fullPreviewData, file);
              setIsReplacing(false);
              if (ok) {
                setIsReplaceDialogOpen(false);
                setIsFullPreviewDialogOpen(false); // Close full preview after successful replacement
              }
            }}
          />
          <div className="flex justify-end">
            <Button variant="ghost" disabled={isReplacing} onClick={() => setIsReplaceDialogOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog for Full Preview */}
      <Dialog
        open={isConfirmDeleteOpen}
        onOpenChange={(open) => setIsConfirmDeleteOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soll das Dokument wirklich gelöscht werden?</DialogTitle>
            <DialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsConfirmDeleteOpen(false)}>
              nein
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setIsConfirmDeleteOpen(false);
                if (fullPreviewData) {
                  await handleDeleteDoc(fullPreviewData);
                }
              }}
            >
              ja
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog (Back to overview) */}
      <Dialog
        open={backUnsavedDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBackUnsavedDialogOpen(false);
            setBackUnsavedSaveFailed(false);
          }
        }}
      >
        <DialogContent className="w-fit max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Nicht gespeicherte Änderungen</DialogTitle>
            <DialogDescription>
              Es gibt Änderungen, die noch nicht gespeichert wurden. Möchten Sie zuerst speichern und dann zur Übersicht wechseln?
            </DialogDescription>
          </DialogHeader>

          {backUnsavedSaveFailed && (
            <div className="text-sm text-destructive">
              Speichern nicht vollständig möglich. Bitte prüfen Sie die markierten Felder.
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              disabled={backUnsavedSaving}
              onClick={() => setBackUnsavedDialogOpen(false)}
            >
              Abbrechen
            </Button>

            <Button
              variant="destructive"
              disabled={backUnsavedSaving}
              onClick={() => {
                // Discard local edits in both grids and continue navigation.
                docListGridRef.current?.discardAllChanges?.();
                detailGridRef.current?.discardAllChanges?.();
                setBackUnsavedDialogOpen(false);
                setBackUnsavedSaveFailed(false);
                setHighlightedDocKeys([]);
                onClose();
              }}
            >
              Ohne Speichern fortfahren
            </Button>

            <Button
              disabled={backUnsavedSaving}
              onClick={async () => {
                setBackUnsavedSaving(true);
                try {
                  let ok = true;

                  if (docListGridRef.current?.hasUnsavedChanges()) {
                    const res = await docListGridRef.current.saveAllChanges();
                    ok = ok && res.ok;
                  }

                  if (detailGridRef.current?.hasUnsavedChanges()) {
                    const res = await detailGridRef.current.saveAllChanges();
                    ok = ok && res.ok;
                  }

                  if (!ok) {
                    setBackUnsavedSaveFailed(true);
                    return;
                  }

                  setBackUnsavedDialogOpen(false);
                  setBackUnsavedSaveFailed(false);
                  setHighlightedDocKeys([]);
                  onClose();
                } finally {
                  setBackUnsavedSaving(false);
                }
              }}
            >
              {backUnsavedSaving ? "Speichern…" : "Speichern & zur Übersicht"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LinkDocumentsDialog
        open={isLinkDialogOpen}
        onOpenChange={setIsLinkDialogOpen}
        authToken={authToken}
        cloudEnvironment={cloudEnvironment}
        mainPid={fullPreviewData?.pid}
        mainEntityName={fullPreviewData?.entityName}
        projectName={(selectedOpportunityProject ?? "").toString()}
        onConfirm={async (selected) => {
          toast({
            title: "Verlinkung gestartet",
            description: `Ausgewählter Typ: ${selected.desc || selected.name}`,
            variant: "success",
          });
        }}
      />

      {/* REMOVED: SharePoint popup dialog */}
    </div>
  );
};

export default RightPanel;