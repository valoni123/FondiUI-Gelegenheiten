"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { type IdmDocPreview } from "@/api/idm";
import { TooltipProvider } from "@/components/ui/tooltip";

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
  onDeleteDoc: (doc: IdmDocPreview) => Promise<boolean>;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
};

const DocAttributesGrid: React.FC<Props> = ({ docs, onOpenFullPreview, onSaveRow, onReplaceDoc, hideSaveAllButton, onDeleteDoc, authToken, cloudEnvironment }) => {
  const allAttributeNames = React.useMemo<string[]>(() => {
    const names = new Set<string>();
    for (const d of docs) {
      (d.attributes ?? []).forEach((a) => {
        if (a?.name) names.add(String(a.name));
      });
    }
    // Filter out "Gelegenheit" and "MDS_ID"
    return Array.from(names).filter((col) => col !== "Gelegenheit" && col !== "MDS_ID");
  }, [docs]);

  const preferredAttributeOrder = React.useMemo<string[]>(
    () => [
      "Projekt",
      "Dokumentenpaket",
      "Titel",
      "Status",
      "Belegdatum",
      "Belegnummer",
      "Ort",
    ],
    []
  );

  const attributeColumns = React.useMemo<string[]>(() => {
    const picked = preferredAttributeOrder.filter((c) => allAttributeNames.includes(c));
    const rest = allAttributeNames
      .filter((c) => !preferredAttributeOrder.includes(c))
      .sort((a, b) => a.localeCompare(b, "de"));
    return [...picked, ...rest];
  }, [allAttributeNames, preferredAttributeOrder]);

  type DisplayColumn =
    | { key: "Projekt"; kind: "attr"; label: string }
    | { key: "Dokumenttyp"; kind: "doc"; label: string }
    | { key: "Dokumentenpaket"; kind: "attr"; label: string }
    | { key: "Dokumentname"; kind: "doc"; label: string }
    | { key: "Titel"; kind: "attr"; label: string }
    | { key: "Status"; kind: "attr"; label: string }
    | { key: "Belegdatum"; kind: "attr"; label: string }
    | { key: "Belegnummer"; kind: "attr"; label: string }
    | { key: "ErstelltVon"; kind: "meta"; label: string }
    | { key: "ErstelltAm"; kind: "meta"; label: string }
    | { key: "GeaendertVon"; kind: "meta"; label: string }
    | { key: "GeaendertAm"; kind: "meta"; label: string }
    | { key: "Ort"; kind: "attr"; label: string }
    | { key: string; kind: "attr"; label: string };

  const displayColumns = React.useMemo<DisplayColumn[]>(() => {
    const base: DisplayColumn[] = [
      { key: "Projekt", kind: "attr", label: "Projekt" },
      { key: "Dokumenttyp", kind: "doc", label: "Dokumenttyp" },
      { key: "Dokumentenpaket", kind: "attr", label: "Dokumentenpaket" },
      { key: "Dokumentname", kind: "doc", label: "Dokumentname" },
      { key: "Titel", kind: "attr", label: "Titel" },
      { key: "Status", kind: "attr", label: "Status" },
      { key: "Belegdatum", kind: "attr", label: "Belegdatum" },
      { key: "Belegnummer", kind: "attr", label: "Belegnr." },
      { key: "ErstelltVon", kind: "meta", label: "Erstellt von" },
      { key: "ErstelltAm", kind: "meta", label: "Erstellt am" },
      { key: "GeaendertVon", kind: "meta", label: "Geändert von" },
      { key: "GeaendertAm", kind: "meta", label: "Geändert am" },
      { key: "Ort", kind: "attr", label: "Ort" },
    ];

    const baseAttrKeys = new Set(
      base.filter((c) => c.kind === "attr").map((c) => c.key)
    );

    const extras = attributeColumns
      .filter((k) => !baseAttrKeys.has(k))
      .map((k) => ({ key: k, kind: "attr", label: k } as DisplayColumn));

    return [...base, ...extras];
  }, [attributeColumns]);

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

  // Calculate how many rows have changes
  const changedRowCount = React.useMemo(() => {
    let count = 0;
    docs.forEach((doc, idx) => {
      const rowEdited = edited[idx] ?? {};
      const rowInitial = initial[idx] ?? {};
      const rowHasChanges = attributeColumns.some(
        (col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? "")
      );
      if (rowHasChanges) {
        count++;
      }
    });
    return count;
  }, [docs, edited, initial, attributeColumns]);

  const enableSaveAllButton = changedRowCount > 0; // Enable if any row has changes

  const handleSaveAllChanges = async () => {
    const successfulSaves: number[] = [];
    const failedRows: number[] = [];
    const successfulUpdates: { rowIdx: number; cols: string[] }[] = [];

    for (let idx = 0; idx < docs.length; idx++) {
      const doc = docs[idx];
      const rowEdited = edited[idx] ?? {};
      const rowInitial = initial[idx] ?? {};
      const hasChanges = attributeColumns.some(
        (col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? "")
      );

      if (hasChanges && doc.pid) {
        const updates = attributeColumns
          .filter((col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? ""))
          .map((col) => ({ name: col, value: rowEdited[col] ?? "" }));

        try {
          const res = await onSaveRow(doc, updates);
          if (res.ok) {
            successfulSaves.push(idx);
            successfulUpdates.push({ rowIdx: idx, cols: updates.map((u) => u.name) });
          } else {
            failedRows.push(idx);
            const colsToFlash = res.errorAttributes?.length
              ? res.errorAttributes
              : updates.map((u) => u.name);
            flashError(idx, colsToFlash);
          }
        } catch {
          failedRows.push(idx);
          flashError(idx, updates.map((u) => u.name));
        }
      }
    }

    // Sync successful rows with initial values
    if (successfulSaves.length) {
      setSyncWithInitial((prev) => {
        const next = new Set(prev);
        successfulSaves.forEach((i) => next.add(i));
        return next;
      });
      // Flash success for each saved row/cols
      successfulUpdates.forEach(({ rowIdx, cols }) => flashSuccess(rowIdx, cols));
    }

    // For failures, keep user edits. Any toast is handled by parent.
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

  if (!docs.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine Dokumente gefunden.
      </div>
    );
  }

  // Columns: Details (30) | Select (30) | Save (30) | Replace (30) | Linked (30) | Fields | Delete (30)
  const gridTemplate = React.useMemo(() => {
    const fixed = "30px 30px 30px 30px 30px";
    const fieldWidths = displayColumns
      .map((c) => {
        switch (c.key) {
          case "Projekt":
            return "110px";
          case "Dokumenttyp":
            return "160px";
          case "Dokumentenpaket":
            return "160px";
          case "Dokumentname":
            return "220px";
          case "Titel":
            return "200px";
          case "Status":
            return "130px";
          case "Belegdatum":
            return "130px";
          case "Belegnummer":
            return "130px";
          case "ErstelltVon":
          case "GeaendertVon":
            return "150px";
          case "ErstelltAm":
          case "GeaendertAm":
            return "170px";
          case "Ort":
            return "140px";
          default:
            return "140px";
        }
      })
      .join(" ");

    return `${fixed} ${fieldWidths} 30px`;
  }, [displayColumns]);

  const formatIso = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, "dd.MM.yyyy HH:mm");
  };

  return (
    <div className="h-full w-full">
      {!hideSaveAllButton && (
        <div className="flex justify-end items-center gap-2 mb-2">
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

      <TooltipProvider>
        <div className="w-full overflow-x-auto">
          <div className="min-w-max">
            <div
              className="grid gap-1 border-b py-2 text-xs font-medium text-muted-foreground"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className="px-2"></div> {/* Button: Details */}
              <div className="px-2"></div> {/* Checkbox: Select */}
              <div className="px-2"></div> {/* Button: Save */}
              <div className="px-2"></div> {/* Button: Replace */}
              <div className="px-2"></div> {/* Button: Linked Docs */}

              {displayColumns.map((c) => (
                <div key={c.key} className="px-2">
                  {c.label}
                </div>
              ))}

              <div className="px-2"></div> {/* Button: Delete */}
            </div>

            <div className="divide-y">
              {docs.map((doc, idx) => {
                const rowEdited = edited[idx] ?? {};
                const rowInitial = initial[idx] ?? {};
                const hasChanges = attributeColumns.some(
                  (col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? "")
                );
                const entityName = doc.entityName || "";
                const defs = attrDefsByEntity[entityName] || {};

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
                          onOpenFullPreview(doc, () => {
                            // handled in parent
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
                          const updates = attributeColumns
                            .filter((col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? ""))
                            .map((col) => ({ name: col, value: rowEdited[col] ?? "" }));
                          if (updates.length) {
                            const res = await onSaveRow(doc, updates);
                            if (res.ok) {
                              setEdited((prev) => ({ ...prev, [idx]: { ...rowInitial } }));
                              setSyncWithInitial((prev) => {
                                const next = new Set(prev);
                                next.add(idx);
                                return next;
                              });
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

                    {/* Fields */}
                    {displayColumns.map((colDef) => {
                      if (colDef.kind === "doc" && colDef.key === "Dokumenttyp") {
                        return (
                          <div key={`${idx}-${colDef.key}`} className="px-2">
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {doc.entityName || "-"}
                            </Badge>
                          </div>
                        );
                      }

                      if (colDef.kind === "doc" && colDef.key === "Dokumentname") {
                        return (
                          <div key={`${idx}-${colDef.key}`} className="px-2">
                            <div className="text-[10px] text-muted-foreground truncate" title={doc.filename || ""}>
                              {doc.filename || "-"}
                            </div>
                          </div>
                        );
                      }

                      if (colDef.kind === "meta") {
                        let value = "";
                        if (colDef.key === "ErstelltVon") value = doc.createdByName || doc.createdBy || "";
                        if (colDef.key === "ErstelltAm") value = formatIso(doc.createdTS);
                        if (colDef.key === "GeaendertVon") value = doc.lastModifiedByName || doc.lastModifiedBy || "";
                        if (colDef.key === "GeaendertAm") value = formatIso(doc.lastModifiedTS);
                        return (
                          <div key={`${idx}-${colDef.key}`} className="px-2">
                            <div className="text-[10px] text-muted-foreground truncate" title={value}>
                              {value || "-"}
                            </div>
                          </div>
                        );
                      }

                      // Attribute field
                      const col = colDef.key;
                      const hasError = (errorHighlights[idx] ?? []).includes(col);
                      const hasSuccess = (successHighlights[idx] ?? []).includes(col);
                      const def = defs[col];
                      const isDate = (def?.type === "7") || col === "Belegdatum";

                      return (
                        <div key={`${idx}-${col}`} className="px-2">
                          {def?.valueset && def.valueset.length > 0 ? (
                            <Select
                              value={(rowEdited[col] ?? "") || undefined}
                              onValueChange={(val) =>
                                setEdited((prev) => {
                                  const row = { ...(prev[idx] ?? {}) };
                                  row[col] = val;
                                  return { ...prev, [idx]: row };
                                })
                              }
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-6 text-[10px] px-1",
                                  hasError && !hasSuccess && "border-red-500 ring-2 ring-red-500 animate-[error-blink_0.9s_ease-in-out_2]",
                                  hasSuccess && !hasError && "border-success-highlight ring-2 ring-success-highlight animate-[success-blink_0.9s_ease-in-out_2]"
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
                                    "h-6 w-[120px] justify-start text-left text-[10px] px-1",
                                    hasError && !hasSuccess && "border-red-500 ring-2 ring-red-500 animate-[error-blink_0.9s_ease-in-out_2]",
                                    hasSuccess && !hasError && "border-success-highlight ring-2 ring-success-highlight animate-[success-blink_0.9s_ease-in-out_2]"
                                  )}
                                >
                                  {rowEdited[col]
                                    ? format(parse(rowEdited[col], "yyyy-MM-dd", new Date()), "dd.MM.yyyy")
                                    : "Datum wählen"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={
                                    rowEdited[col]
                                      ? parse(rowEdited[col], "yyyy-MM-dd", new Date())
                                      : undefined
                                  }
                                  onSelect={(date) =>
                                    setEdited((prev) => {
                                      const row = { ...(prev[idx] ?? {}) };
                                      row[col] = date ? format(date, "yyyy-MM-dd") : "";
                                      return { ...prev, [idx]: row };
                                    })
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Input
                              value={rowEdited[col] ?? ""}
                              onChange={(e) =>
                                setEdited((prev) => {
                                  const row = { ...(prev[idx] ?? {}) };
                                  row[col] = e.target.value;
                                  return { ...prev, [idx]: row };
                                })
                              }
                              className={cn(
                                "h-6 text-[10px] px-1",
                                hasError && !hasSuccess && "border-red-500 ring-2 ring-red-500 animate-[error-blink_0.9s_ease-in-out_2]",
                                hasSuccess && !hasError && "border-success-highlight ring-2 ring-success-highlight animate-[success-blink_0.9s_ease-in-out_2]"
                              )}
                              aria-label={`Attribut ${col}`}
                              placeholder="-"
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Delete button */}
                    <div className="px-2 flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
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