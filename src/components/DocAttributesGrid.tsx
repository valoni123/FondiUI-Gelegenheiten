"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { type IdmDocPreview } from "@/api/idm";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftRight,
  ChevronRight,
  Save,
  Trash2,
  Link as LinkIcon,
  Link2,
  Loader2,
  FileText,
  CalendarDays,
  Plus,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReplacementDropzone from "@/components/ReplacementDropzone";
import { type CloudEnvironment } from "@/authorization/configLoader";
import { getIdmEntityAttributes, getExistingProjectLinks, setIdmItemProjectLinks } from "@/api/idm";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse, isValid } from "date-fns";
import LinkedDocumentsDialog from "@/components/LinkedDocumentsDialog";
import { toast } from "@/components/ui/use-toast";

type Props = {
  docs: IdmDocPreview[];
  /** Controls how the internal scroll area is sized when useInternalScroll=true. */
  scrollMode?: "max60vh" | "fill";
  /** Only used when scrollMode="max60vh"; allows customizing the max height (in vh). */
  maxScrollHeightVh?: number;
  /**
   * Used to reset internal UI state (filters/selection) only when the dataset context changes
   * (e.g. switching to another opportunity), not on silent background refreshes.
   */
  contextKey?: string;
  /** The currently opened opportunity id (used for small UI hints like showing the document's origin when opened via Projekt_Verlinkung). */
  contextOpportunityId?: string;
  /** The currently opened project (used for small UI hints like showing the document's origin when opened via Projekt_Verlinkung). */
  contextProject?: string;
  /** Notifies parent when the checkbox selection changes (only docs with PID). */
  onSelectionChange?: (selected: IdmDocPreview[]) => void;
  /**
   * Optional max width (in px) for each data column in the grid.
   * Useful for the document list where column widths should be fixed.
   */
  maxDataColumnWidthPx?: number;
  highlightedDocKeys?: string[];
  onOpenFullPreview: (doc: IdmDocPreview, onUpdate: (updatedDoc: IdmDocPreview) => void) => void;
  onSaveRow: (
    doc: IdmDocPreview,
    updates: { name: string; value: string }[],
    options?: { entityName?: string }
  ) => Promise<{ ok: boolean; errorAttributes?: string[] }>;
  onReplaceDoc: (doc: IdmDocPreview, file: File) => Promise<boolean>;
  hideSaveAllButton?: boolean;
  /** Hide the "Projekt" column from the grid UI (data remains unchanged). */
  hideProjectColumn?: boolean;
  title?: string;
  onDeleteDoc: (doc: IdmDocPreview) => Promise<boolean>;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  entityOptions?: { name: string; desc: string }[];
  isLoading?: boolean;
  /**
   * The currently active chip filter key. When set, columns are reordered
   * according to the filter group (FME vs FSI).
   */
  activeDocFilter?: string | null;
};

export type DocAttributesGridHandle = {
  saveAllChanges: () => Promise<{ ok: boolean }>;
  hasUnsavedChanges: () => boolean;
  discardAllChanges: () => void;
  /** Currently selected documents via the checkbox column (only docs with PID). */
  getSelectedDocs: () => IdmDocPreview[];
};

const TruncatedTextCell: React.FC<{ value: string }> = ({ value }) => {
  const [open, setOpen] = React.useState(false);
  const v = (value ?? "").toString();

  if (!v) {
    return <div className="truncate text-xs text-foreground">{v}</div>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left"
          title={v}
        >
          <div className="truncate text-xs text-foreground">{v}</div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-3" align="start">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Volltext</div>
        <Textarea
          value={v}
          readOnly
          className="min-h-[140px] resize-none text-sm"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(v);
                toast({ title: "Kopiert" });
              } catch {
                // ignore
              }
            }}
          >
            Kopieren
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Schließen
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const DocAttributesGrid = React.forwardRef<DocAttributesGridHandle, Props>(({
  docs,
  scrollMode = "max60vh",
  maxScrollHeightVh = 60,
  contextKey,
  contextOpportunityId,
  contextProject,
  onSelectionChange,
  maxDataColumnWidthPx,
  highlightedDocKeys,
  onOpenFullPreview,
  onSaveRow,
  onReplaceDoc,
  hideSaveAllButton,
  hideProjectColumn,
  title,
  onDeleteDoc,
  authToken,
  cloudEnvironment,
  entityOptions,
  isLoading,
  activeDocFilter,
}, ref) => {
  const highlightedSet = React.useMemo(() => new Set(highlightedDocKeys ?? []), [highlightedDocKeys]);

  const getDocKey = React.useCallback((doc: IdmDocPreview) => {
    if (doc.pid) return `pid:${doc.pid}`;
    return `f:${doc.entityName ?? ""}|${doc.filename ?? ""}|${doc.smallUrl ?? ""}`;
  }, []);

  const rowHighlightClass = "bg-red-50 border-y border-red-400";
  const rowHighlightLeft = "border-l border-red-400 rounded-l-sm";
  const rowHighlightRight = "border-r border-red-400 rounded-r-sm";

  // Excel-like look: square inputs and full gridlines
  const headerCellClass = "px-1 py-1 text-xs font-medium text-muted-foreground border-r border-b border-border bg-gray-100 dark:bg-gray-800 flex items-center min-h-8";
  const gridCellClass = "px-1 py-1 min-w-0 border-r border-b border-border bg-background flex items-center min-h-8";
  const iconCellClass = "px-1 py-1 flex items-center border-r border-b border-border bg-background min-h-8";
  const filterCellClass = "px-1 py-1 border-r border-b border-border bg-background flex items-center min-h-8";

  // Document type (entityName) edit state MUST be declared before effects using it
  const initialDocTypes = React.useMemo<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    docs.forEach((d, idx) => {
      map[idx] = String(d.entityName ?? "");
    });
    return map;
  }, [docs]);

  const [editedDocTypes, setEditedDocTypes] = React.useState<Record<number, string>>(initialDocTypes);
  React.useEffect(() => setEditedDocTypes(initialDocTypes), [initialDocTypes]);

  const entitySelectOptions = React.useMemo(() => {
    if (!entityOptions?.length) return [];
    return entityOptions
      .filter((o) => (o.desc || "").trim().startsWith("*"))
      .map((o) => ({ name: o.name, label: (o.desc || o.name).replace(/^\*/, "").trim() }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [entityOptions]);

  const getEntityLabel = React.useCallback(
    (entityName: string) => {
      const opt = entityOptions?.find((o) => o.name === entityName);
      const desc = (opt?.desc || opt?.name || entityName).toString();
      return desc.replace(/^\*/, "").trim();
    },
    [entityOptions]
  );

  type DisplayColumn =
    | {
        kind: "attr";
        id: string;
        header: string;
        attrNames: string[];
        forceDate?: boolean;
      }
    | {
        kind: "meta";
        id: string;
        header: string;
        getValue: (doc: IdmDocPreview) => string;
      };

  const getAttrValue = React.useCallback((doc: IdmDocPreview, attrNames: string[]) => {
    const attrs = doc.attributes ?? [];
    for (const n of attrNames) {
      const found = attrs.find((a) => a?.name === n);
      if (found?.value != null && String(found.value).length > 0) return String(found.value);
    }
    return "";
  }, []);

  // Fixed column order (always rendered, even if values are missing)
  const baseDisplayColumns = React.useMemo<DisplayColumn[]>(() => {
    return [
      { kind: "attr", id: "projekt", header: "Projekt", attrNames: ["Projekt"] },
      {
        kind: "meta",
        id: "dokumenttyp",
        header: "Dokumenttyp",
        getValue: (doc) => {
          const raw = String(doc.entityName ?? "");
          return raw ? getEntityLabel(raw) : "";
        },
      },
      {
        kind: "attr",
        id: "dokumentenpaket",
        header: "Dokumentenpaket",
        attrNames: ["Dokumentenpaket"],
      },
      {
        kind: "meta",
        id: "dokumentname",
        header: "Dokumentname",
        getValue: (doc) => String(doc.filename ?? ""),
      },
      { kind: "attr", id: "titel", header: "Titel", attrNames: ["Titel"] },
      { kind: "attr", id: "status", header: "Status", attrNames: ["Status"] },
      {
        kind: "attr",
        id: "belegdatum",
        header: "Belegdatum",
        attrNames: ["Belegdatum"],
        forceDate: true,
      },
      { kind: "attr", id: "belegnr", header: "Belegnr.", attrNames: ["Belegnummer"] },
      {
        kind: "meta",
        id: "createdBy",
        header: "erstellt von",
        getValue: (doc) => String(doc.createdByName ?? ""),
      },
      {
        kind: "meta",
        id: "createdAt",
        header: "erstellt am",
        getValue: (doc) => {
          const v = doc.createdTS;
          if (!v) return "";
          const d = new Date(v);
          return isNaN(d.getTime()) ? String(v) : format(d, "dd.MM.yyyy, HH:mm:ss");
        },
      },
      {
        kind: "meta",
        id: "changedBy",
        header: "geändert von",
        getValue: (doc) => String(doc.lastChangedByName ?? ""),
      },
      {
        kind: "meta",
        id: "changedAt",
        header: "geändert am",
        getValue: (doc) => {
          const v = doc.lastChangedTS;
          if (!v) return "";
          const d = new Date(v);
          return isNaN(d.getTime()) ? String(v) : format(d, "dd.MM.yyyy, HH:mm:ss");
        },
      },
      { kind: "attr", id: "ort", header: "Ort", attrNames: ["Ort", "Werk"] },
    ];
  }, [getEntityLabel]);

  // Geometriedaten-spezifische Zusatzspalten (werden nur eingeblendet, wenn mind. ein Geometriedaten-Dokument vorhanden ist)
  const extraGeometriedatenColumns = React.useMemo<DisplayColumn[]>(
    () => [
      { kind: "attr", id: "serienstatus", header: "Serienstatus", attrNames: ["Serienstatus"] },
      { kind: "attr", id: "versuchsstatus", header: "Versuchsstatus", attrNames: ["Versuchsstatus"] },
      { kind: "attr", id: "s_k_version", header: "S-K-Version", attrNames: ["S_K_Version"] },
      { kind: "attr", id: "v_k_version", header: "V-K-Version", attrNames: ["V_K_Version"] },
      { kind: "attr", id: "lfd_nr", header: "Lfd. Nr.", attrNames: ["Lfd_Nr"] },
      { kind: "attr", id: "geometrieart", header: "Geometrieart", attrNames: ["Geometrieart"] },
    ],
    []
  );

  const hasGeometriedaten = React.useMemo(
    () =>
      (docs || []).some((d) => {
        const en = String(d?.entityName ?? "").toLowerCase();
        return en.includes("geometriedaten");
      }),
    [docs]
  );

  // Fixed column order (always rendered, even if values are missing)
  const displayColumns = React.useMemo<DisplayColumn[]>(() => {
    const base = hideProjectColumn ? baseDisplayColumns.filter((c) => c.id !== "projekt") : baseDisplayColumns;

    // Helper to find a column by id from either base or extra lists
    const allCols = [...base, ...extraGeometriedatenColumns];
    const byId = (id: string) => allCols.find((c) => c.id === id);

    const headerOverrides: Record<string, string> = {
      geometrieart: "Geometrie Art",
      dokumentname: "Name",
      belegnr: "Belegnummer",
      createdAt: "Erstellt",
      createdBy: "Erstellt von",
      changedAt: "Geändert",
      changedBy: "Geändert von",
    };

    const applyHeaderOverrides = (cols: DisplayColumn[]) =>
      cols.map((c) => {
        const nextHeader = headerOverrides[c.id];
        return nextHeader ? ({ ...c, header: nextHeader } as DisplayColumn) : c;
      });

    const isGeomKundeFilter =
      activeDocFilter === "FME_GEOM_KUNDE" || activeDocFilter === "FSI_GEOM_KUNDE";
    const isSerieGueltigFilter =
      activeDocFilter === "FME_SERIE_GUELTIG" || activeDocFilter === "FSI_SERIE_GUELTIG";
    const isVersuchGueltigFilter =
      activeDocFilter === "FME_VERSUCH_GUELTIG" || activeDocFilter === "FSI_VERSUCH_GUELTIG";

    if (isGeomKundeFilter) {
      // Geometrien Kunde (FME/FSI)
      const ordered = [
        "lfd_nr",
        "geometrieart",
        "status",
        "serienstatus",
        "s_k_version",
        "versuchsstatus",
        "v_k_version",
        "titel",
        "dokumentname",
        "belegdatum",
        "belegnr",
        "createdAt",
        "createdBy",
        "changedAt",
        "changedBy",
      ];
      const cols = ordered.map((id) => byId(id)).filter(Boolean) as DisplayColumn[];
      return applyHeaderOverrides(cols);
    }

    if (isSerieGueltigFilter) {
      // Serie gültig (FME/FSI)
      const ordered = [
        "lfd_nr",
        "geometrieart",
        "status",
        "serienstatus",
        "s_k_version",
        "titel",
        "dokumentname",
        "belegdatum",
        "belegnr",
        "createdAt",
        "createdBy",
        "changedAt",
        "changedBy",
      ];
      const cols = ordered.map((id) => byId(id)).filter(Boolean) as DisplayColumn[];
      return applyHeaderOverrides(cols);
    }

    if (isVersuchGueltigFilter) {
      // Versuch gültig (FME/FSI)
      const ordered = [
        "lfd_nr",
        "geometrieart",
        "status",
        "versuchsstatus",
        "v_k_version",
        "titel",
        "dokumentname",
        "belegdatum",
        "belegnr",
        "createdAt",
        "createdBy",
        "changedAt",
        "changedBy",
      ];
      const cols = ordered.map((id) => byId(id)).filter(Boolean) as DisplayColumn[];
      return applyHeaderOverrides(cols);
    }

    if (!hasGeometriedaten) return base;

    // In the standard view, keep the "created/changed" + "Ort" columns at the very end.
    const tailIds = ["createdBy", "createdAt", "changedBy", "changedAt", "ort"];
    const tail = tailIds
      .map((id) => byId(id))
      .filter(Boolean) as DisplayColumn[];

    const main = base.filter((c) => !tailIds.includes(c.id));
    return [...main, ...extraGeometriedatenColumns, ...tail];
  }, [baseDisplayColumns, hideProjectColumn, hasGeometriedaten, extraGeometriedatenColumns, activeDocFilter]);

  // Keep a set of possible attribute names for diff/save logic
  const editableColumns = React.useMemo(() => displayColumns.filter((c) => c.kind === "attr"), [displayColumns]);

  const initial = React.useMemo<Record<number, Record<string, string>>>(() => {
    const map: Record<number, Record<string, string>> = {};
    docs.forEach((d, idx) => {
      const row: Record<string, string> = {};
      (d.attributes ?? []).forEach((a) => {
        if (a?.name) row[a.name] = a.value ?? "";
      });
      map[idx] = row;
    });
    return map;
  }, [docs]);

  const [edited, setEdited] = React.useState<Record<number, Record<string, string>>>(initial);
  React.useEffect(() => setEdited(initial), [initial]);

  // Column filters (by display column id)
  // Make inputs UNCONTROLLED so keystrokes don't re-render the whole grid.
  // We only apply filtering (and thus re-render) with a small debounce.
  const filterDraftRef = React.useRef<Record<string, string>>({});
  const filterDebounceRef = React.useRef<number | null>(null);
  const [filterResetKey, setFilterResetKey] = React.useState(0);
  const [appliedFilters, setAppliedFilters] = React.useState<Record<string, string>>({});

  const scheduleApplyFilters = React.useCallback(() => {
    if (filterDebounceRef.current) window.clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = window.setTimeout(() => {
      setAppliedFilters({ ...filterDraftRef.current });
    }, 150);
  }, []);

  React.useEffect(() => {
    // Reset filters only when context changes (e.g. switching opportunity), not on silent data refresh.
    filterDraftRef.current = {};
    setAppliedFilters({});
    setFilterResetKey((k) => k + 1);
  }, [contextKey]);

  const [syncWithInitial, setSyncWithInitial] = React.useState<Set<number>>(new Set());

  // Populate edited for new rows without overriding existing edits
  React.useEffect(() => {
    setEdited((prev) => {
      const next = { ...prev };
      docs.forEach((_, idx) => {
        if (!(idx in next)) {
          next[idx] = { ...(initial[idx] ?? {}) };
        }
      });
      return next;
    });
  }, [docs, initial]);

  // When initial changes (e.g., after server refresh), only sync rows that were saved successfully
  React.useEffect(() => {
    if (!syncWithInitial.size) return;
    setEdited((prev) => {
      const next = { ...prev };
      syncWithInitial.forEach((idx) => {
        next[idx] = { ...(initial[idx] ?? {}) };
      });
      return next;
    });
    // clear the sync set after applying
    setSyncWithInitial(new Set());
  }, [initial, syncWithInitial]);

  // Cache of attribute definitions by entity: { [entityName]: { [attrName]: { valueset?, type? } } }
  const [attrDefsByEntity, setAttrDefsByEntity] = React.useState<
    Record<string, Record<string, { valueset?: { name: string; desc: string }[]; type?: string }> >
  >({});

  // Load attribute definitions for each entity present in docs OR currently edited document types
  React.useEffect(() => {
    const fromDocs = docs.map((d) => d.entityName).filter(Boolean) as string[];
    const fromEdits = Object.values(editedDocTypes).filter(Boolean) as string[];
    const entityNames = Array.from(new Set([...fromDocs, ...fromEdits]));
    const missing = entityNames.filter((name) => !attrDefsByEntity[name]);
    if (!missing.length) return;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (name) => {
          try {
            const attrs = await getIdmEntityAttributes(authToken, cloudEnvironment, name);
            const map: Record<string, { valueset?: { name: string; desc: string }[]; type?: string }> = {};
            attrs.forEach((a) => {
              map[a.name] = { valueset: a.valueset, type: a.type };
            });
            return [name, map] as const;
          } catch {
            return [name, {}] as const;
          }
        })
      );
      setAttrDefsByEntity((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
  }, [docs, editedDocTypes, authToken, cloudEnvironment, attrDefsByEntity]);

  const resolveAttrName = React.useCallback(
    (
      rowEdited: Record<string, string>,
      rowInitial: Record<string, string>,
      defs: Record<string, { valueset?: { name: string; desc: string }[]; type?: string }>,
      col: Extract<DisplayColumn, { kind: "attr" }>
    ) => {
      // Prefer schema-defined attribute, else one present in data, else first configured name
      for (const name of col.attrNames) {
        if (defs?.[name]) return name;
      }
      for (const name of col.attrNames) {
        if (name in rowEdited || name in rowInitial) return name;
      }
      return col.attrNames[0];
    },
    []
  );

  const getDisplayValueForFilter = React.useCallback(
    (
      doc: IdmDocPreview,
      rowEdited: Record<string, string>,
      rowInitial: Record<string, string>,
      defs: Record<string, { valueset?: { name: string; desc: string }[]; type?: string }>,
      col: DisplayColumn
    ) => {
      if (col.kind === "meta") {
        return (col.getValue(doc) ?? "").toString();
      }

      const attrName = resolveAttrName(rowEdited, rowInitial, defs, col);
      const raw = (rowEdited[attrName] ?? "").toString();

      const def = defs[attrName];
      const isDate = col.forceDate || def?.type === "7" || attrName === "Belegdatum";
      if (isDate && raw) {
        try {
          return format(parse(raw, "yyyy-MM-dd", new Date()), "dd.MM.yyyy");
        } catch {
          return raw;
        }
      }

      if (def?.valueset?.length) {
        const match = def.valueset.find((vs) => vs.name === raw);
        return match?.desc || raw;
      }

      return raw;
    },
    [resolveAttrName]
  );

  const filteredDocs = React.useMemo(() => {
    const activeFilters = Object.entries(appliedFilters)
      .map(([k, v]) => [k, v.trim().toLowerCase()] as const)
      .filter(([, v]) => v.length > 0);

    if (!activeFilters.length) return docs.map((doc, idx) => ({ doc, idx }));

    return docs
      .map((doc, idx) => ({ doc, idx }))
      .filter(({ doc, idx }) => {
        const rowEdited = edited[idx] ?? {};
        const rowInitial = initial[idx] ?? {};
        const entityName = doc.entityName || "";
        const defs = attrDefsByEntity[entityName] || {};

        for (const [colId, q] of activeFilters) {
          const col = displayColumns.find((c) => c.id === colId);
          if (!col) continue;
          const value = getDisplayValueForFilter(doc, rowEdited, rowInitial, defs, col)
            .toLowerCase();
          if (!value.includes(q)) return false;
        }
        return true;
      });
  }, [docs, edited, initial, appliedFilters, displayColumns, attrDefsByEntity, getDisplayValueForFilter]);

  const statusColumnWidthPx = React.useMemo(() => {
    // Best effort: determine the longest visible label in the Status valueset (across all entities)
    // and convert it to a reasonable pixel width (keeps header/filter/cells perfectly aligned).
    let maxLen = "Freigegeben".length;

    for (const entityName of Object.keys(attrDefsByEntity)) {
      const def = attrDefsByEntity?.[entityName]?.["Status"];
      const valueset = def?.valueset ?? [];
      for (const vs of valueset) {
        const label = (vs.desc || vs.name || "").trim();
        if (label.length > maxLen) maxLen = label.length;
      }
    }

    // Approximate: 7px per character + padding/icons.
    // Clamp so it doesn't get ridiculously wide.
    const px = Math.round(maxLen * 7 + 60);
    return Math.min(260, Math.max(140, px));
  }, [attrDefsByEntity]);

  const belegdatumColumnWidthPx = React.useMemo(() => {
    // Include placeholder "Datum wählen" so it doesn't overflow when no date is set
    const candidates = ["Belegdatum", "29.01.2026", "Datum wählen"];
    const maxLen = candidates.reduce((m, s) => Math.max(m, s.length), 0);
    const px = Math.round(maxLen * 7 + 36);
    // Ensure a comfortable minimum width
    return Math.min(180, Math.max(140, px));
  }, []);

  // Fehler-Highlights pro Zeile/Spalte (kurzes Blink-Highlight)
  const [errorHighlights, setErrorHighlights] = React.useState<Record<number, string[]>>({});

  // Erfolg-Highlights pro Zeile/Spalte (kurzes Blink-Highlight)
  const [successHighlights, setSuccessHighlights] = React.useState<Record<number, string[]>>({});

  const flashError = React.useCallback((rowIdx: number, cols: string[]) => {
    if (!cols.length) return;
    setErrorHighlights((prev) => {
      const next = { ...prev };
      const current = new Set(next[rowIdx] ?? []);
      cols.forEach((c) => current.add(c));
      next[rowIdx] = Array.from(current);
      return next;
    });
    // Entferne Highlight nach kurzer Zeit
    setTimeout(() => {
      setErrorHighlights((prev) => {
        const next = { ...prev };
        const current = new Set(next[rowIdx] ?? []);
        cols.forEach((c) => current.delete(c));
        next[rowIdx] = Array.from(current);
        if (!next[rowIdx]?.length) delete next[rowIdx];
        return next;
      });
    }, 1800);
  }, []);

  const flashSuccess = React.useCallback((rowIdx: number, cols: string[]) => {
    if (!cols.length) return;
    setSuccessHighlights((prev) => {
      const next = { ...prev };
      const current = new Set(next[rowIdx] ?? []);
      cols.forEach((c) => current.add(c));
      next[rowIdx] = Array.from(current);
      return next;
    });
    // Entferne Highlight nach kurzer Zeit
    setTimeout(() => {
      setSuccessHighlights((prev) => {
        const next = { ...prev };
        const current = new Set(next[rowIdx] ?? []);
        cols.forEach((c) => current.delete(c));
        next[rowIdx] = Array.from(current);
        if (!next[rowIdx]?.length) delete next[rowIdx];
        return next;
      });
    }, 1800);
  }, []);

  const changedRowCount = React.useMemo(() => {
    let count = 0;
    docs.forEach((doc, idx) => {
      const rowEdited = edited[idx] ?? {};
      const rowInitial = initial[idx] ?? {};
      const effectiveEntityName = editedDocTypes[idx] ?? doc.entityName ?? "";
      const defs = attrDefsByEntity[effectiveEntityName] || {};

      const rowHasAttrChanges = editableColumns.some((c) => {
        const attrName = resolveAttrName(rowEdited, rowInitial, defs, c);
        return (rowEdited[attrName] ?? "") !== (rowInitial[attrName] ?? "");
      });

      const rowHasTypeChange = (editedDocTypes[idx] ?? "") !== (initialDocTypes[idx] ?? "");
      // NEW: consider note changes for save-all button
      const noteChanged = (rowEdited["Anmerkung"] ?? "") !== (rowInitial["Anmerkung"] ?? "");

      if (rowHasAttrChanges || rowHasTypeChange || noteChanged) count++;
    });
    return count;
  }, [docs, edited, initial, editableColumns, attrDefsByEntity, resolveAttrName, editedDocTypes, initialDocTypes]);

  const enableSaveAllButton = changedRowCount > 0; // Enable if any row has changes

  const handleSaveAllChanges = async () => {
    const successfulSaves: number[] = [];
    const successfulUpdates: { rowIdx: number; cols: string[] }[] = [];
    let hadFailures = false;

    for (let idx = 0; idx < docs.length; idx++) {
      const doc = docs[idx];
      const rowEdited = edited[idx] ?? {};
      const rowInitial = initial[idx] ?? {};
      const effectiveEntityName = editedDocTypes[idx] ?? doc.entityName ?? "";
      const defs = attrDefsByEntity[effectiveEntityName] || {};

      const typeChanged = (editedDocTypes[idx] ?? "") !== (initialDocTypes[idx] ?? "");
      const newEntityName = typeChanged ? (editedDocTypes[idx] ?? "") : undefined;

      const updates = editableColumns
        .map((c) => {
          const attrName = resolveAttrName(rowEdited, rowInitial, defs, c);
          return {
            attrName,
            value: rowEdited[attrName] ?? "",
            changed: (rowEdited[attrName] ?? "") !== (rowInitial[attrName] ?? ""),
          };
        })
        .filter((u) => u.changed)
        .map((u) => ({ name: u.attrName, value: u.value }));

      // NEW: include note changes in save-all
      if ((rowEdited["Anmerkung"] ?? "") !== (rowInitial["Anmerkung"] ?? "")) {
        updates.push({ name: "Anmerkung", value: rowEdited["Anmerkung"] ?? "" });
      }

      if (updates.length || typeChanged) {
        if (!doc.pid) {
          hadFailures = true;
          flashError(idx, updates.map((u) => u.name));
          continue;
        }

        try {
          const res = await onSaveRow(doc, updates, { entityName: newEntityName });
          if (res.ok) {
            successfulSaves.push(idx);
            successfulUpdates.push({ rowIdx: idx, cols: updates.map((u) => u.name) });
          } else {
            hadFailures = true;
            const colsToFlash = res.errorAttributes?.length ? res.errorAttributes : updates.map((u) => u.name);
            flashError(idx, colsToFlash);
          }
        } catch {
          hadFailures = true;
          flashError(idx, updates.map((u) => u.name));
        }
      }
    }

    successfulUpdates.forEach(({ rowIdx, cols }) => flashSuccess(rowIdx, cols));

    setEdited((prev) => {
      const newEdited = { ...prev };
      successfulSaves.forEach((idx) => {
        newEdited[idx] = { ...initial[idx] };
      });
      return newEdited;
    });

    if (successfulSaves.length) {
      // After reloadPreviews, docs will carry the new entityName.
      // So we just wait for initialDocTypes to update via docs, and keep editedDocTypes in sync.
      setSyncWithInitial((prev) => {
        const next = new Set(prev);
        successfulSaves.forEach((idx) => next.add(idx));
        return next;
      });
    }

    return { ok: !hadFailures };
  };

  const [selectedRows, setSelectedRows] = React.useState<Set<number>>(new Set());
  React.useEffect(() => {
    setSelectedRows(new Set());
  }, [contextKey]);

  const selectedDocs = React.useMemo(
    () =>
      Array.from(selectedRows)
        .map((i) => docs[i])
        .filter((d): d is IdmDocPreview => !!d?.pid),
    [selectedRows, docs]
  );

  React.useEffect(() => {
    onSelectionChange?.(selectedDocs);
  }, [onSelectionChange, selectedDocs]);

  const toggleRowSelected = (idx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  React.useImperativeHandle(
    ref,
    () => ({
      saveAllChanges: handleSaveAllChanges,
      hasUnsavedChanges: () => enableSaveAllButton,
      discardAllChanges: () => {
        setEdited(initial);
        setEditedDocTypes(initialDocTypes);
        setSyncWithInitial(new Set());
      },
      getSelectedDocs: () => selectedDocs,
    }),
    [enableSaveAllButton, handleSaveAllChanges, initial, initialDocTypes, selectedDocs]
  );

  // Unsaved-changes guard (used when user tries other actions while "Alle Änderungen speichern" is active)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = React.useState(false);
  const [unsavedSaving, setUnsavedSaving] = React.useState(false);
  const [unsavedSaveFailed, setUnsavedSaveFailed] = React.useState(false);
  const pendingActionRef = React.useRef<null | (() => void)>(null);

  const runWithUnsavedGuard = React.useCallback(
    (action: () => void) => {
      // In detail view we intentionally don't guard (there is no "Save All" button)
      if (hideSaveAllButton) {
        action();
        return;
      }

      if (!enableSaveAllButton) {
        action();
        return;
      }

      pendingActionRef.current = action;
      setUnsavedSaveFailed(false);
      setUnsavedDialogOpen(true);
    },
    [enableSaveAllButton, hideSaveAllButton]
  );

  // Replace flow state
  const [confirmReplaceRow, setConfirmReplaceRow] = React.useState<number | null>(null);
  const [uploadRow, setUploadRow] = React.useState<number | null>(null);
  const [isReplacing, setIsReplacing] = React.useState(false);

  // Delete confirmation dialog state
  const [confirmDeleteRow, setConfirmDeleteRow] = React.useState<number | null>(null);

  // Batch delete confirmation dialog state
  const [confirmBatchDelete, setConfirmBatchDelete] = React.useState(false);

  const handleBatchDelete = async () => {
    setConfirmBatchDelete(true);
  };

  const executeBatchDelete = async () => {
    const selectedDocs = Array.from(selectedRows)
      .map((i) => docs[i])
      .filter((d) => d && d.pid);
    for (const doc of selectedDocs) {
      await onDeleteDoc(doc as IdmDocPreview);
    }
    setSelectedRows(new Set());
    setConfirmBatchDelete(false);
  };

  // NOTE EDITOR state
  // Use uncontrolled input via ref to avoid re-rendering the whole grid on every keystroke.
  const [noteEditorRow, setNoteEditorRow] = React.useState<number | null>(null);
  const noteEditorDraftRef = React.useRef<string>("");

  const [projectLinksRow, setProjectLinksRow] = React.useState<number | null>(null);
  const [projectLinksDraft, setProjectLinksDraft] = React.useState<string[]>([]);
  const [projectLinksLoading, setProjectLinksLoading] = React.useState(false);
  const [projectLinksSaving, setProjectLinksSaving] = React.useState(false);
  const projectLinksByPidRef = React.useRef<Record<string, string[]>>({});

  const parseProjektVerlinkungAttr = React.useCallback((doc: IdmDocPreview): string[] => {
    const raw = (doc.attributes ?? []).find((a) => a?.name === "Projekt_Verlinkung")?.value ?? "";
    const text = String(raw ?? "").trim();
    if (!text) return [];
    return Array.from(
      new Set(
        text
          .split(/[;,\n\r\t ]+/g)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
  }, []);

  const parseDokumentVerlinkungAttr = React.useCallback((doc: IdmDocPreview): string[] => {
    const raw = (doc.attributes ?? []).find((a) => a?.name === "Dokument_Verlinkung")?.value ?? "";
    const text = String(raw ?? "").trim();
    if (!text) return [];
    return Array.from(
      new Set(
        text
          .split(/[;,\n\r\t ]+/g)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
  }, []);

  const hasLinkedDocuments = React.useCallback(
    (doc: IdmDocPreview) => {
      const list = parseDokumentVerlinkungAttr(doc);
      return list.length > 0;
    },
    [parseDokumentVerlinkungAttr]
  );

  const getProjectLinksForDoc = React.useCallback(
    (doc: IdmDocPreview): string[] => {
      const pid = doc.pid ? String(doc.pid) : "";
      if (pid && projectLinksByPidRef.current[pid]) return projectLinksByPidRef.current[pid];
      return parseProjektVerlinkungAttr(doc);
    },
    [parseProjektVerlinkungAttr]
  );

  const openProjectLinksEditor = React.useCallback(
    async (idx: number) => {
      const doc = docs[idx];
      if (!doc?.pid) return;
      const pid = String(doc.pid);
      setProjectLinksRow(idx);
      setProjectLinksLoading(true);
      try {
        const existing = await getExistingProjectLinks(authToken, cloudEnvironment, pid, "de-DE");
        projectLinksByPidRef.current[pid] = existing;
        setProjectLinksDraft(existing.length ? existing : [""]);
      } catch {
        const fallback = getProjectLinksForDoc(doc);
        setProjectLinksDraft(fallback.length ? fallback : [""]);
      } finally {
        setProjectLinksLoading(false);
      }
    },
    [authToken, cloudEnvironment, docs, getProjectLinksForDoc]
  );

  const hasProjectLinks = React.useCallback(
    (doc: IdmDocPreview) => {
      const list = getProjectLinksForDoc(doc);
      return list.length > 0;
    },
    [getProjectLinksForDoc]
  );

  const openNoteEditor = (idx: number) => {
    const current = edited[idx]?.["Anmerkung"] ?? initial[idx]?.["Anmerkung"] ?? "";
    setNoteEditorRow(idx);
    noteEditorDraftRef.current = String(current);
  };

  // Columns: Details (30) | Select (30) | Save (30) | Replace (30) | Linked Docs (30) | Project Link (30) | Note (30) | Data Columns | Delete (30)
  const gridTemplate = React.useMemo(() => {
    // CHANGED ORDER: detail | select | save | replace | linked | project-link | note
    const fixed = ["30px", "30px", "30px", "30px", "30px", "30px", "30px"]; // detail | select | save | replace | linked | project-link | note
    const dataCols = displayColumns.map((c) => {
      if (maxDataColumnWidthPx) {
        const compact: Record<string, number> = {
          status: 140,
          belegdatum: 120,
          createdAt: 160,
          changedAt: 160,
          ort: 100,
        };
        const w = compact[c.id] ?? maxDataColumnWidthPx;
        return `minmax(0px, ${w}px)`;
      }
      if (c.id === "dokumentname") return "minmax(220px, 2fr)";
      if (c.id === "titel") return "minmax(180px, 2fr)";
      if (c.id === "projekt") return "minmax(140px, 1.2fr)";
      if (c.id === "status") return `${statusColumnWidthPx}px`;
      if (c.id === "belegdatum") return `${belegdatumColumnWidthPx}px`;
      return "minmax(120px, 1fr)";
    });
    const tail = "30px"; // delete
    return [...fixed, ...dataCols, tail].join(" ");
  }, [displayColumns, statusColumnWidthPx, belegdatumColumnWidthPx, maxDataColumnWidthPx]);

  const [openDateKey, setOpenDateKey] = React.useState<string | null>(null);
  const [dateInputErrors, setDateInputErrors] = React.useState<Set<string>>(new Set());

  const commitDateInput = React.useCallback(
    (cellKey: string, idx: number, attrName: string, rawInput: string) => {
      const raw = (rawInput || "").trim();
      if (!raw) {
        setEdited((prev) => {
          const row = { ...(prev[idx] ?? {}) };
          row[attrName] = "";
          return { ...prev, [idx]: row };
        });
        setDateInputErrors((prev) => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
        return;
      }

      // Allow dd.MM.yyyy (preferred) or yyyy-MM-dd (internal format)
      const d = raw.includes(".")
        ? parse(raw, "dd.MM.yyyy", new Date())
        : parse(raw, "yyyy-MM-dd", new Date());

      const ok = isValid(d);
      if (!ok) {
        setDateInputErrors((prev) => new Set(prev).add(cellKey));
        return;
      }

      // Strict format check to avoid partial parses (e.g. 32.13.2024)
      const normalized = raw.includes(".") ? format(d, "dd.MM.yyyy") : format(d, "yyyy-MM-dd");
      if (normalized !== raw) {
        setDateInputErrors((prev) => new Set(prev).add(cellKey));
        return;
      }

      const iso = format(d, "yyyy-MM-dd");
      setEdited((prev) => {
        const row = { ...(prev[idx] ?? {}) };
        row[attrName] = iso;
        return { ...prev, [idx]: row };
      });
      setDateInputErrors((prev) => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    },
    []
  );

  return (
    <div className={cn("w-full flex flex-col min-h-0", scrollMode === "fill" && "h-full")}>
      {(title || !hideSaveAllButton) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          {title ? (
            <div className="text-sm font-medium text-muted-foreground">{title}</div>
          ) : (
            <div />
          )}

          {!hideSaveAllButton && (
            <div className="flex items-center gap-2">
              {/* Batch delete appears only when more than one row is selected */}
              {selectedRows.size > 1 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={handleBatchDelete}
                  title="Ausgewählte Dokumente löschen"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Ausgewählte Dokumente löschen
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                className={cn(
                  "h-8",
                  enableSaveAllButton && "bg-orange-500 hover:bg-orange-600 text-white"
                )}
                disabled={!enableSaveAllButton}
                onClick={handleSaveAllChanges}
              >
                <Save className="mr-2 h-4 w-4" /> Alle Änderungen speichern
              </Button>
            </div>
          )}
        </div>
      )}

      <TooltipProvider>
        <div
          className={cn(
            "w-full overflow-auto",
            scrollMode === "fill" ? "flex-1 min-h-0" : undefined
          )}
          style={scrollMode === "fill" ? undefined : { maxHeight: `${maxScrollHeightVh}vh` }}
        >
          <div
            className="grid w-max min-w-full border-l border-t border-border"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {/* Header */}
            {/* ADD one more empty header cell for the project-link column */}
            <div className={cn(headerCellClass, "sticky top-0 z-30")}></div>
            <div className={cn(headerCellClass, "sticky top-0 z-30")}></div>
            <div className={cn(headerCellClass, "sticky top-0 z-30")}></div>
            <div className={cn(headerCellClass, "sticky top-0 z-30")}></div>
            <div className={cn(headerCellClass, "sticky top-0 z-30")}></div>
            <div className={cn(headerCellClass, "sticky top-0 z-30")}></div>
            <div className={cn(headerCellClass, "sticky top-0 z-30")}></div>
            {displayColumns.map((col) => (
              <div key={col.id} className={cn(headerCellClass, "min-w-0 sticky top-0 z-30")}>
                <div className="truncate">{col.header}</div>
              </div>
            ))}
            <div className={cn(headerCellClass, "sticky top-0 z-30")}></div>

            {/* Filters */}
            {/* ADD one more empty filter cell for the project-link column */}
            <div className={cn(filterCellClass, "sticky top-8 z-20")}></div>
            <div className={cn(filterCellClass, "sticky top-8 z-20")}></div>
            <div className={cn(filterCellClass, "sticky top-8 z-20")}></div>
            <div className={cn(filterCellClass, "sticky top-8 z-20")}></div>
            <div className={cn(filterCellClass, "sticky top-8 z-20")}></div>
            <div className={cn(filterCellClass, "sticky top-8 z-20")}></div>
            <div className={cn(filterCellClass, "sticky top-8 z-20")}></div>
            {displayColumns.map((col) => (
              <div key={`filter-${col.id}`} className={cn(filterCellClass, "min-w-0 sticky top-8 z-20")}>
                <Input
                  key={`${filterResetKey}-${col.id}`}
                  defaultValue={filterDraftRef.current[col.id] || ""}
                  onChange={(e) => {
                    filterDraftRef.current[col.id] = e.target.value;
                    scheduleApplyFilters();
                  }}
                  className="h-6 w-full min-w-0 text-xs px-1 rounded-none"
                />
              </div>
            ))}
            <div className={cn(filterCellClass, "sticky top-8 z-20")}></div>

            {/* Rows */}
            {isLoading ? (
              <div className="col-span-full flex h-40 items-center justify-center text-sm text-muted-foreground border-b border-border">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Dokumente werden geladen…
              </div>
            ) : docs.length === 0 ? (
              <div className="col-span-full flex h-40 items-center justify-center text-sm text-muted-foreground border-b border-border">
                Keine Dokumente gefunden.
              </div>
            ) : (
              <>
                {filteredDocs.map(({ doc, idx }, rowIndex) => {
                  const rowEdited = edited[idx] ?? {};
                  const rowInitial = initial[idx] ?? {};
                  const entityName = editedDocTypes[idx] || String(doc.entityName ?? "");
                  const defs = attrDefsByEntity[entityName] ?? {};

                  // Determine lock-state: if the SAVED status is "Freigegeben", lock all fields except Status.
                  const statusCol = displayColumns.find(
                    (c) => c.kind === "attr" && c.id === "status"
                  ) as Extract<DisplayColumn, { kind: "attr" }> | undefined;

                  const statusAttrName = statusCol
                    ? resolveAttrName(rowEdited, rowInitial, defs, statusCol)
                    : "Status";
                  const statusDef = defs[statusAttrName];
                  const initialStatusValue = (rowInitial[statusAttrName] ?? "").toString();
                  const initialStatusLabel = statusDef?.valueset?.length
                    ? statusDef.valueset.find((vs) => vs.name === initialStatusValue)?.desc || initialStatusValue
                    : initialStatusValue;

                  const isLockedByStatus = initialStatusLabel === "Freigegeben";

                  const isHighlighted = highlightedSet.has(getDocKey(doc));
                  const typeChanged = (editedDocTypes[idx] ?? "") !== (initialDocTypes[idx] ?? "");
                  // NEW: note changes will also trigger hasChanges
                  const noteChanged = (rowEdited["Anmerkung"] ?? "") !== (rowInitial["Anmerkung"] ?? "");
                  const hasChanges =
                    typeChanged ||
                    noteChanged ||
                    editableColumns.some((c) => {
                      const attrName = resolveAttrName(rowEdited, rowInitial, defs, c);
                      return (rowEdited[attrName] ?? "") !== (rowInitial[attrName] ?? "");
                    });

                  return (
                    <React.Fragment key={`${doc.entityName || "doc"}-${doc.filename || idx}-${idx}`}>
                      {/* Detail Button (now first icon cell) */}
                      <div
                        className={cn(
                          iconCellClass,
                          isHighlighted && rowHighlightClass,
                          isHighlighted && rowHighlightLeft
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            runWithUnsavedGuard(() =>
                              onOpenFullPreview(doc, (updatedDoc) => {
                                void updatedDoc;
                              })
                            )
                          }
                          title="Details anzeigen"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Select Checkbox */}
                      <div className={cn(iconCellClass, isHighlighted && rowHighlightClass)}>
                        <Checkbox
                          checked={selectedRows.has(idx)}
                          onCheckedChange={() => toggleRowSelected(idx)}
                          className="h-4 w-4"
                          disabled={!doc.pid}
                          aria-label="Dokument auswählen"
                        />
                      </div>

                      {/* Save Button */}
                      <div className={cn(iconCellClass, isHighlighted && rowHighlightClass)}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-6 w-6", hasChanges && "bg-orange-500 hover:bg-orange-600 text-white")}
                          disabled={!hasChanges || !doc.pid}
                          onClick={async () => {
                            const newEntityName = typeChanged ? (editedDocTypes[idx] ?? "") : undefined;
                            
                            const updates = editableColumns
                              .map((c) => {
                                const attrName = resolveAttrName(rowEdited, rowInitial, defs, c);
                                return {
                                  name: attrName,
                                  value: rowEdited[attrName] ?? "",
                                  changed: (rowEdited[attrName] ?? "") !== (rowInitial[attrName] ?? ""),
                                };
                              })
                              .filter((u) => u.changed)
                              .map((u) => ({ name: u.name, value: u.value }));

                            // NEW: include note changes
                            if ((rowEdited["Anmerkung"] ?? "") !== (rowInitial["Anmerkung"] ?? "")) {
                              updates.push({ name: "Anmerkung", value: rowEdited["Anmerkung"] ?? "" });
                            }

                            if (updates.length || newEntityName) {
                              const res = await onSaveRow(doc, updates, { entityName: newEntityName });
                              if (res.ok) {
                                setEdited((prev) => ({ ...prev, [idx]: { ...rowInitial } }));
                                if (!typeChanged) {
                                  setEditedDocTypes((prev) => ({ ...prev, [idx]: initialDocTypes[idx] ?? "" }));
                                }
                                setSyncWithInitial((prev) => {
                                  const next = new Set(prev);
                                  next.add(idx);
                                  return next;
                                });
                                flashSuccess(idx, updates.map((u) => u.name));
                              } else {
                                const colsToFlash = res.errorAttributes?.length ? res.errorAttributes : updates.map((u) => u.name);
                                flashError(idx, colsToFlash);
                              }
                            }
                          }}
                          title={doc.pid ? (hasChanges ? "Änderungen speichern" : "Keine Änderungen") : "PID fehlt – Speichern nicht möglich"}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Replace Button */}
                      <div className={cn(iconCellClass, isHighlighted && rowHighlightClass)}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={!doc.pid}
                          onClick={() => runWithUnsavedGuard(() => void setConfirmReplaceRow(idx))}
                          title={doc.pid ? "Dokument ersetzen" : "PID fehlt"}
                          aria-label="Dokument ersetzen"
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Linked Documents Button */}
                      <div className={cn(iconCellClass, isHighlighted && rowHighlightClass)}>
                        {doc.pid ? (
                          <LinkedDocumentsDialog
                            authToken={authToken}
                            cloudEnvironment={cloudEnvironment}
                            mainPid={doc.pid}
                            trigger={({ setOpen }) => {
                              const linked = hasLinkedDocuments(doc);
                              return (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "h-6 w-6",
                                    linked
                                      ? "text-violet-600 hover:text-violet-700"
                                      : "text-muted-foreground hover:text-violet-700"
                                  )}
                                  onClick={() => runWithUnsavedGuard(() => void setOpen(true))}
                                  title="Verlinkte Dokumente anzeigen"
                                  aria-label="Verlinkte Dokumente anzeigen"
                                >
                                  <LinkIcon className="h-3 w-3" />
                                </Button>
                              );
                            }}
                          />
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-50 cursor-not-allowed"
                            disabled
                            title="PID fehlt – keine Verlinkungen"
                            aria-label="Verlinkte Dokumente anzeigen"
                          >
                            <LinkIcon className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Project Link Indicator (click to edit Projekt_Verlinkung) */}
                      <div className={cn(iconCellClass, isHighlighted && rowHighlightClass)}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-6 w-6",
                            hasProjectLinks(doc)
                              ? "text-amber-700 hover:text-amber-800"
                              : "text-muted-foreground hover:text-amber-800"
                          )}
                          disabled={!doc.pid}
                          onClick={() => runWithUnsavedGuard(() => void openProjectLinksEditor(idx))}
                          title={(() => {
                            if (!doc.pid) return "PID fehlt";

                            const links = getProjectLinksForDoc(doc);
                            const originProject = getAttrValue(doc, ["Projekt"]);
                            const originOpp = getAttrValue(doc, ["Gelegenheit"]);

                            const ctxProject = (contextProject ?? "").toString().trim();
                            const ctxOpp = (contextOpportunityId ?? "").toString().trim();

                            const originParts: string[] = [];
                            if (doc.linkedViaProject) {
                              if (originOpp && ctxOpp && originOpp !== ctxOpp) {
                                originParts.push(`Ausgangs-Gelegenheit: ${originOpp}`);
                              }
                              if (originProject && ctxProject && originProject !== ctxProject) {
                                originParts.push(`Hauptprojekt: ${originProject}`);
                              }
                            }

                            if (!links.length) {
                              return originParts.length
                                ? `${originParts.join(" · ")} · Keine Projekt-Verknüpfung`
                                : "Keine Projekt-Verknüpfung";
                            }

                            const linkText = `Projekt-Verknüpfungen: ${links.join(", ")}`;
                            return originParts.length
                              ? `${originParts.join(" · ")} · ${linkText}`
                              : linkText;
                          })()}
                          aria-label="Projekt-Verknüpfungen bearbeiten"
                        >
                          <Link2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* MOVED: Note Editor Button (now after Linked Docs) */}
                      <div className={cn(iconCellClass, isHighlighted && rowHighlightClass)}>
                        {(() => {
                          const note = String((rowEdited?.["Anmerkung"] ?? rowInitial?.["Anmerkung"] ?? "")).trim();
                          const hasNote = note.length > 0;

                          return (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6",
                                hasNote
                                  ? "text-foreground hover:text-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              disabled={!doc.pid}
                              onClick={() => openNoteEditor(idx)}
                              title={hasNote ? "Anmerkung bearbeiten" : "Keine Anmerkung – hinzufügen"}
                              aria-label="Anmerkung bearbeiten"
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          );
                        })()}
                      </div>

                      {/* Data columns */}
                      {displayColumns.map((col) => {
                        if (col.kind === "meta") {
                          const value = col.getValue(doc);

                          if (col.id === "dokumentname") {
                            return (
                              <div
                                key={`${idx}-${col.id}`}
                                className={cn(gridCellClass, "flex items-center gap-2 min-w-0", isHighlighted && rowHighlightClass)}
                              >
                                <div className="min-w-0 flex-1">
                                  <TruncatedTextCell value={(value || "").toString()} />
                                </div>
                                {doc.linkedViaProject ? (
                                  <Badge
                                    variant="default"
                                    className="bg-gray-700 text-white border border-gray-800 text-[10px] px-2 py-0.5 font-semibold whitespace-nowrap"
                                  >
                                    verknüpft
                                  </Badge>
                                ) : null}
                                {doc.migratedViaProject ? (
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] px-2 py-0.5 font-semibold whitespace-nowrap"
                                  >
                                    migriert
                                  </Badge>
                                ) : null}
                              </div>
                            );
                          }

                          return (
                            <div key={`${idx}-${col.id}`} className={cn(gridCellClass, "flex items-center", isHighlighted && rowHighlightClass)}>
                              <TruncatedTextCell value={(value || "").toString()} />
                            </div>
                          );
                        }

                        const attrName = resolveAttrName(rowEdited, rowInitial, defs, col);
                        const hasError = (errorHighlights[idx] ?? []).includes(attrName);
                        const hasSuccess = (successHighlights[idx] ?? []).includes(attrName);
                        const def = defs[attrName];
                        const isDate = col.forceDate || def?.type === "7" || attrName === "Belegdatum";

                        const isStatusCol = col.id === "status";
                        const isSerienstatusCol = col.id === "serienstatus";
                        const isVersuchsstatusCol = col.id === "versuchsstatus";
                        const isGeometrieartCol = col.id === "geometrieart";
                        const isGeoSpecificCol =
                          col.id === "serienstatus" ||
                          col.id === "versuchsstatus" ||
                          col.id === "s_k_version" ||
                          col.id === "v_k_version" ||
                          col.id === "lfd_nr" ||
                          col.id === "geometrieart";
                        // Bei Geometriedaten-spezifischen Spalten: wenn Attribut beim aktuellen Dokumenttyp nicht existiert, nicht editierbar machen
                        const isEditDisabled = (isLockedByStatus && !isStatusCol) || (isGeoSpecificCol && !def);
                        // Keep the disable behavior, but avoid dimming/overlay when the row is locked by Status=Freigegeben.
                        const dimDisabled = isEditDisabled && !isLockedByStatus;

                        const isGeometriedatenFilter =
                          activeDocFilter === "FME_GEOM_KUNDE" ||
                          activeDocFilter === "FME_SERIE_GUELTIG" ||
                          activeDocFilter === "FME_VERSUCH_GUELTIG" ||
                          activeDocFilter === "FSI_GEOM_KUNDE" ||
                          activeDocFilter === "FSI_SERIE_GUELTIG" ||
                          activeDocFilter === "FSI_VERSUCH_GUELTIG";

                        const isGeometriedatenDoc = String(entityName).toLowerCase().includes("geometriedaten");
                        const useGeometriedatenColors = isGeometriedatenFilter || isGeometriedatenDoc;

                        const statusLabel = isStatusCol
                          ? (def?.valueset?.find((vs) => vs.name === (rowEdited[attrName] ?? ""))?.desc ??
                              (rowEdited[attrName] ?? ""))
                          : "";

                        const serienstatusLabel = isSerienstatusCol
                          ? (def?.valueset?.find((vs) => vs.name === (rowEdited[attrName] ?? ""))?.desc ??
                              (rowEdited[attrName] ?? ""))
                          : "";

                        const versuchsstatusLabel = isVersuchsstatusCol
                          ? (def?.valueset?.find((vs) => vs.name === (rowEdited[attrName] ?? ""))?.desc ??
                              (rowEdited[attrName] ?? ""))
                          : "";

                        const geometrieartLabel = isGeometrieartCol
                          ? (def?.valueset?.find((vs) => vs.name === (rowEdited[attrName] ?? ""))?.desc ??
                              (rowEdited[attrName] ?? ""))
                          : "";

                        const geometriedatenStatusStyles: Record<
                          string,
                          { triggerClass: string; itemClass: string }
                        > = {
                          "In Änderung": {
                            triggerClass:
                              "bg-[#CAF0CC] text-black border-[#CAF0CC] hover:bg-[#CAF0CC]",
                            itemClass:
                              "bg-[#CAF0CC] text-black data-[highlighted]:bg-[#CAF0CC] data-[highlighted]:text-black data-[state=checked]:bg-[#CAF0CC] data-[state=checked]:text-black",
                          },
                          Freigegeben: {
                            triggerClass:
                              "bg-[#498205] text-white border-[#498205] hover:bg-[#498205]",
                            itemClass:
                              "bg-[#498205] text-white data-[highlighted]:bg-[#498205] data-[highlighted]:text-white data-[state=checked]:bg-[#498205] data-[state=checked]:text-white",
                          },
                          Registriert: {
                            triggerClass:
                              "bg-[#757575] text-white border-[#757575] hover:bg-[#757575]",
                            itemClass:
                              "bg-[#757575] text-white data-[highlighted]:bg-[#757575] data-[highlighted]:text-white data-[state=checked]:bg-[#757575] data-[state=checked]:text-white",
                          },
                          Ungültig: {
                            triggerClass:
                              "bg-[#D13438] text-white border-[#D13438] hover:bg-[#D13438]",
                            itemClass:
                              "bg-[#D13438] text-white data-[highlighted]:bg-[#D13438] data-[highlighted]:text-white data-[state=checked]:bg-[#D13438] data-[state=checked]:text-white",
                          },
                        };

                        // For non-Geometriedaten documents we only want 3 status options, but we still
                        // show a legacy status if it is currently selected on that document.
                        const nonGeoStatusAllowedLabels = new Set([
                          "Freigegeben",
                          "In Arbeit",
                          "Ungültig",
                        ]);

                        const nonGeoStatusStyles: Record<
                          string,
                          { triggerClass: string; itemClass: string }
                        > = {
                          Freigegeben: {
                            triggerClass:
                              "bg-[#498205] text-white border-[#498205] hover:bg-[#498205]",
                            itemClass:
                              "bg-[#498205] text-white data-[highlighted]:bg-[#498205] data-[highlighted]:text-white data-[state=checked]:bg-[#498205] data-[state=checked]:text-white",
                          },
                          "In Arbeit": {
                            triggerClass:
                              "bg-[#FFEBC0] text-black border-[#FFEBC0] hover:bg-[#FFEBC0]",
                            itemClass:
                              "bg-[#FFEBC0] text-black data-[highlighted]:bg-[#FFEBC0] data-[highlighted]:text-black data-[state=checked]:bg-[#FFEBC0] data-[state=checked]:text-black",
                          },
                          Ungültig: {
                            triggerClass:
                              "bg-[#D13438] text-white border-[#D13438] hover:bg-[#D13438]",
                            itemClass:
                              "bg-[#D13438] text-white data-[highlighted]:bg-[#D13438] data-[highlighted]:text-white data-[state=checked]:bg-[#D13438] data-[state=checked]:text-white",
                          },
                        };

                        const geometriedatenSerienstatusStyles: Record<
                          string,
                          { triggerClass: string; itemClass: string }
                        > = {
                          "Serie führend": {
                            triggerClass:
                              "bg-[#498205] text-white border-[#498205] hover:bg-[#498205]",
                            itemClass:
                              "bg-[#498205] text-white data-[highlighted]:bg-[#498205] data-[highlighted]:text-white data-[state=checked]:bg-[#498205] data-[state=checked]:text-white",
                          },
                          "Serie ungültig": {
                            triggerClass:
                              "bg-[#D13438] text-white border-[#D13438] hover:bg-[#D13438]",
                            itemClass:
                              "bg-[#D13438] text-white data-[highlighted]:bg-[#D13438] data-[highlighted]:text-white data-[state=checked]:bg-[#D13438] data-[state=checked]:text-white",
                          },
                          "Serie normal": {
                            triggerClass:
                              "bg-[#CAF0CC] text-black border-[#CAF0CC] hover:bg-[#CAF0CC]",
                            itemClass:
                              "bg-[#CAF0CC] text-black data-[highlighted]:bg-[#CAF0CC] data-[highlighted]:text-black data-[state=checked]:bg-[#CAF0CC] data-[state=checked]:text-black",
                          },
                          "Serie eingeschränkt": {
                            triggerClass:
                              "bg-[#FFEBC0] text-black border-[#FFEBC0] hover:bg-[#FFEBC0]",
                            itemClass:
                              "bg-[#FFEBC0] text-black data-[highlighted]:bg-[#FFEBC0] data-[highlighted]:text-black data-[state=checked]:bg-[#FFEBC0] data-[state=checked]:text-black",
                          },
                        };

                        const geometriedatenVersuchsstatusStyles: Record<
                          string,
                          { triggerClass: string; itemClass: string }
                        > = {
                          "Versuch führend": {
                            triggerClass:
                              "bg-[#498205] text-white border-[#498205] hover:bg-[#498205]",
                            itemClass:
                              "bg-[#498205] text-white data-[highlighted]:bg-[#498205] data-[highlighted]:text-white data-[state=checked]:bg-[#498205] data-[state=checked]:text-white",
                          },
                          "Versuch ungültig": {
                            triggerClass:
                              "bg-[#D13438] text-white border-[#D13438] hover:bg-[#D13438]",
                            itemClass:
                              "bg-[#D13438] text-white data-[highlighted]:bg-[#D13438] data-[highlighted]:text-white data-[state=checked]:bg-[#D13438] data-[state=checked]:text-white",
                          },
                          "Versuch normal": {
                            triggerClass:
                              "bg-[#CAF0CC] text-black border-[#CAF0CC] hover:bg-[#CAF0CC]",
                            itemClass:
                              "bg-[#CAF0CC] text-black data-[highlighted]:bg-[#CAF0CC] data-[highlighted]:text-black data-[state=checked]:bg-[#CAF0CC] data-[state=checked]:text-black",
                          },
                          "Versuch eingeschränkt": {
                            triggerClass:
                              "bg-[#FFEBC0] text-black border-[#FFEBC0] hover:bg-[#FFEBC0]",
                            itemClass:
                              "bg-[#FFEBC0] text-black data-[highlighted]:bg-[#FFEBC0] data-[highlighted]:text-black data-[state=checked]:bg-[#FFEBC0] data-[state=checked]:text-black",
                          },
                        };

                        const getGeometriedatenGeometrieartStyle = (label: string) => {
                          const first = (label || "").trim().charAt(0).toUpperCase();
                          if (first === "H") {
                            return {
                              triggerClass:
                                "bg-[#FFEBC0] text-black border-[#FFEBC0] hover:bg-[#FFEBC0]",
                              itemClass:
                                "bg-[#FFEBC0] text-black data-[highlighted]:bg-[#FFEBC0] data-[highlighted]:text-black data-[state=checked]:bg-[#FFEBC0] data-[state=checked]:text-black",
                            };
                          }
                          if (first === "D") {
                            return {
                              triggerClass:
                                "bg-[#80C6FF] text-black border-[#80C6FF] hover:bg-[#80C6FF]",
                              itemClass:
                                "bg-[#80C6FF] text-black data-[highlighted]:bg-[#80C6FF] data-[highlighted]:text-black data-[state=checked]:bg-[#80C6FF] data-[state=checked]:text-black",
                            };
                          }
                          if (first === "Z") {
                            return {
                              triggerClass:
                                "bg-[#D8D8EE] text-black border-[#D8D8EE] hover:bg-[#D8D8EE]",
                              itemClass:
                                "bg-[#D8D8EE] text-black data-[highlighted]:bg-[#D8D8EE] data-[highlighted]:text-black data-[state=checked]:bg-[#D8D8EE] data-[state=checked]:text-black",
                            };
                          }
                          if (first === "S") {
                            return {
                              triggerClass:
                                "bg-[#C3F8F9] text-black border-[#C3F8F9] hover:bg-[#C3F8F9]",
                              itemClass:
                                "bg-[#C3F8F9] text-black data-[highlighted]:bg-[#C3F8F9] data-[highlighted]:text-black data-[state=checked]:bg-[#C3F8F9] data-[state=checked]:text-black",
                            };
                          }
                          return undefined;
                        };

                        const geometrieartStyle =
                          isGeometriedatenFilter && isGeometrieartCol
                            ? getGeometriedatenGeometrieartStyle(geometrieartLabel)
                            : undefined;

                        const isNonGeoStatusCol = isStatusCol && !useGeometriedatenColors;

                        const selectStyle =
                          useGeometriedatenColors && isStatusCol
                            ? geometriedatenStatusStyles[statusLabel]
                            : isNonGeoStatusCol
                              ? nonGeoStatusStyles[statusLabel]
                              : useGeometriedatenColors && isSerienstatusCol
                                ? geometriedatenSerienstatusStyles[serienstatusLabel]
                                : useGeometriedatenColors && isVersuchsstatusCol
                                  ? geometriedatenVersuchsstatusStyles[versuchsstatusLabel]
                                  : useGeometriedatenColors && isGeometrieartCol
                                    ? getGeometriedatenGeometrieartStyle(geometrieartLabel)
                                    : undefined;

                        const selectColorClass =
                          (isStatusCol || isSerienstatusCol || isVersuchsstatusCol || isGeometrieartCol) && (rowEdited[attrName] ?? "")
                            ? selectStyle?.triggerClass ?? ""
                            : "";

                        return (
                          <div key={`${idx}-${col.id}`} className={cn(gridCellClass, isHighlighted && rowHighlightClass)}>
                            {def?.valueset && def.valueset.length > 0 ? (
                              <Select
                                value={(rowEdited[attrName] ?? "") || undefined}
                                onValueChange={(val) =>
                                  setEdited((prev) => {
                                    const row = { ...(prev[idx] ?? {}) };
                                    row[attrName] = val;
                                    return { ...prev, [idx]: row };
                                  })
                                }
                                disabled={isEditDisabled}
                              >
                                <SelectTrigger
                                  disabled={isEditDisabled}
                                  title={
                                    def?.valueset?.find((vs) => vs.name === (rowEdited[attrName] ?? ""))?.desc ??
                                    (rowEdited[attrName] ?? "")
                                  }
                                  className={cn(
                                    "h-6 w-full min-w-0 text-xs px-1 rounded-none whitespace-nowrap disabled:opacity-100",
                                    selectColorClass,
                                    dimDisabled && "opacity-60",
                                    hasError &&
                                      !hasSuccess &&
                                      "border-red-500 ring-2 ring-red-500 animate-[error-blink_0.9s_ease-in-out_2]",
                                    hasSuccess &&
                                      !hasError &&
                                      "border-success-highlight ring-2 ring-success-highlight animate-[success-blink_0.9s_ease-in-out_2]"
                                  )}
                                >
                                  <SelectValue placeholder="Wählen…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(() => {
                                    const currentValue = (rowEdited[attrName] ?? "").toString();
                                    const currentVs = def.valueset.find((vs) => vs.name === currentValue);
                                    const currentLabel = (currentVs?.desc || currentVs?.name || "").trim();

                                    const baseValueset = isNonGeoStatusCol
                                      ? def.valueset.filter((vs) => {
                                          const label = (vs.desc || vs.name || "").trim();
                                          return nonGeoStatusAllowedLabels.has(label);
                                        })
                                      : def.valueset;

                                    const needsLegacy =
                                      isNonGeoStatusCol &&
                                      currentValue &&
                                      currentLabel &&
                                      !nonGeoStatusAllowedLabels.has(currentLabel);

                                    const effectiveValueset =
                                      needsLegacy && currentVs && !baseValueset.some((v) => v.name === currentVs.name)
                                        ? [currentVs, ...baseValueset]
                                        : baseValueset;

                                    return effectiveValueset.map((vs) => {
                                      const label = (vs.desc || vs.name || "").trim();

                                      const itemStyle =
                                        useGeometriedatenColors && isStatusCol
                                          ? geometriedatenStatusStyles[label]
                                          : isNonGeoStatusCol && nonGeoStatusAllowedLabels.has(label)
                                            ? nonGeoStatusStyles[label]
                                            : useGeometriedatenColors && isSerienstatusCol
                                              ? geometriedatenSerienstatusStyles[label]
                                              : useGeometriedatenColors && isVersuchsstatusCol
                                                ? geometriedatenVersuchsstatusStyles[label]
                                                : useGeometriedatenColors && isGeometrieartCol
                                                  ? getGeometriedatenGeometrieartStyle(label)
                                                  : undefined;

                                      return (
                                        <SelectItem
                                          key={vs.name}
                                          value={vs.name}
                                          className={cn(itemStyle?.itemClass, "whitespace-nowrap rounded-none")}
                                        >
                                          {label}
                                        </SelectItem>
                                      );
                                    });
                                  })()}
                                </SelectContent>
                              </Select>
                            ) : isDate ? (
                              (() => {
                                const cellKey = `${idx}__${attrName}`;
                                const isInvalid = dateInputErrors.has(cellKey);

                                const displayValue = rowEdited[attrName]
                                  ? (() => {
                                      try {
                                        return format(parse(rowEdited[attrName], "yyyy-MM-dd", new Date()), "dd.MM.yyyy");
                                      } catch {
                                        return "";
                                      }
                                    })()
                                  : "";

                                return (
                                  <Popover
                                    open={openDateKey === cellKey}
                                    onOpenChange={(open) => setOpenDateKey(open ? cellKey : null)}
                                  >
                                    <PopoverPrimitive.Anchor asChild>
                                      <div className="relative w-full">
                                        <Input
                                          key={`${idx}-${attrName}-${rowEdited[attrName] ?? ""}`}
                                          defaultValue={displayValue}
                                          disabled={isEditDisabled}
                                          placeholder="TT.MM.JJJJ"
                                          title={displayValue}
                                          onFocus={() => {
                                            if (isEditDisabled) return;
                                            // Defer open so the input keeps focus (cursor stays visible)
                                            requestAnimationFrame(() => setOpenDateKey(cellKey));
                                          }}
                                          onBlur={(e) => {
                                            if (isEditDisabled) return;
                                            commitDateInput(cellKey, idx, attrName, e.target.value);
                                          }}
                                          onKeyDown={(e) => {
                                            if (isEditDisabled) return;
                                            if (e.key === "Enter") {
                                              commitDateInput(cellKey, idx, attrName, (e.target as HTMLInputElement).value);
                                              setOpenDateKey(null);
                                            }
                                          }}
                                          className={cn(
                                            "h-6 w-full min-w-0 text-xs px-1 pr-7 rounded-none disabled:opacity-100",
                                            dimDisabled && "opacity-60",
                                            isInvalid && "border-red-500 ring-2 ring-red-500",
                                            hasError &&
                                              !hasSuccess &&
                                              "border-red-500 ring-2 ring-red-500 animate-[error-blink_0.9s_ease-in-out_2]",
                                            hasSuccess &&
                                              !hasError &&
                                              "border-success-highlight ring-2 ring-success-highlight animate-[success-blink_0.9s_ease-in-out_2]"
                                          )}
                                        />

                                        <button
                                          type="button"
                                          className={cn(
                                             "absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground",
                                             isEditDisabled && "pointer-events-none",
                                             dimDisabled && "opacity-60"
                                           )}
                                          onMouseDown={(e) => {
                                            // Keep focus on the input
                                            e.preventDefault();
                                          }}
                                          onClick={() => {
                                            if (isEditDisabled) return;
                                            setOpenDateKey((prev) => (prev === cellKey ? null : cellKey));
                                          }}
                                          aria-label="Kalender öffnen"
                                          title="Kalender öffnen"
                                        >
                                          <CalendarDays className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </PopoverPrimitive.Anchor>

                                    <PopoverContent
                                      className="p-0"
                                      align="start"
                                      onOpenAutoFocus={(e) => e.preventDefault()}
                                    >
                                      <Calendar
                                        mode="single"
                                        selected={
                                          rowEdited[attrName]
                                            ? parse(rowEdited[attrName], "yyyy-MM-dd", new Date())
                                            : undefined
                                        }
                                        onSelect={(date) => {
                                          if (isEditDisabled) return;
                                          const iso = date ? format(date, "yyyy-MM-dd") : "";
                                          setEdited((prev) => {
                                            const row = { ...(prev[idx] ?? {}) };
                                            row[attrName] = iso;
                                            return { ...prev, [idx]: row };
                                          });
                                          setDateInputErrors((prev) => {
                                            const next = new Set(prev);
                                            next.delete(cellKey);
                                            return next;
                                          });
                                          setOpenDateKey(null);
                                        }}
                                      />
                                      {isInvalid ? (
                                        <div className="px-3 py-2 text-xs text-destructive border-t">
                                          Ungültiges Datum. Bitte im Format TT.MM.JJJJ eingeben.
                                        </div>
                                      ) : null}
                                    </PopoverContent>
                                  </Popover>
                                );
                              })()
                            ) : (
                              <Input
                                value={rowEdited[attrName] ?? ""}
                                disabled={isEditDisabled}
                                title={(rowEdited[attrName] ?? "").toString()}
                                onChange={(e) =>
                                  setEdited((prev) => {
                                    const row = { ...(prev[idx] ?? {}) };
                                    row[attrName] = e.target.value;
                                    return { ...prev, [idx]: row };
                                  })
                                }
                                className={cn(
                                  "h-6 w-full min-w-0 text-xs px-1 rounded-none disabled:opacity-100",
                                  dimDisabled && "opacity-60",
                                   hasError &&
                                     !hasSuccess &&
                                     "border-red-500 ring-2 ring-red-500 animate-[error-blink_0.9s_ease-in-out_2]",
                                   hasSuccess &&
                                     !hasError &&
                                     "border-success-highlight ring-2 ring-success-highlight animate-[success-blink_0.9s_ease-in-out_2]"
                                 )}
                              />
                            )}{" "}
                          </div>
                        );
                      })}

                      {/* Delete Button */}
                      <div
                        className={cn(
                          iconCellClass,
                          isHighlighted && rowHighlightClass,
                          isHighlighted && rowHighlightRight
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          disabled={!doc.pid}
                          onClick={() => runWithUnsavedGuard(() => setConfirmDeleteRow(idx))}
                          title={doc.pid ? "Dokument löschen" : "PID fehlt"}
                          aria-label="Dokument löschen"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {rowIndex < filteredDocs.length - 1 && (
                        <div className="col-span-full h-px bg-border/60" />
                      )}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </TooltipProvider>

      {/* NOTE EDITOR DIALOG */}
      <Dialog
        open={noteEditorRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNoteEditorRow(null);
            noteEditorDraftRef.current = "";
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anmerkung bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie den Text der Anmerkung. Speichern erfolgt wie gewohnt über die Zeilen‑Schaltfläche oder "Alle Änderungen speichern".
            </DialogDescription>
          </DialogHeader>
          <Textarea
            key={noteEditorRow ?? "closed"}
            defaultValue={noteEditorDraftRef.current}
            onChange={(e) => {
              noteEditorDraftRef.current = e.target.value;
            }}
            className="min-h-[200px] rounded-none"
            placeholder="Anmerkung eingeben…"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setNoteEditorRow(null);
                noteEditorDraftRef.current = "";
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                if (noteEditorRow == null) return;
                const idx = noteEditorRow;
                setEdited((prev) => {
                  const row = { ...(prev[idx] ?? {}) };
                  row["Anmerkung"] = noteEditorDraftRef.current;
                  return { ...prev, [idx]: row };
                });
                setNoteEditorRow(null);
                noteEditorDraftRef.current = "";
              }}
            >
              Übernehmen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Links Dialog */}
      <Dialog
        open={projectLinksRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProjectLinksRow(null);
            setProjectLinksDraft([]);
            setProjectLinksLoading(false);
            setProjectLinksSaving(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Projekt-Verknüpfungen</DialogTitle>
            <DialogDescription>
              Verwalten Sie die Werte in <span className="font-mono">Projekt_Verlinkung</span>.
              {(() => {
                if (projectLinksRow == null) return null;
                const d = docs[projectLinksRow];
                if (!d?.linkedViaProject) return null;

                const originProject = getAttrValue(d, ["Projekt"]);
                const originOpp = getAttrValue(d, ["Gelegenheit"]);
                const ctxProject = (contextProject ?? "").toString().trim();
                const ctxOpp = (contextOpportunityId ?? "").toString().trim();

                const parts: string[] = [];
                if (originOpp && ctxOpp && originOpp !== ctxOpp) parts.push(`Ausgangs-Gelegenheit: ${originOpp}`);
                if (originProject && ctxProject && originProject !== ctxProject) parts.push(`Hauptprojekt: ${originProject}`);
                if (!parts.length) return null;

                return <div className="mt-2 text-xs text-muted-foreground">{parts.join(" · ")}</div>;
              })()}
            </DialogDescription>
          </DialogHeader>

          {projectLinksLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade…
            </div>
          ) : (
            <div className="space-y-2">
              {projectLinksDraft.map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={val}
                    onChange={(e) => {
                      const v = e.target.value;
                      setProjectLinksDraft((prev) => prev.map((p, idx) => (idx === i ? v : p)));
                    }}
                    placeholder="Projekt-Nr. hinzufügen"
                    className="h-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setProjectLinksDraft((prev) => prev.filter((_, idx) => idx !== i))}
                    title="Entfernen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setProjectLinksDraft((prev) => [...prev, ""])}
              >
                <Plus className="mr-2 h-4 w-4" /> Projekt hinzufügen
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              disabled={projectLinksSaving}
              onClick={() => {
                setProjectLinksRow(null);
                setProjectLinksDraft([]);
              }}
            >
              Abbrechen
            </Button>
            <Button
              disabled={projectLinksSaving || projectLinksLoading}
              onClick={async () => {
                if (projectLinksRow == null) return;
                const doc = docs[projectLinksRow];
                if (!doc?.pid) return;
                const pid = String(doc.pid);

                const cleaned = Array.from(
                  new Set(
                    (projectLinksDraft || [])
                      .map((v) => String(v).trim())
                      .filter(Boolean)
                  )
                );

                setProjectLinksSaving(true);
                try {
                  await setIdmItemProjectLinks(authToken, cloudEnvironment, pid, cleaned, "de-DE");
                  projectLinksByPidRef.current[pid] = cleaned;
                  toast({ title: "Projekt-Verknüpfungen gespeichert", variant: "success" });
                  setProjectLinksRow(null);
                  setProjectLinksDraft([]);
                } catch (err: any) {
                  toast({
                    title: "Speichern fehlgeschlagen",
                    description: String(err?.message ?? "Unbekannter Fehler"),
                    variant: "destructive",
                  });
                } finally {
                  setProjectLinksSaving(false);
                }
              }}
            >
              {projectLinksSaving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog
        open={confirmDeleteRow !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteRow(null);
        }}
      >
        <DialogContent className="w-fit max-w-[95vw]">
          <DialogHeader className="pr-10">
            <DialogTitle>Soll das Dokument wirklich gelöscht werden?</DialogTitle>
            <DialogDescription className="whitespace-nowrap">Diese Aktion kann nicht rückgängig gemacht werden.</DialogDescription>
            {(() => {
              const row = confirmDeleteRow;
              if (row == null) return null;
              const doc = docs[row];
              if (!doc?.pid) return null;
              const links = getProjectLinksForDoc(doc);
              if (!links.length) return null;
              return (
                <div className="mt-2 text-xs text-amber-700">
                  Achtung: In <span className="font-mono">Projekt_Verlinkung</span> sind Werte hinterlegt. Beim Löschen gehen diese Verknüpfungen verloren.
                </div>
              );
            })()}
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteRow(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const row = confirmDeleteRow;
                setConfirmDeleteRow(null);
                if (row == null) return;
                const doc = docs[row];
                if (!doc?.pid) return;
                await onDeleteDoc(doc);
              }}
            >
              Ja
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Batch Delete Dialog */}
      <Dialog
        open={confirmBatchDelete}
        onOpenChange={(open) => setConfirmBatchDelete(open)}
      >
        <DialogContent className="w-fit max-w-[95vw]">
          <DialogHeader className="pr-10">
            <DialogTitle>Sollen die ausgewählten Dokumente wirklich gelöscht werden?</DialogTitle>
            <DialogDescription className="whitespace-nowrap">Diese Aktion kann nicht rückgängig gemacht werden.</DialogDescription>
            {(() => {
              const selectedDocs = Array.from(selectedRows)
                .map((i) => docs[i])
                .filter((d) => d && d.pid) as IdmDocPreview[];
              const withLinks = selectedDocs.filter((d) => getProjectLinksForDoc(d).length > 0);
              if (withLinks.length === 0) return null;
              return (
                <div className="mt-2 text-xs text-amber-700">
                  Achtung: {withLinks.length} Dokument(e) haben Einträge in <span className="font-mono">Projekt_Verlinkung</span>. Beim Löschen gehen diese Verknüpfungen verloren.
                </div>
              );
            })()}
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmBatchDelete(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await executeBatchDelete();
              }}
            >
              Ja
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <Dialog
        open={unsavedDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUnsavedDialogOpen(false);
            pendingActionRef.current = null;
            setUnsavedSaveFailed(false);
          }
        }}
      >
        <DialogContent className="w-fit max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Nicht gespeicherte Änderungen</DialogTitle>
            <DialogDescription>
              Es gibt Änderungen, die noch nicht gespeichert wurden. Bitte speichern Sie zuerst, um fortzufahren.
            </DialogDescription>
          </DialogHeader>

          {unsavedSaveFailed && (
            <div className="text-sm text-destructive">
              Speichern nicht vollständig möglich. Bitte prüfen Sie die markierten Felder.
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              disabled={unsavedSaving}
              onClick={() => {
                setUnsavedDialogOpen(false);
                pendingActionRef.current = null;
              }}
            >
              Abbrechen
            </Button>

            <Button
              variant="destructive"
              disabled={unsavedSaving}
              onClick={async () => {
                // Discard all local edits and continue with the user's intended action.
                setEdited(initial);
                setEditedDocTypes(initialDocTypes);
                setUnsavedDialogOpen(false);
                setUnsavedSaveFailed(false);
                const action = pendingActionRef.current;
                pendingActionRef.current = null;
                action?.();
              }}
            >
              Ohne Speichern fortfahren
            </Button>

            <Button
              disabled={unsavedSaving}
              onClick={async () => {
                setUnsavedSaving(true);
                try {
                  const res = await handleSaveAllChanges();
                  if (!res.ok) {
                    setUnsavedSaveFailed(true);
                    return;
                  }

                  const action = pendingActionRef.current;
                  setUnsavedDialogOpen(false);
                  setUnsavedSaveFailed(false);
                  pendingActionRef.current = null;
                  action?.();
                } finally {
                  setUnsavedSaving(false);
                }
              }}
            >
              {unsavedSaving ? "Speichern…" : "Speichern & fortfahren"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Replace Dialog */}
      <Dialog
        open={confirmReplaceRow !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmReplaceRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soll das Dokument ersetzt werden?</DialogTitle>
            <DialogDescription>Diese Aktion ersetzt den aktuellen Inhalt des Dokuments.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmReplaceRow(null)}>
              nein
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setUploadRow(confirmReplaceRow);
                setConfirmReplaceRow(null);
              }}
            >
              ja
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog
        open={uploadRow !== null}
        onOpenChange={(open) => {
          if (!open || !isReplacing) setUploadRow(open ? uploadRow : null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument ersetzen</DialogTitle>
            <DialogDescription>Legen Sie eine Datei ab oder klicken Sie, um eine neue Datei auszuwählen.</DialogDescription>
          </DialogHeader>
          <ReplacementDropzone
            disabled={isReplacing}
            onFileSelected={async (file) => {
              if (uploadRow === null) return;
              const doc = docs[uploadRow];
              if (!doc?.pid) return;
              setIsReplacing(true);
              const ok = await onReplaceDoc(doc, file);
              setIsReplacing(false);
              if (ok) {
                setUploadRow(null);
              }
            }}
          />
          <div className="flex justify-end">
            <Button variant="ghost" disabled={isReplacing} onClick={() => setUploadRow(null)}>
              Abbrechen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

DocAttributesGrid.displayName = "DocAttributesGrid";

export default DocAttributesGrid;