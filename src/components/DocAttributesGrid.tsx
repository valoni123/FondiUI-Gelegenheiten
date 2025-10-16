"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { type IdmDocPreview } from "@/api/idm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, ChevronRight, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReplacementDropzone from "@/components/ReplacementDropzone";

type Props = {
  docs: IdmDocPreview[];
  onOpenFullPreview: (doc: IdmDocPreview) => void;
  onSaveRow: (doc: IdmDocPreview, updates: { name: string; value: string }[]) => Promise<{ ok: boolean; errorAttributes?: string[] }>;
  onReplaceDoc: (doc: IdmDocPreview, file: File) => Promise<boolean>;
  hideSaveAllButton?: boolean; // New prop
};

const DocAttributesGrid: React.FC<Props> = ({ docs, onOpenFullPreview, onSaveRow, onReplaceDoc, hideSaveAllButton }) => {
  const columns = React.useMemo<string[]>(() => {
    const names = new Set<string>();
    for (const d of docs) {
      (d.attributes ?? []).forEach((a) => {
        if (a?.name) names.add(String(a.name));
      });
    }
    // Filter out "Gelegenheit" and "MDS_ID"
    return Array.from(names).filter((col) => col !== "Gelegenheit" && col !== "MDS_ID");
  }, [docs]);

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

  // Fehler-Highlights pro Zeile/Spalte (kurzes Blink-Highlight)
  const [errorHighlights, setErrorHighlights] = React.useState<Record<number, string[]>>({});

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

  // Calculate how many rows have changes
  const changedRowCount = React.useMemo(() => {
    let count = 0;
    docs.forEach((doc, idx) => {
      const rowEdited = edited[idx] ?? {};
      const rowInitial = initial[idx] ?? {};
      const rowHasChanges = columns.some(
        (col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? "")
      );
      if (rowHasChanges) {
        count++;
      }
    });
    return count;
  }, [docs, edited, initial, columns]);

  const enableSaveAllButton = changedRowCount > 0; // Enable if any row has changes

  const handleSaveAllChanges = async () => {
    const successfulSaves: number[] = [];
    const failedRows: number[] = [];
    
    for (let idx = 0; idx < docs.length; idx++) {
      const doc = docs[idx];
      const rowEdited = edited[idx] ?? {};
      const rowInitial = initial[idx] ?? {};
      const hasChanges = columns.some(
        (col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? "")
      );

      if (hasChanges && doc.pid) {
        const updates = columns
          .filter((col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? ""))
          .map((col) => ({ name: col, value: rowEdited[col] ?? "" }));
        
        try {
          const res = await onSaveRow(doc, updates);
          if (res.ok) {
            successfulSaves.push(idx);
          } else {
            failedRows.push(idx);
            const colsToFlash = res.errorAttributes?.length
              ? res.errorAttributes
              : updates.map((u) => u.name);
            flashError(idx, colsToFlash);
          }
        } catch (error) {
          failedRows.push(idx);
          const colsToFlash = updates.map((u) => u.name);
          flashError(idx, colsToFlash);
        }
      }
    }
    
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

  if (!docs.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine Dokumente gefunden.
      </div>
    );
  }

  // Spaltenbreiten: 30px Details, 30px Save, 30px Replace, 160px Dokumenttyp, rest Attribute
  const gridTemplate =
    `30px 30px 30px 160px ` + (columns.length ? columns.map(() => "100px").join(" ") : "");

  return (
    <div className="h-full w-full">
      {!hideSaveAllButton && ( // Conditional rendering based on new prop
        <div className="flex justify-end mb-2 pr-4">
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
        <ScrollArea className="h-full w-full">
          <div className="pr-4">
            {/* Header */}
            <div
              className="grid gap-1 border-b py-2 text-xs font-medium text-muted-foreground"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className="px-2"></div> {/* Button: Details */}
              <div className="px-2"></div> {/* Button: Save */}
              <div className="px-2"></div> {/* Button: Replace */}
              <div className="px-2">Dokumenttyp / Name</div>
              {columns.map((col) => (
                <div key={col} className="px-2">
                  {col}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y">
              {docs.map((doc, idx) => {
                const rowEdited = edited[idx] ?? {};
                const rowInitial = initial[idx] ?? {};
                const hasChanges = columns.some(
                  (col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? "")
                );

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
                        onClick={() => onOpenFullPreview(doc)}
                        title="Details anzeigen"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
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
                          const updates = columns
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

                    {/* Dokumenttyp */}
                    <div className="px-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-block">
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal cursor-help"
                            >
                              {doc.entityName || "Entity"}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start">
                          <p className="text-xs">{doc.filename || "Dokument"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Attribute inputs */}
                    {columns.map((col) => (
                      <div key={`${idx}-${col}`} className="px-2">
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
                            (errorHighlights[idx] ?? []).includes(col) &&
                              "border-red-500 ring-2 ring-red-500 animate-[error-blink_0.9s_ease-in-out_2]"
                          )}
                          aria-label={`Attribut ${col}`}
                          placeholder="-"
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </TooltipProvider>

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