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
import { ChevronRight, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import ArrowOverlay from "@/components/ArrowOverlay";

type Props = {
  docs: IdmDocPreview[];
  onOpenFullPreview: (doc: IdmDocPreview) => void;
  onSaveRow: (doc: IdmDocPreview, updates: { name: string; value: string }[]) => Promise<{ ok: boolean; errorAttributes?: string[] }>;
};

const DocAttributesGrid: React.FC<Props> = ({ docs, onOpenFullPreview, onSaveRow }) => {
  const columns = React.useMemo<string[]>(() => {
    const names = new Set<string>();
    for (const d of docs) {
      (d.attributes ?? []).forEach((a) => {
        if (a?.name) names.add(String(a.name));
      });
    }
    // Filter out "Gelegenheit" as requested
    return Array.from(names).filter(col => col !== "Gelegenheit" && col !== "MDS_ID");
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

  // NEW: Fehler-Highlights pro Zeile/Spalte
  const [errorHighlights, setErrorHighlights] = React.useState<Record<number, string[]>>({});

  // NEW: Refs zu jedem Input-Wrapper und Overlay-Zustand
  const inputRefs = React.useRef<Record<number, Record<string, HTMLDivElement | null>>>({});
  const [overlayTarget, setOverlayTarget] = React.useState<DOMRect | null>(null);
  const [overlayKey, setOverlayKey] = React.useState<number>(0);

  const flashError = React.useCallback((rowIdx: number, cols: string[]) => {
    if (!cols.length) return;
    setErrorHighlights((prev) => {
      const next = { ...prev };
      const current = new Set(next[rowIdx] ?? []);
      cols.forEach((c) => current.add(c));
      next[rowIdx] = Array.from(current);
      return next;
    });

    // Bestimme das erste fehlerhafte Feld für den langen Pfeil (ausgehend von Toast unten rechts)
    const firstCol = cols[0];
    const el = inputRefs.current[rowIdx]?.[firstCol] ?? null;
    if (el) {
      setOverlayTarget(el.getBoundingClientRect());
      setOverlayKey((k) => k + 1); // re-mount für erneute Animation
    }

    // Entferne Highlight und Overlay nach kurzer Zeit (~1.8s)
    setTimeout(() => {
      setErrorHighlights((prev) => {
        const next = { ...prev };
        const current = new Set(next[rowIdx] ?? []);
        cols.forEach((c) => current.delete(c));
        next[rowIdx] = Array.from(current);
        if (!next[rowIdx]?.length) delete next[rowIdx];
        return next;
      });
      setOverlayTarget(null);
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

  const enableSaveAllButton = changedRowCount > 1; // Enable if more than one row has changes

  const handleSaveAllChanges = async () => {
    const successfulSaves: number[] = [];
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
        const res = await onSaveRow(doc, updates);
        if (res.ok) {
          successfulSaves.push(idx);
        } else {
          const colsToFlash = res.errorAttributes?.length
            ? res.errorAttributes
            : updates.map((u) => u.name);
          flashError(idx, colsToFlash);
        }
      }
    }
    // Nach allen Saves: erfolgreich gespeicherte Zeilen zurücksetzen
    setEdited((prev) => {
      const newEdited = { ...prev };
      successfulSaves.forEach((idx) => {
        newEdited[idx] = { ...initial[idx] };
      });
      return newEdited;
    });
  };

  if (!docs.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Keine Dokumente gefunden.
      </div>
    );
  }

  // Spaltenbreiten: erste 30px für Pfeil, zweite 30px für Save, dann 160px für Dokumenttyp/Name, rest Attributspalten
  const gridTemplate =
    `30px 30px 160px ` + (columns.length ? columns.map(() => "100px").join(" ") : "");

  return (
    <div className="h-full w-full">
      {/* Overlay-Pfeil von Toast unten rechts zum Ziel-Feld */}
      {overlayTarget ? <ArrowOverlay key={overlayKey} targetRect={overlayTarget} /> : null}

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
              <div className="px-2">Dokumenttyp / Name</div>
              {columns.map((col) => (
                <div key={col} className="px-2">{col}</div>
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
                            } else {
                              const colsToFlash = res.errorAttributes?.length
                                ? res.errorAttributes
                                : updates.map((u) => u.name);
                              flashError(idx, colsToFlash);
                            }
                          }
                        }}
                        title={doc.pid ? (hasChanges ? "Änderungen speichern" : "Keine Änderungen") : "PID fehlt – Speichern nicht möglich"}
                      >
                        <Save className="h-3 w-3" />
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
                      <div
                        key={`${idx}-${col}`}
                        className="px-2 relative overflow-visible"
                        ref={(el) => {
                          if (!inputRefs.current[idx]) inputRefs.current[idx] = {};
                          inputRefs.current[idx][col] = el;
                        }}
                      >
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

                        {(errorHighlights[idx] ?? []).includes(col) && (
                          <div className="pointer-events-none absolute left-[calc(100%+4px)] top-1/2 -translate-y-1/2 z-10">
                            <svg width="80" height="50" viewBox="0 0 80 50" fill="none" aria-hidden="true">
                              <path
                                d="M75 35 C 65 25, 50 20, 10 18"
                                stroke="#ef4444"
                                strokeWidth="4"
                                strokeLinecap="round"
                                fill="none"
                                style={{ strokeDasharray: 150, strokeDashoffset: 150 }}
                                className="animate-[arrow-draw_0.6s_ease-out_forwards]"
                              />
                              <path
                                d="M10 18 L20 13 M10 18 L20 23"
                                stroke="#ef4444"
                                strokeWidth="4"
                                strokeLinecap="round"
                                fill="none"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </TooltipProvider>
    </div>
  );
};

export default DocAttributesGrid;