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
import { existsIdmItemByEntityFilenameOpportunity } from "@/api/idm";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  entityNames: string[];
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  onCompleted: () => void;
  defaultOpportunityNumber?: string; // New prop for pre-filling Gelegenheit
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
  duplicateExists?: boolean; // mark if duplicate found
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
  defaultOpportunityNumber, // Destructure new prop
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

  const loadAttrsForEntity = async (rowKey: string, entityName: string, fileName?: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === rowKey
          ? { ...r, entityName, loadingAttrs: true, attrs: [], values: {}, duplicateExists: false }
          : r
      )
    );
    try {
      const attributes = await getIdmEntityAttributes(authToken, cloudEnvironment, entityName);
      const filtered = attributes.filter((a) => a.name !== "MDS_ID"); // remove MDS_ID

      const initialValues: Record<string, string> = Object.fromEntries(filtered.map((a) => [a.name, ""]));

      // Pre-fill "Gelegenheit" if defaultOpportunityNumber is provided
      if (defaultOpportunityNumber) {
        const opportunityAttr = filtered.find(attr => attr.name === "Gelegenheit");
        if (opportunityAttr) {
          initialValues["Gelegenheit"] = defaultOpportunityNumber;
        }
      }

      setRows((prev) =>
        prev.map((r) =>
          r.key === rowKey
            ? {
                ...r,
                attrs: filtered,
                values: initialValues,
                loadingAttrs: false,
              }
            : r
        )
      );

      // After attributes are loaded, perform duplicate check if we have filename and Gelegenheit
      const opportunityId = initialValues["Gelegenheit"] || "";
      if (fileName && opportunityId) {
        try {
          const result = await existsIdmItemByEntityFilenameOpportunity(
            authToken,
            cloudEnvironment,
            entityName,
            fileName,
            opportunityId,
            "de-DE"
          );
          // Only set duplicateExists if all three fields match exactly
          setRows((prev) =>
            prev.map((r) =>
              r.key === rowKey ? { ...r, duplicateExists: result.exists } : r
            )
          );
        } catch (dupErr) {
          // If duplicate check fails, keep UI silent and assume no duplicate
          setRows((prev) =>
            prev.map((r) =>
              r.key === rowKey ? { ...r, duplicateExists: false } : r
            )
          );
        }
      }
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
      // Only send attributes that have a value and are not MDS_ID
      const attrsPayload = Object.entries(row.values)
        .filter(([name, v]) => name !== "MDS_ID" && v !== undefined && v !== null && String(v).length > 0)
        .map(([name, value]) => ({ name, value: String(value) }));

      await createIdmItem(authToken, cloudEnvironment, {
        entityName: row.entityName!,
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

  // Enable "apply to all" only if there are multiple rows, a Dokumententyp is selected in the first row,
  // attributes are loaded, and at least one attribute has a value.
  const canApplyToAll = React.useMemo(() => {
    if (rows.length < 2) return false;
    const first = rows[0];
    if (!first?.entityName || first.attrs.length === 0) return false;
    const hasValue = Object.values(first.values).some(
      (v) => (v ?? "").toString().trim().length > 0
    );
    return hasValue;
  }, [rows]);

  // Apply first row's entity and attributes to all rows
  const applyAttributesToAll = async () => {
    const source = rows[0];
    if (!source?.entityName) return;

    // Copy entityName, attrs, and values to all other rows
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx === 0) return r;
        const copiedValues: Record<string, string> = {};
        source.attrs.forEach((a) => {
          copiedValues[a.name] = source.values[a.name] ?? "";
        });
        return {
          ...r,
          entityName: source.entityName,
          attrs: source.attrs,
          values: copiedValues,
          loadingAttrs: false,
          // reset; will be recalculated below
          duplicateExists: false,
        };
      })
    );

    // Re-run duplicate check per row using the Gelegenheit from source or default
    const opportunityId =
      source.values["Gelegenheit"] || defaultOpportunityNumber || "";
    if (opportunityId) {
      rows.slice(1).forEach(async (r) => {
        try {
          const result = await existsIdmItemByEntityFilenameOpportunity(
            authToken,
            cloudEnvironment,
            source.entityName!,
            r.file.name,
            opportunityId,
            "de-DE"
          );
          setRows((prev) =>
            prev.map((rr) =>
              rr.key === r.key ? { ...rr, duplicateExists: result.exists } : rr
            )
          );
        } catch {
          // leave duplicateExists as false on error
        }
      });
    }

    toast({
      title: "Attribute übernommen",
      description:
        "Werte aus der ersten Zeile wurden auf alle Dokumente angewendet.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Neue Dokumente hochladen</DialogTitle>
          <DialogDescription>
            Wählen Sie pro Datei den Dokumententyp und füllen Sie die Attribute aus. Speichern Sie jede Zeile separat.
          </DialogDescription>
        </DialogHeader>

        {/* Top-right action to apply attributes from first row to all rows */}
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canApplyToAll}
            onClick={applyAttributesToAll}
            title="Attribute aus erster Zeile auf alle übernehmen"
          >
            Attribute für alle Dokumente übernehmen
          </Button>
        </div>

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
                        onValueChange={(val) => loadAttrsForEntity(row.key, val, row.file.name)}
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
                      {row.duplicateExists && (
                        <div className="mt-1 text-xs text-red-600">
                          Info: Dokument mit diesem Dateinamen wurde bereits hochgeladen
                        </div>
                      )}
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
                              ) : attr.name === "Belegdatum" || attr.type === "7" ? (
                                // datepicker for Belegdatum, stored as yyyy-MM-dd
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="h-8 w-[160px] justify-start text-left text-[12px] px-2"
                                    >
                                      {row.values[attr.name]
                                        ? format(parse(row.values[attr.name], "yyyy-MM-dd", new Date()), "dd.MM.yyyy")
                                        : "Datum wählen"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={
                                        row.values[attr.name]
                                          ? parse(row.values[attr.name], "yyyy-MM-dd", new Date())
                                          : undefined
                                      }
                                      onSelect={(date) => {
                                        const v = date ? format(date, "yyyy-MM-dd") : "";
                                        setRows((prev) =>
                                          prev.map((r) =>
                                            r.key === row.key
                                              ? { ...r, values: { ...r.values, [attr.name]: v } }
                                              : r
                                          )
                                        );
                                      }}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                // plain input for other attributes
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
                                  readOnly={attr.name === "Gelegenheit" && !!defaultOpportunityNumber} // Make read-only if pre-filled
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