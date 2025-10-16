"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { type CloudEnvironment } from "@/authorization/configLoader";
import { getIdmEntityAttributes, createIdmItem, type IdmAttribute } from "@/api/idm";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  entityNames: string[];
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  onCompleted: () => void;
};

type RowState = {
  key: string;
  file: File;
  entityName?: string;
  attrs: IdmAttribute[]; // now includes valueset
  values: Record<string, string>;
  loadingAttrs: boolean;
  saving: boolean;
  saved: boolean;
};

const fileKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onOpenChange,
  files,
  entityNames,
  authToken,
  cloudEnvironment,
  onCompleted,
}) => {
  const [rows, setRows] = React.useState<RowState[]>([]);

  // Initialize rows from files list, keep existing edited state where possible
  React.useEffect(() => {
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.key, r]));
      const next: RowState[] = [];
      for (const f of files) {
        const key = fileKey(f);
        const existing = map.get(key);
        if (existing) {
          // update file ref in case it changed, keep state
          next.push({ ...existing, file: f });
        } else {
          next.push({
            key,
            file: f,
            entityName: undefined,
            attrs: [],
            values: {},
            loadingAttrs: false,
            saving: false,
            saved: false,
          });
        }
      }
      return next;
    });
  }, [files]);

  const loadAttrsForEntity = async (rowKey: string, entityName: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === rowKey
          ? { ...r, entityName, loadingAttrs: true, attrs: [], values: {} }
          : r
      )
    );
    try {
      const attributes = await getIdmEntityAttributes(authToken, cloudEnvironment, entityName);
      setRows((prev) =>
        prev.map((r) =>
          r.key === rowKey
            ? { ...r, attrs: attributes, values: Object.fromEntries(attributes.map((a) => [a.name, ""])), loadingAttrs: false }
            : r
        )
      );
    } catch (err: any) {
      const msg = String(err?.message ?? "Attribute konnten nicht geladen werden.");
      toast({ title: "Fehler", description: msg, variant: "destructive" });
      setRows((prev) =>
        prev.map((r) =>
          r.key === rowKey ? { ...r, loadingAttrs: false } : r
        )
      );
    }
  };

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

  const handleSaveRow = async (row: RowState) => {
    if (!row.entityName) {
      toast({ title: "Bitte Dokumententyp wählen", variant: "destructive" });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.key === row.key ? { ...r, saving: true } : r))
    );
    try {
      const base64 = await fileToBase64(row.file);
      // Only send attributes that have a value, keep simple
      const attrsPayload = Object.entries(row.values)
        .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
        .map(([name, value]) => ({ name, value: String(value) }));

      await createIdmItem(authToken, cloudEnvironment, {
        entityName: row.entityName,
        attrs: attrsPayload,
        resource: { filename: row.file.name, base64 },
        language: "de-DE",
      });

      toast({ title: "Upload erfolgreich", variant: "success" });
      // Mark as saved and remove the row
      setRows((prev) => prev.filter((r) => r.key !== row.key));

      // If all rows are saved, close and notify parent
      setTimeout(() => {
        if (rows.length <= 1) {
          onOpenChange(false);
          onCompleted();
        }
      }, 50);
    } catch (err: any) {
      const errorText = String(err?.message ?? "Upload fehlgeschlagen");
      toast({ title: "Upload fehlgeschlagen", description: errorText, variant: "destructive" });
      setRows((prev) =>
        prev.map((r) => (r.key === row.key ? { ...r, saving: false } : r))
      );
    }
  };

  // Calculate dynamic grid template based on maximum attrs count among rows
  const maxAttrCount = React.useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.attrs.length), 0),
    [rows]
  );
  const gridTemplate = React.useMemo(() => {
    const baseCols = ["200px", "160px"]; // Entity select, filename
    const attrCols = Array.from({ length: maxAttrCount }).map(() => "160px");
    const actionCols = ["120px"]; // Save button
    return [...baseCols, ...attrCols, ...actionCols].join(" ");
  }, [maxAttrCount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Neue Dokumente hochladen</DialogTitle>
          <DialogDescription>
            Wählen Sie pro Datei den Dokumententyp und füllen Sie die Attribute aus. Speichern Sie jede Zeile separat.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Dateien ausgewählt.</div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="min-w-full pr-2">
              {/* Header */}
              <div
                className="grid gap-1 border-b py-2 text-xs font-medium text-muted-foreground"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div className="px-2">Dokumententyp</div>
                <div className="px-2">Dateiname</div>
                {Array.from({ length: maxAttrCount }).map((_, idx) => (
                  <div key={`hdr-${idx}`} className="px-2"></div>
                ))}
                <div className="px-2">Aktion</div>
              </div>

              {/* Rows */}
              <div className="divide-y">
                {rows.map((row) => (
                  <div
                    key={row.key}
                    className="grid items-center gap-1 py-2"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {/* Entity Select */}
                    <div className="px-2">
                      <Select
                        value={row.entityName}
                        onValueChange={(val) => loadAttrsForEntity(row.key, val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Dokumententyp wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {entityNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filename */}
                    <div className="px-2">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {row.file.name}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground">
                        {(row.file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>

                    {/* Dynamic attribute inputs */}
                    {Array.from({ length: maxAttrCount }).map((_, idx) => {
                      const attr = row.attrs[idx];
                      return (
                        <div key={`${row.key}-attr-${idx}`} className="px-2">
                          {row.loadingAttrs ? (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Attribute laden…
                            </div>
                          ) : attr ? (
                            <div className="space-y-1">
                              <div className="text-[10px] text-muted-foreground">{attr.name}</div>
                              {attr.valueset && attr.valueset.length > 0 ? (
                                <Select
                                  value={row.values[attr.name] ?? ""}
                                  onValueChange={(val) => {
                                    setRows((prev) =>
                                      prev.map((r) =>
                                        r.key === row.key
                                          ? { ...r, values: { ...r.values, [attr.name]: val } }
                                          : r
                                      )
                                    );
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-[12px] px-2">
                                    <SelectValue placeholder="Wählen…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {attr.valueset.map((vs) => (
                                      <SelectItem key={vs.name} value={vs.name}>
                                        {vs.desc}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={row.values[attr.name] ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setRows((prev) =>
                                      prev.map((r) =>
                                        r.key === row.key
                                          ? {
                                              ...r,
                                              values: { ...r.values, [attr.name]: v },
                                            }
                                          : r
                                      )
                                    );
                                  }}
                                  className="h-8 text-[12px] px-2"
                                  placeholder=""
                                  aria-label={`Attribut ${attr.name}`}
                                />
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground">—</div>
                          )}
                        </div>
                      );
                    })}

                    {/* Save button */}
                    <div className="px-2">
                      <Button
                        variant="default"
                        size="sm"
                        disabled={!row.entityName || row.saving}
                        onClick={() => handleSaveRow(row)}
                        className={cn("h-8")}
                        title="Zeile speichern und hochladen"
                      >
                        {row.saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Speichern
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;