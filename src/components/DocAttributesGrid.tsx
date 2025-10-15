"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { type IdmDocPreview } from "@/api/idm";

type Props = {
  docs: IdmDocPreview[];
};

const DocAttributesGrid: React.FC<Props> = ({ docs }) => {
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

  // Spaltenbreiten: erste fix 160px, restliche je 60px
  const gridTemplate =
    `160px ` + (columns.length ? columns.map(() => "100px").join(" ") : "");

  return (
    <div className="h-full w-full">
      <ScrollArea className="h-full w-full">
        <div className="pr-4">
          {/* Header */}
          <div
            className="grid gap-1 border-b py-2 text-xs font-medium text-muted-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="px-2">Dokumenttyp</div>
            {columns.map((col) => (
              <div key={col} className="px-2">{col}</div>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y">
            {docs.map((doc, idx) => (
              <div
                key={`${doc.entityName || "doc"}-${doc.filename || idx}-${idx}`}
                className="grid items-center gap-1 py-2"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {/* Dokumenttyp */}
                <div className="px-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {doc.entityName || "Entity"}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {doc.filename || "Dokument"}
                  </span>
                </div>

                {/* Attribute inputs */}
                {columns.map((col) => (
                  <div key={`${idx}-${col}`} className="px-2">
                    <Input
                      value={edited[idx]?.[col] ?? ""}
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
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default DocAttributesGrid;