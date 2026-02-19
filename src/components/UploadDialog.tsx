"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import HorizontalScrollArea from "@/components/HorizontalScrollArea";
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
import { Loader2, Save, Copy, Upload } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { type CloudEnvironment } from "@/authorization/configLoader";
import { getIdmEntityAttributes, createIdmItem, type IdmAttribute } from "@/api/idm";
import { existsIdmItemByEntityFilenameOpportunity } from "@/api/idm";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  // Keep original names for API values
  entityNames: string[];
  // NEW: options with desc for display
  entityOptions?: { name: string; desc: string }[];
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  onCompleted: () => void;
  defaultOpportunityNumber?: string; // New prop for pre-filling Gelegenheit
  defaultProjectName?: string; // New prop for pre-filling Projekt
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
  entityOptions,
  authToken,
  cloudEnvironment,
  onCompleted,
  defaultOpportunityNumber, // Destructure new prop
  defaultProjectName, // Destructure new prop
}) => {
  const [rows, setRows] = React.useState<RowState[]>([]);
  const [bulkSaving, setBulkSaving] = React.useState(false);

  const duplicateRows = React.useMemo(() => {
    return rows.filter((r) => r.duplicateExists && r.entityName);
  }, [rows]);

  const getEntityLabel = React.useCallback(
    (entityName: string) => {
      const opt = entityOptions?.find((o) => o.name === entityName);
      const desc = (opt?.desc || opt?.name || entityName).toString();
      return desc.replace(/^\*/, "").trim();
    },
    [entityOptions]
  );

  // Clear rows when dialog is closed
  React.useEffect(() => {
    if (!open) {
      setRows([]);
    }
  }, [open]);

  // Initialize rows from files list, keep existing edited state where possible
  React.useEffect(() => {
    // Only initialize if dialog is open
    if (!open) return;
    
    // Force reset to fresh state when dialog opens
    setRows([]);
    
    // Initialize fresh rows from files
    const next: RowState[] = [];
    for (const f of files) {
      const key = fileKey(f);
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
    setRows(next);
  }, [files, open]);

  const loadAttrsForEntity = async (
    rowKey: string,
    entityName: string,
    fileName?: string,
    opportunityIdHint?: string
  ) => {
    // IMPORTANT: do NOT reset values here.
    // Users may change the document type after filling fields and we want to preserve matching values.
    setRows((prev) =>
      prev.map((r) =>
        r.key === rowKey
          ? {
              ...r,
              entityName,
              loadingAttrs: true,
              attrs: [],
              // keep existing values to merge later
              duplicateExists: false,
            }
          : r
      )
    );
    try {
      const attributes = await getIdmEntityAttributes(authToken, cloudEnvironment, entityName);
      const filtered = attributes.filter((a) => a.name !== "MDS_ID"); // remove MDS_ID

      const baseValues: Record<string, string> = Object.fromEntries(
        filtered.map((a) => [a.name, ""])
      );

      // Pre-fill "Gelegenheit" if defaultOpportunityNumber is provided
      if (defaultOpportunityNumber) {
        const opportunityAttr = filtered.find((attr) => attr.name === "Gelegenheit");
        if (opportunityAttr) {
          baseValues["Gelegenheit"] = defaultOpportunityNumber;
        }
      }

      // Pre-fill "Projekt" if defaultProjectName is provided
      if (defaultProjectName) {
        const projectAttr = filtered.find((attr) => attr.name === "Projekt");
        if (projectAttr) {
          baseValues["Projekt"] = defaultProjectName;
        }
      }

      // Merge: keep any previously entered value for attributes that still exist
      let mergedValuesForCheck: Record<string, string> | null = null;
      setRows((prev) =>
        prev.map((r) => {
          if (r.key !== rowKey) return r;

          const mergedValues: Record<string, string> = { ...baseValues };
          const prevValues = r.values || {};
          for (const name of Object.keys(mergedValues)) {
            const pv = prevValues[name];
            if (pv != null && String(pv).trim().length > 0) {
              mergedValues[name] = String(pv);
            }
          }

          mergedValuesForCheck = mergedValues;

          return {
            ...r,
            attrs: filtered,
            values: mergedValues,
            loadingAttrs: false,
          };
        })
      );

      // After attributes are loaded, perform duplicate check if we have filename and Gelegenheit
      // Use hint/merged values so changing the document type doesn't require re-entering Gelegenheit.
      const opportunityId =
        (opportunityIdHint ?? "").toString().trim() ||
        (mergedValuesForCheck?.["Gelegenheit"] ?? "").toString().trim() ||
        (defaultOpportunityNumber ?? "").toString().trim();

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
          setRows((prev) =>
            prev.map((r) =>
              r.key === rowKey ? { ...r, duplicateExists: result.exists } : r
            )
          );
        } catch {
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

  // Allow bulk upload when at least one row has a selected Dokumententyp
  const canSaveAll = React.useMemo(() => {
    return rows.filter((r) => !!r.entityName).length >= 2;
  }, [rows]);

  // Bulk save handler: uploads all rows that have a Dokumententyp selected
  const handleSaveAll = async () => {
    const toUpload = rows.filter((r) => !!r.entityName && !r.saving);
    if (toUpload.length === 0) {
      toast({
        title: "Keine Dokumente ausgewählt",
        description: "Bitte füllen Sie mindestens eine Zeile aus.",
        variant: "destructive",
      });
      return;
    }
    setBulkSaving(true);
    let success = 0;
    let fail = 0;
    for (const row of toUpload) {
      // mark row as saving
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, saving: true } : r)));
      try {
        const base64 = await fileToBase64(row.file);
        const attrsPayload = Object.entries(row.values)
          .filter(([name, v]) => name !== "MDS_ID" && v !== undefined && v !== null && String(v).length > 0)
          .map(([name, value]) => ({ name, value: String(value) }));
        await createIdmItem(authToken, cloudEnvironment, {
          entityName: row.entityName!,
          attrs: attrsPayload,
          resource: { filename: row.file.name, base64 },
          language: "de-DE",
        });
        success++;
        // remove row after success
        setRows((prev) => prev.filter((r) => r.key !== row.key));
      } catch (err: any) {
        fail++;
        const errorText = String(err?.message ?? "Upload fehlgeschlagen");
        toast({ title: "Upload fehlgeschlagen", description: errorText, variant: "destructive" });
        // reset saving flag on failure
        setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, saving: false } : r)));
      }
    }
    setBulkSaving(false);
    if (success > 0 && fail === 0) {
      toast({
        title: "Alle Dokumente hochgeladen",
        description: `${success} Dokument(e) wurden erfolgreich hochgeladen.`,
        variant: "success",
      });
      onOpenChange(false);
      onCompleted();
    } else if (success > 0 && fail > 0) {
      toast({
        title: "Teilweise hochgeladen",
        description: `${success} erfolgreich, ${fail} fehlgeschlagen.`,
      });
    } else {
      toast({
        title: "Keine Dokumente hochgeladen",
        description: "Es konnten keine Dokumente hochgeladen werden.",
        variant: "destructive",
      });
    }
  };

  // Apply first row's attributes (values) to all rows (WITHOUT copying the document type)
  const applyAttributesToAll = async () => {
    const source = rows[0];
    if (!source?.entityName || source.attrs.length === 0) return;

    const otherRows = rows.slice(1);

    // Copy only values that exist on the target row (based on its loaded attrs)
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx === 0) return r;
        if (r.attrs.length === 0) return r; // can't apply if the target didn't choose a document type yet

        const nextValues: Record<string, string> = { ...(r.values || {}) };
        r.attrs.forEach((a) => {
          const v = source.values[a.name];
          if (v != null && String(v).trim().length > 0) {
            nextValues[a.name] = String(v);
          }
        });

        return {
          ...r,
          // keep r.entityName!
          values: nextValues,
          loadingAttrs: false,
          duplicateExists: false,
        };
      })
    );

    // Re-run duplicate check per row with its OWN document type
    const opportunityId =
      source.values["Gelegenheit"] || defaultOpportunityNumber || "";

    if (opportunityId) {
      otherRows.forEach(async (r) => {
        if (!r.entityName) return;
        try {
          const result = await existsIdmItemByEntityFilenameOpportunity(
            authToken,
            cloudEnvironment,
            r.entityName,
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
        "Werte aus der ersten Zeile wurden (ohne Dokumententyp) auf alle Dokumente angewendet.",
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

        {duplicateRows.length > 0 && (
          <Alert variant="destructive" className="mt-2">
            <AlertTitle>Dokument bereits vorhanden</AlertTitle>
            <AlertDescription>
              Es existiert bereits ein Dokument mit gleichem Dateinamen und gleichem Dokumententyp:
              <ul className="mt-2 list-disc pl-5">
                {duplicateRows.map((r) => (
                  <li key={`dup-${r.key}`}>
                    <span className="font-medium">{r.file.name}</span>
                    {r.entityName ? ` (${getEntityLabel(r.entityName)})` : ""}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Action row: left 'apply to all' and right 'upload all' */}
        {(rows.length > 1 || rows.length > 0) && (
          <div className="flex items-center justify-between mb-2">
            {/* Left-side action to apply attributes from first row to all rows */}
            {rows.length > 1 ? (
              <div className="flex">
                <Button
                  variant={canApplyToAll ? "default" : "outline"}
                  size="sm"
                  disabled={!canApplyToAll}
                  onClick={applyAttributesToAll}
                  title="Attribute aus erster Zeile auf alle übernehmen"
                  className={canApplyToAll ? "bg-orange-500 text-white hover:bg-orange-600" : ""}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Attribute für alle Dokumente übernehmen
                </Button>
              </div>
            ) : (
              <div />
            )}
            {/* Right-side bulk upload button */}
            {rows.length > 1 && (
              <div className="flex">
                <Button
                  variant="default"
                  size="sm"
                  disabled={!canSaveAll || bulkSaving}
                  onClick={handleSaveAll}
                  title="Alle gefüllten Dokumente hochladen"
                  aria-label="Alle Dokumente hochladen"
                >
                  {bulkSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Alle Dokumente hochladen
                </Button>
              </div>
            )}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Dateien ausgewählt.</div>
        ) : (
          <HorizontalScrollArea className="max-h-[60vh]">
            <div className="min-w-full pr-2">
              {/* Header */}
              <div
                className="grid border-b py-2 text-xs font-medium text-muted-foreground"
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
                    className="grid items-center py-2"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {/* Entity Select */}
                    <div className="px-2">
                      <Select
                        value={row.entityName}
                        onValueChange={(val) =>
                          loadAttrsForEntity(
                            row.key,
                            val,
                            row.file.name,
                            row.values?.["Gelegenheit"] || defaultOpportunityNumber
                          )
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Dokumententyp wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const baseOptions =
                              entityOptions && entityOptions.length
                                ? entityOptions
                                : entityNames.map((n) => ({ name: n, desc: n }));

                            const prepared = baseOptions
                              .filter((opt) => (opt.desc || "").trim().startsWith("*"))
                              .map((opt) => ({
                                ...opt,
                                label: (opt.desc || opt.name).replace(/^\*/, "").trim(),
                              }))
                              .sort((a, b) => a.label.localeCompare(b.label, "de"));

                            return prepared.map((opt) => (
                              <SelectItem key={opt.name} value={opt.name}>
                                {opt.label}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      {/* moved duplicate message above the table */}
                    </div>

                    {/* Filename */}
                    <div className="px-2">
                      <div className="max-w-[200px] overflow-hidden">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal block truncate max-w-full"
                          title={row.file.name}
                        >
                          {row.file.name}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {(row.file.size / 1024).toFixed(1)} KB
                        </div>
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
                        aria-label="Dokument hochladen"
                      >
                        {row.saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </HorizontalScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button 
            variant="destructive" 
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;