"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { type IdmDocPreview } from "@/api/idm";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, ChevronRight, Save, Trash2, Link as LinkIcon, Loader2, FileText, CalendarDays } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReplacementDropzone from "@/components/ReplacementDropzone";
import { type CloudEnvironment } from "@/authorization/configLoader";
import { getIdmEntityAttributes } from "@/api/idm";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse, isValid } from "date-fns";
import LinkedDocumentsDialog from "@/components/LinkedDocumentsDialog";

type Props = {
  docs: IdmDocPreview[];
  /**
   * Used to reset internal UI state (filters/selection) only when the dataset context changes
   * (e.g. switching to another opportunity), not on silent background refreshes.
   */
  contextKey?: string;
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
};

export type DocAttributesGridHandle = {
  saveAllChanges: () => Promise<{ ok: boolean }>;
  hasUnsavedChanges: () => boolean;
  discardAllChanges: () => void;
};

const DocAttributesGrid = React.forwardRef<DocAttributesGridHandle, Props>(({
  docs,
  contextKey,
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
  const headerCellClass = "px-1 py-1 text-xs font-medium text-muted-foreground border-r border-b border-border bg-muted/30 flex items-center min-h-8";
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
  const baseDisplayColumns = React.useMemo<DisplayColumn[]>(
    () => [
      { kind: "attr", id: "projekt", header: "Projekt", attrNames: ["Projekt"] },
      {
        kind: "meta",
        id: "projektLinks",
        header: "Projekt-Verlinkung",
        getValue: (doc) => {
          const raw = (doc.attributes ?? []).find((a) => a?.name === "Projekt_Verlinkung")?.value ?? "";
          // Im Fetch-Layer trennt ein Semikolon mehrere Werte – für Anzeige schöner mit Kommas
          return raw.replace(/;/g, ", ");
        },
      },
      {
        kind: "meta",
        id: "dokumenttyp",
        header: "Dokumenttyp",
        getValue: (doc) => String(doc.entityName ?? ""),
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
        // Format ISO to 'dd.MM.yyyy, HH:mm:ss'
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
        // Format ISO to 'dd.MM.yyyy, HH:mm:ss'
        getValue: (doc) => {
          const v = doc.lastChangedTS;
          if (!v) return "";
          const d = new Date(v);
          return isNaN(d.getTime()) ? String(v) : format(d, "dd.MM.yyyy, HH:mm:ss");
        },
      },
      { kind: "attr", id: "ort", header: "Ort", attrNames: ["Ort", "Werk"] },
    ],
    []
  );

  // Fixed column order (always rendered, even if values are missing)
  const displayColumns = React.useMemo<DisplayColumn[]>(
    () => (hideProjectColumn ? baseDisplayColumns.filter((c) => c.id !== "projekt") : baseDisplayColumns),
    [baseDisplayColumns, hideProjectColumn]
  );

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

  const getEntityLabel = React.useCallback(
    (entityName: string) => {
      const opt = entityOptions?.find((o) => o.name === entityName);
      const desc = (opt?.desc || opt?.name || entityName).toString();
      return desc.replace(/^\*/, "").trim();
    },
    [entityOptions]
  );

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
    const px = Math.round(maxLen * 7 + 44);
    return Math.min(220, Math.max(96, px));
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
    }),
    [enableSaveAllButton, handleSaveAllChanges, initial, initialDocTypes]
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

  // Track selected rows
  const [selectedRows, setSelectedRows] = React.useState<Set<number>>(new Set());
  React.useEffect(() => {
    // Clear selection only when context changes to avoid flicker on silent background refreshes
    setSelectedRows(new Set());
  }, [contextKey]);

  const toggleRowSelected = (idx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

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

  const openNoteEditor = (idx: number) => {
    const current = edited[idx]?.["Anmerkung"] ?? initial[idx]?.["Anmerkung"] ?? "";
    setNoteEditorRow(idx);
    noteEditorDraftRef.current = String(current);
  };

  // Columns: (NEW) Note Editor (30) | Details (30) | Select (30) | Save (30) | Replace (30) | Linked Docs (30) | Data Columns | Delete (30)
  const gridTemplate = React.useMemo(() => {
    // CHANGED ORDER: detail | select | save | replace | linked | note
    const fixed = ["30px", "30px", "30px", "30px", "30px", "30px"]; // detail | select | save | replace | linked | note
    const dataCols = displayColumns.map((c) => {
      if (maxDataColumnWidthPx) return `minmax(0px, ${maxDataColumnWidthPx}px)`;
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
    <div className="w-full">
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
        <div className="w-full overflow-x-auto">
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="grid w-max min-w-full" style={{ gridTemplateColumns: gridTemplate }}>
              {/* Header */}
              {/* ADD one more empty header cell for the note editor column */}
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
              {/* ADD one more empty filter cell for the note editor column */}
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
                    const effectiveEntityName = editedDocTypes[idx] ?? doc.entityName ?? "";
                    const defs = attrDefsByEntity[effectiveEntityName] || {};

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
                            disabled={!doc.pid || isLockedByStatus}
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
                            disabled={!doc.pid || isLockedByStatus}
                            onClick={() => runWithUnsavedGuard(() => setConfirmReplaceRow(idx))}
                            title={isLockedByStatus ? "Dokument ist freigegeben" : "Dokument ersetzen"}
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
                              trigger={({ setOpen }) => (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-violet-600 hover:text-violet-700"
                                  onClick={() => runWithUnsavedGuard(() => setOpen(true))}
                                  title="Verlinkte Dokumente anzeigen"
                                  aria-label="Verlinkte Dokumente anzeigen"
                                >
                                  <LinkIcon className="h-3 w-3" />
                                </Button>
                              )}
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

                        {/* MOVED: Note Editor Button (now after Linked Docs) */}
                        <div className={cn(iconCellClass, isHighlighted && rowHighlightClass)}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={!doc.pid}
                            onClick={() => openNoteEditor(idx)}
                            title="Anmerkung bearbeiten"
                            aria-label="Anmerkung bearbeiten"
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Data columns */}
                        {displayColumns.map((col) => {
                          if (col.kind === "meta") {
                            // Render a badge for linked docs inside the Dokumentname cell
                            if (col.id === "dokumentname") {
                              const value = col.getValue(doc);
                              return (
                                <div
                                  key={`${idx}-${col.id}`}
                                  className={cn(gridCellClass, "flex items-center gap-2", isHighlighted && rowHighlightClass)}
                                >
                                  <div className="truncate text-xs text-foreground">{value || ""}</div>
                                  {doc.linkedViaProject ? (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                      verlinkt
                                    </Badge>
                                  ) : null}
                                </div>
                              );
                            }

                            if (col.id === "dokumenttyp") {
                              const value = col.getValue(doc);
                              return (
                                <div key={`${idx}-${col.id}`} className={cn(gridCellClass, "flex items-center", isHighlighted && rowHighlightClass)}>
                                  <div className="truncate text-xs text-foreground">{value || ""}</div>
                                </div>
                              );
                            }

                            const value = col.getValue(doc);
                            return (
                              <div key={`${idx}-${col.id}`} className={cn(gridCellClass, "flex items-center", isHighlighted && rowHighlightClass)}>
                                <div className="truncate text-xs text-foreground">{value || ""}</div>
                              </div>
                            );
                          }

                          const attrName = resolveAttrName(rowEdited, rowInitial, defs, col);
                          const hasError = (errorHighlights[idx] ?? []).includes(attrName);
                          const hasSuccess = (successHighlights[idx] ?? []).includes(attrName);
                          const def = defs[attrName];
                          const isDate = col.forceDate || def?.type === "7" || attrName === "Belegdatum";

                          const isStatusCol = col.id === "status";
                          const isEditDisabled = isLockedByStatus && !isStatusCol;

                          const statusLabel = isStatusCol
                            ? (def?.valueset?.find((vs) => vs.name === (rowEdited[attrName] ?? ""))
                                ?.desc ?? 
                                (rowEdited[attrName] ?? ""))
                            : "";
                          const statusClass =
                            isStatusCol && (rowEdited[attrName] ?? "")
                              ? statusLabel === "Freigegeben"
                                ? "bg-green-600 text-white border-green-600 hover:bg-green-600"
                                : "bg-red-600 text-white border-red-600 hover:bg-red-600"
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
                                    className={cn(
                                      "h-6 w-full min-w-0 text-xs px-1 rounded-none",
                                      statusClass,
                                      isEditDisabled && "opacity-60",
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
                                    {def.valueset.map((vs) => (
                                      <SelectItem key={vs.name} value={vs.name}>
                                        {vs.desc || vs.name}
                                      </SelectItem>
                                    ))}
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
                                              "h-6 w-full min-w-0 text-xs px-1 pr-7 rounded-none",
                                              isEditDisabled && "opacity-60",
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
                                              isEditDisabled && "pointer-events-none opacity-60"
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
                                  onChange={(e) =>
                                    setEdited((prev) => {
                                      const row = { ...(prev[idx] ?? {}) };
                                      row[attrName] = e.target.value;
                                      return { ...prev, [idx]: row };
                                    })
                                  }
                                  className={cn(
                                    "h-6 w-full min-w-0 text-xs px-1 rounded-none",
                                    isEditDisabled && "opacity-60",
                                    hasError &&
                                      !hasSuccess &&
                                      "border-red-500 ring-2 ring-red-500 animate-[error-blink_0.9s_ease-in-out_2]",
                                    hasSuccess &&
                                      !hasError &&
                                      "border-success-highlight ring-2 ring-success-highlight animate-[success-blink_0.9s_ease-in-out_2]"
                                  )}
                                />
                              )}
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
                            disabled={!doc.pid || isLockedByStatus}
                            onClick={() => runWithUnsavedGuard(() => setConfirmDeleteRow(idx))}
                            title={isLockedByStatus ? "Dokument ist freigegeben" : "Dokument löschen"}
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
              onClick={() => {
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
                  pendingActionRef.current = null;
                  setUnsavedSaveFailed(false);
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