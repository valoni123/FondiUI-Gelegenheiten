"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { type IdmDocPreview } from "@/api/idm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, ChevronRight, Save, Trash2, Link as LinkIcon } from "lucide-react";
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
import { getIdmEntityAttributes } from "@/api/idm";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import LinkedDocumentsDialog from "@/components/LinkedDocumentsDialog";

type Props = {
  docs: IdmDocPreview[];
  onOpenFullPreview: (doc: IdmDocPreview, onUpdate: (updatedDoc: IdmDocPreview) => void) => void;
  onSaveRow: (doc: IdmDocPreview, updates: { name: string; value: string }[]) => Promise<{ ok: boolean; errorAttributes?: string[] }>; 
  onReplaceDoc: (doc: IdmDocPreview, file: File) => Promise<boolean>;
  hideSaveAllButton?: boolean; // New prop
  title?: string;
  onDeleteDoc: (doc: IdmDocPreview) => Promise<boolean>;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
};

const DocAttributesGrid: React.FC<Props> = ({
  docs,
  onOpenFullPreview,
  onSaveRow,
  onReplaceDoc,
  hideSaveAllButton,
  title,
  onDeleteDoc,
  authToken,
  cloudEnvironment,
}) => {
  type DisplayColumn =
    | {
        kind: "attr";
        id: string;
        header: string;
        // attribute names to try (first match wins; fallback to first)
        attrNames: string[];
        // optional: treat as date
        forceDate?: boolean;
      }
    | {
        kind: "meta";
        id: string;
        header: string;
        getValue: (doc: IdmDocPreview) => string;
      };

  const getAttrValue = React.useCallback(
    (doc: IdmDocPreview, attrNames: string[]) => {
      const attrs = doc.attributes ?? [];
      for (const n of attrNames) {
        const found = attrs.find((a) => a?.name === n);
        if (found?.value != null && String(found.value).length > 0) return String(found.value);
      }
      return "";
    },
    []
  );

  // Fixed column order (always rendered, even if values are missing)
  const displayColumns = React.useMemo<DisplayColumn[]>(
    () => [
      { kind: "attr", id: "projekt", header: "Projekt", attrNames: ["Projekt"] },
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
      {
        kind: "attr",
        id: "belegnr",
        header: "Belegnr.",
        attrNames: ["Belegnummer"],
      },
      {
        kind: "meta",
        id: "createdBy",
        header: "erstellt von",
        getValue: (doc) =>
          getAttrValue(doc, [
            "erstellt von",
            "Erstellt von",
            "Ersteller",
            "CreatedBy",
            "createdBy",
            "creator",
          ]),
      },
      {
        kind: "meta",
        id: "createdAt",
        header: "erstellt am",
        getValue: (doc) =>
          getAttrValue(doc, [
            "erstellt am",
            "Erstellt am",
            "Erstellzeit",
            "CreatedAt",
            "createdAt",
            "created",
          ]),
      },
      {
        kind: "meta",
        id: "changedBy",
        header: "geändert von",
        getValue: (doc) =>
          getAttrValue(doc, [
            "geändert von",
            "Geändert von",
            "Geaendert von",
            "ModifiedBy",
            "modifiedBy",
            "modifier",
          ]),
      },
      {
        kind: "meta",
        id: "changedAt",
        header: "geändert am",
        getValue: (doc) =>
          getAttrValue(doc, [
            "geändert am",
            "Geändert am",
            "Geaendert am",
            "ModifiedAt",
            "modifiedAt",
            "modified",
            "updated",
          ]),
      },
      {
        kind: "attr",
        id: "ort",
        header: "Ort",
        // some entities use "Werk" for location
        attrNames: ["Ort", "Werk"],
      },
    ],
    [getAttrValue]
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
  const [attrDefsByEntity, setAttrDefsByEntity] = React.useState<Record<string, Record<string, { valueset?: { name: string; desc: string }[]; type?: string }>>>({});

  // Load attribute definitions for each entity present in docs (only missing ones)
  React.useEffect(() => {
    const entityNames = Array.from(new Set((docs.map((d) => d.entityName).filter(Boolean) as string[])));
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
  }, [docs, authToken, cloudEnvironment, attrDefsByEntity]);

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

  // Calculate how many rows have changes (only editable columns)
  const changedRowCount = React.useMemo(() => {
    let count = 0;
    docs.forEach((doc, idx) => {
      const rowEdited = edited[idx] ?? {};
      const rowInitial = initial[idx] ?? {};
      const entityName = doc.entityName || "";
      const defs = attrDefsByEntity[entityName] || {};

      const rowHasChanges = editableColumns.some((c) => {
        const attrName = resolveAttrName(rowEdited, rowInitial, defs, c);
        return (rowEdited[attrName] ?? "") !== (rowInitial[attrName] ?? "");
      });

      if (rowHasChanges) count++;
    });
    return count;
  }, [docs, edited, initial, editableColumns, attrDefsByEntity, resolveAttrName]);

  const enableSaveAllButton = changedRowCount > 0; // Enable if any row has changes

  const handleSaveAllChanges = async () => {
    const successfulSaves: number[] = [];
    const successfulUpdates: { rowIdx: number; cols: string[] }[] = [];

    for (let idx = 0; idx < docs.length; idx++) {
      const doc = docs[idx];
      const rowEdited = edited[idx] ?? {};
      const rowInitial = initial[idx] ?? {};
      const entityName = doc.entityName || "";
      const defs = attrDefsByEntity[entityName] || {};

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

      if (updates.length && doc.pid) {
        try {
          const res = await onSaveRow(doc, updates);
          if (res.ok) {
            successfulSaves.push(idx);
            successfulUpdates.push({ rowIdx: idx, cols: updates.map((u) => u.name) });
          } else {
            const colsToFlash = res.errorAttributes?.length
              ? res.errorAttributes
              : updates.map((u) => u.name);
            flashError(idx, colsToFlash);
          }
        } catch {
          flashError(idx, updates.map((u) => u.name));
        }
      }
    }

    // Flash success for all successful updates
    successfulUpdates.forEach(({ rowIdx, cols }) => {
      flashSuccess(rowIdx, cols);
    });

    // Nur erfolgreich gespeicherte Zeilen zurücksetzen und für spätere initial-Updates markieren
    setEdited((prev) => {
      const newEdited = { ...prev };
      successfulSaves.forEach((idx) => {
        newEdited[idx] = { ...initial[idx] };
      });
      return newEdited;
    });
    if (successfulSaves.length) {
      setSyncWithInitial((prev) => {
        const next = new Set(prev);
        successfulSaves.forEach((idx) => next.add(idx));
        return next;
      });
    }
  };

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
    // Clear selection whenever docs change to avoid index mismatch after reloads
    setSelectedRows(new Set());
  }, [docs]);

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

  // Columns: Details (30) | Select (30) | Save (30) | Replace (30) | Linked Docs (30) | Data Columns | Delete (30)
  // Use minmax(..., fr) so the grid always expands to use the full available width.
  const gridTemplate = React.useMemo(() => {
    const fixed = ["30px", "30px", "30px", "30px", "30px"]; // icon/button columns

    const dataCols = displayColumns.map((c) => {
      if (c.id === "dokumentname") return "minmax(220px, 2fr)";
      if (c.id === "titel") return "minmax(180px, 2fr)";
      if (c.id === "projekt") return "minmax(140px, 1.2fr)";
      return "minmax(120px, 1fr)";
    });

    const tail = "30px"; // delete
    return [...fixed, ...dataCols, tail].join(" ");
  }, [displayColumns]);

  // IMPORTANT: don't return early before hooks (React Rules of Hooks)
  if (!docs.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine Dokumente gefunden.
      </div>
    );
  }

  return (
    <div className="w-full">
      {(title || !hideSaveAllButton) && (
        <div className="mb-2 flex items-center justify-between gap-3 pr-4">
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
        {/* Use native horizontal scrolling so the scrollbar becomes visible when the table is wider than the viewport */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-max pr-4">
            {/* Header */}
            <div
              className="grid gap-1 border-b py-2 text-xs font-medium text-muted-foreground"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className="px-2"></div> {/* Button: Details */}
              <div className="px-2"></div> {/* Checkbox: Select */}
              <div className="px-2"></div> {/* Button: Save */}
              <div className="px-2"></div> {/* Button: Replace */}
              <div className="px-2"></div> {/* Button: Linked Docs */}
              {displayColumns.map((col) => (
                <div key={col.id} className="px-2">
                  {col.header}
                </div>
              ))}
              <div className="px-2"></div> {/* Button: Delete */}
            </div>

            {/* Rows */}
            <div className="divide-y">
              {docs.map((doc, idx) => {
                const rowEdited = edited[idx] ?? {};
                const rowInitial = initial[idx] ?? {};
                const entityName = doc.entityName || "";
                const defs = attrDefsByEntity[entityName] || {};

                const hasChanges = editableColumns.some((c) => {
                  const attrName = resolveAttrName(rowEdited, rowInitial, defs, c);
                  return (rowEdited[attrName] ?? "") !== (rowInitial[attrName] ?? "");
                });

                return (
                  <div
                    key={`${doc.entityName || "doc"}-${doc.filename || idx}-${idx}`}
                    className="grid items-center gap-1 py-2"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {/* Detail Button */}
                    <div className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          onOpenFullPreview(doc, (updatedDoc) => {
                            // This callback will be called when the DetailDialog saves changes
                            console.log("Doc updated from DetailDialog:", updatedDoc);
                          })
                        }
                        title="Details anzeigen"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Select Checkbox */}
                    <div className="px-2">
                      <Checkbox
                        checked={selectedRows.has(idx)}
                        onCheckedChange={() => toggleRowSelected(idx)}
                        className="h-4 w-4"
                        disabled={!doc.pid}
                        aria-label="Dokument auswählen"
                      />
                    </div>

                    {/* Save Button */}
                    <div className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6",
                          hasChanges && "bg-orange-500 hover:bg-orange-600 text-white"
                        )}
                        disabled={!hasChanges || !doc.pid}
                        onClick={async () => {
                          const updates = editableColumns
                            .map((c) => {
                              const attrName = resolveAttrName(rowEdited, rowInitial, defs, c);
                              return {
                                name: attrName,
                                value: rowEdited[attrName] ?? "",
                                changed:
                                  (rowEdited[attrName] ?? "") !== (rowInitial[attrName] ?? ""),
                              };
                            })
                            .filter((u) => u.changed)
                            .map((u) => ({ name: u.name, value: u.value }));

                          if (updates.length) {
                            const res = await onSaveRow(doc, updates);
                            if (res.ok) {
                              setEdited((prev) => ({ ...prev, [idx]: { ...rowInitial } }));
                              setSyncWithInitial((prev) => {
                                const next = new Set(prev);
                                next.add(idx);
                                return next;
                              });
                              // Flash success for the saved columns
                              flashSuccess(idx, updates.map((u) => u.name));
                            } else {
                              const colsToFlash = res.errorAttributes?.length
                                ? res.errorAttributes
                                : updates.map((u) => u.name);
                              flashError(idx, colsToFlash);
                            }
                          }
                        }}
                        title={
                          doc.pid
                            ? hasChanges
                              ? "Änderungen speichern"
                              : "Keine Änderungen"
                            : "PID fehlt – Speichern nicht möglich"
                        }
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Replace Button */}
                    <div className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={!doc.pid}
                        onClick={() => setConfirmReplaceRow(idx)}
                        title="Dokument ersetzen"
                        aria-label="Dokument ersetzen"
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Linked Documents Button */}
                    <div className="px-2">
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
                              onClick={() => setOpen(true)}
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

                    {/* Data columns */}
                    {displayColumns.map((col) => {
                      if (col.kind === "meta") {
                        const value = col.getValue(doc);
                        return (
                          <div key={`${idx}-${col.id}`} className="px-2">
                            <div className="truncate text-[10px] text-foreground">{value || ""}</div>
                          </div>
                        );
                      }

                      const attrName = resolveAttrName(rowEdited, rowInitial, defs, col);
                      const hasError = (errorHighlights[idx] ?? []).includes(attrName);
                      const hasSuccess = (successHighlights[idx] ?? []).includes(attrName);
                      const def = defs[attrName];
                      const isDate = col.forceDate || def?.type === "7" || attrName === "Belegdatum";

                      const isStatusCol = col.id === "status";
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
                        <div key={`${idx}-${col.id}`} className="px-2">
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
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-6 text-[10px] px-1",
                                  statusClass,
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
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-6 w-full justify-start text-left text-[10px] px-1",
                                    hasError &&
                                      !hasSuccess &&
                                      "border-red-500 ring-2 ring-red-500 animate-[error-blink_0.9s_ease-in-out_2]",
                                    hasSuccess &&
                                      !hasError &&
                                      "border-success-highlight ring-2 ring-success-highlight animate-[success-blink_0.9s_ease-in-out_2]"
                                  )}
                                >
                                  {rowEdited[attrName]
                                    ? format(
                                        parse(rowEdited[attrName], "yyyy-MM-dd", new Date()),
                                        "dd.MM.yyyy"
                                      )
                                    : "Datum wählen"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={
                                    rowEdited[attrName]
                                      ? parse(rowEdited[attrName], "yyyy-MM-dd", new Date())
                                      : undefined
                                  }
                                  onSelect={(date) =>
                                    setEdited((prev) => {
                                      const row = { ...(prev[idx] ?? {}) };
                                      row[attrName] = date ? format(date, "yyyy-MM-dd") : "";
                                      return { ...prev, [idx]: row };
                                    })
                                  }
                                />
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Input
                              value={rowEdited[attrName] ?? ""}
                              onChange={(e) =>
                                setEdited((prev) => {
                                  const row = { ...(prev[idx] ?? {}) };
                                  row[attrName] = e.target.value;
                                  return { ...prev, [idx]: row };
                                })
                              }
                              className={cn(
                                "h-6 text-[10px] px-1",
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
                    <div className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        disabled={!doc.pid}
                        onClick={() => setConfirmDeleteRow(idx)}
                        title="Dokument löschen"
                        aria-label="Dokument löschen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </TooltipProvider>

      {/* Confirm Delete Dialog */}
      <Dialog
        open={confirmDeleteRow !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soll das Dokument wirklich gelöscht werden?</DialogTitle>
            <DialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteRow(null)}>
              nein
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
              ja
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Batch Delete Dialog */}
      <Dialog
        open={confirmBatchDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmBatchDelete(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sollen wirklich alle ausgewählten Dokumente gelöscht werden?</DialogTitle>
            <DialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmBatchDelete(false)}>
              nein
            </Button>
            <Button
              variant="destructive"
              onClick={executeBatchDelete}
            >
              ja
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
};

export default DocAttributesGrid;