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

type Props = {
  docs: IdmDocPreview[];
  onOpenFullPreview: (doc: IdmDocPreview) => void;
  onSaveRow: (doc: IdmDocPreview, updates: { name: string; value: string }[]) => void;
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
                        className="h-6 w-6"
                        disabled={!hasChanges || !doc.pid}
                        onClick={() => {
                          const updates = columns
                            .filter((col) => (rowEdited[col] ?? "") !== (rowInitial[col] ?? ""))
                            .map((col) => ({ name: col, value: rowEdited[col] ?? "" }));
                          if (updates.length) {
                            onSaveRow(doc, updates);
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
                          className="h-6 text-[10px] px-1"
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
    </div>
  );
};

export default DocAttributesGrid;