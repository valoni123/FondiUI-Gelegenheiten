"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, Link as LinkIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { type CloudEnvironment } from "@/authorization/configLoader";
import AttributeValueField from "@/components/AttributeValueField";
import { getIdmEntityInfos, type IdmEntityInfo, type IdmAttribute, searchIdmItemsByAttributesJson, type IdmDocPreview } from "@/api/idm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { linkIdmItemDocuments, getExistingLinkedPids } from "@/api/idm";

type LinkDocumentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  onConfirm?: (selected: IdmEntityInfo) => void;
  mainPid?: string; // PID des Hauptdokuments
  mainEntityName?: string; // EntityName des Hauptdokuments
};

const LinkDocumentsDialog: React.FC<LinkDocumentsDialogProps> = ({
  open,
  onOpenChange,
  authToken,
  cloudEnvironment,
  onConfirm,
  mainPid,
  mainEntityName,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [entities, setEntities] = React.useState<IdmEntityInfo[]>([]);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<IdmEntityInfo | null>(null);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [attrQuery, setAttrQuery] = React.useState("");
  const [selectedAttributes, setSelectedAttributes] = React.useState<{ name: string; type?: string; valueset?: { name: string; desc: string }[]; value?: string; desc?: string }[]>([]);
  const [results, setResults] = React.useState<IdmDocPreview[]>([]);
  const [selectedPids, setSelectedPids] = React.useState<Set<string>>(new Set());
  const [linking, setLinking] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setStep(1);
      setSelected(null);
      setSelectedAttributes([]);
      setResults([]);
      setAttrQuery("");
      setQuery("");
      setSelectedPids(new Set());
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const list = await getIdmEntityInfos(authToken, cloudEnvironment, "de-DE");
        if (!cancelled) setEntities(list);
      } catch (err: any) {
        toast({
          title: "Laden der Dokumententypen fehlgeschlagen",
          description: String(err?.message ?? "Unbekannter Fehler"),
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, authToken, cloudEnvironment]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return entities;
    const q = query.toLowerCase();
    return entities.filter((e) => (e.desc || e.name).toLowerCase().includes(q));
  }, [entities, query]);

  const attributesFull: IdmAttribute[] = React.useMemo(() => {
    const raw = selected?.entity?.attrs?.attr ?? [];
    const arr: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr.map((a) => {
      const vs = a?.valueset?.value;
      const valueset = Array.isArray(vs)
        ? vs.map((v: any) => ({ name: String(v.name ?? ""), desc: String(v.desc ?? "") }))
        : undefined;
      return {
        name: String(a?.name ?? ""),
        desc: String(a?.desc ?? ""),
        valueset,
        type: String(a?.type ?? ""),
      } as IdmAttribute;
    }).filter((a: IdmAttribute) => a.name.length > 0);
  }, [selected]);

  const attributeNames = React.useMemo(() => attributesFull.map((a) => a.name), [attributesFull]);
  const filteredAttributes = React.useMemo(() => {
    if (!attrQuery.trim()) return attributeNames;
    const q = attrQuery.toLowerCase();
    return attributeNames.filter((n) => n.toLowerCase().includes(q));
  }, [attributeNames, attrQuery]);

  const getAttrByName = React.useCallback(
    (name: string) => attributesFull.find((a) => a.name === name),
    [attributesFull]
  );

  const toggleAttribute = (name: string) => {
    setSelectedAttributes((prev) => {
      const exists = prev.some((p) => p.name === name);
      if (exists) {
        return prev.filter((p) => p.name !== name);
      }
      const full = getAttrByName(name);
      return full
        ? [...prev, { name: full.name, type: full.type, valueset: full.valueset, desc: full.desc, value: "" }]
        : prev;
    });
  };

  const setAttrValue = (name: string, value: string) => {
    setSelectedAttributes((prev) => prev.map((p) => (p.name === name ? { ...p, value } : p)));
  };

  const togglePid = (pid?: string) => {
    if (!pid) return;
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const handleLink = async () => {
    if (!mainPid || selectedPids.size === 0) return;
    setLinking(true);
    try {
      const newlySelected = Array.from(selectedPids);
      const existing = await getExistingLinkedPids(authToken, cloudEnvironment, mainPid, "de-DE");
      const combined = Array.from(new Set([...(existing || []), ...newlySelected]));
      const entity = mainEntityName || selected?.name || "";
      await linkIdmItemDocuments(authToken, cloudEnvironment, mainPid, entity, combined, "de-DE");
      toast({
        title: "Verlinkung erfolgreich",
        description: `${newlySelected.length} Dokument(e) mit PID „${mainPid}” verlinkt.`,
        variant: "success",
      });
      onOpenChange(false);
      if (onConfirm && selected) onConfirm(selected);
    } catch (err: any) {
      toast({
        title: "Verlinkung fehlgeschlagen",
        description: String(err?.message ?? "Unbekannter Fehler"),
        variant: "destructive",
      });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[1200px] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-blue-600" />
            Dokument(e) verlinken
          </DialogTitle>
          <DialogDescription>
            Wählen oder suchen Sie einen Dokumententyp (Dokumententypen), um die Verlinkung festzulegen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {step === 1 ? (
            <>
              <div className="rounded-md border">
                <Command>
                  <div className="px-2 py-2">
                    <CommandInput
                      placeholder="Dokumententyp suchen…"
                      value={query}
                      onValueChange={setQuery}
                    />
                  </div>
                  <CommandList className="max-h-64 overflow-y-auto">
                    <CommandEmpty>
                      {loading ? "Laden…" : "Keine Ergebnisse gefunden."}
                    </CommandEmpty>
                    <CommandGroup>
                      {filtered.map((e) => {
                        const isActive = selected?.name === e.name;
                        return (
                          <CommandItem
                            key={e.name}
                            onSelect={() => {
                              setSelected(e);
                              setSelectedAttributes([]);
                            }}
                            className={cn("cursor-pointer", isActive && "bg-muted")}
                          >
                            <div className="flex items-center gap-2">
                              {isActive ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <span className="inline-block w-4" />
                              )}
                              <span className="text-sm">{e.desc || e.name}</span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>

              {selected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ausgewählt:</span>
                  <Badge variant="secondary" className="text-xs">{selected.desc || selected.name}</Badge>
                </div>
              ) : null}
            </>
          ) : step === 2 ? (
            <>
              <div className="rounded-md border">
                <Command>
                  <div className="px-2 py-2">
                    <CommandInput
                      placeholder="Attribut suchen…"
                      value={attrQuery}
                      onValueChange={setAttrQuery}
                    />
                  </div>
                  <CommandList className="max-h-64 overflow-y-auto">
                    <CommandEmpty>
                      {attributeNames.length === 0
                        ? "Keine Attribute für diesen Dokumententyp gefunden."
                        : "Keine Ergebnisse gefunden."}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredAttributes.map((name) => {
                        const isActive = selectedAttributes.some((p) => p.name === name);
                        return (
                          <CommandItem
                            key={name}
                            onSelect={() => toggleAttribute(name)}
                            className={cn("cursor-pointer", isActive && "bg-muted")}
                          >
                            <div className="flex items-center gap-2">
                              {isActive ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <span className="inline-block w-4" />
                              )}
                              <span className="text-sm">{name}</span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>

              {selectedAttributes.length > 0 && (
                <div className="space-y-3">
                  {selectedAttributes.map((a) => {
                    const full = getAttrByName(a.name);
                    return (
                      <div key={a.name} className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-xs">{a.name}</Badge>
                        {full ? (
                          <AttributeValueField
                            attr={full}
                            value={a.value ?? ""}
                            onChange={(val) => setAttrValue(a.name, val)}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {results.length === 0 ? "Keine Dokumente gefunden." : `${results.length} Dokument(e) gefunden:`}
                </div>
                <div className="text-xs text-muted-foreground">
                  Ausgewählt: {selectedPids.size}
                </div>
              </div>

              <TooltipProvider>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {results.map((r, idx) => {
                    const isSelected = r.pid ? selectedPids.has(r.pid) : false;
                    return (
                      <div
                        key={`${r.pid ?? r.filename ?? idx}`}
                        className={cn(
                          "relative border rounded-md p-2 hover:bg-muted cursor-pointer",
                          isSelected && "ring-2 ring-blue-600"
                        )}
                        onClick={() => {
                          // Kachel-Klick öffnet weiterhin die Originaldatei
                          if (r.resourceUrl) {
                            window.open(r.resourceUrl, "_blank", "noopener,noreferrer");
                          }
                        }}
                      >
                        {/* Auswahl-Checkbox oben links */}
                        <div className="absolute top-2 left-2 z-10">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => togglePid(r.pid)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Dokument auswählen"
                          />
                        </div>

                        <div className="aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center">
                          <img
                            src={r.fullUrl ?? r.smallUrl}
                            alt={r.filename ?? "Vorschau"}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        {r.filename ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="mt-2 text-xs text-muted-foreground line-clamp-2"
                                title={r.filename}
                              >
                                {r.filename}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start">
                              <div className="max-w-[300px] break-words">{r.filename}</div>
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>
          ) : null}
        </div>

        <div className="flex-shrink-0 border-t mt-2 pt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>

          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step === 3 ? 2 : 1)}
            >
              Zurück
            </Button>
          )}

          {step === 1 ? (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                toast({
                  title: "Dokumententyp gewählt",
                  description: `„${selected.desc || selected.name}“ ausgewählt. Bitte wählen Sie Attribute.`,
                  variant: "success",
                });
                setStep(2);
              }}
            >
              Weiter
            </Button>
          ) : step === 2 ? (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!selected}
              onClick={async () => {
                if (!selected) return;
                // Erlaube Suche auch ohne Attribute: leeres Filter-Array
                const filters =
                  selectedAttributes.length > 0
                    ? selectedAttributes
                        .filter((a) => typeof a.value === "string" && a.value.length > 0)
                        .map((a) => ({ name: a.name, value: a.value! }))
                    : [];

                const found = await searchIdmItemsByAttributesJson(
                  authToken,
                  cloudEnvironment,
                  selected.name,
                  filters,
                  0,
                  50,
                  "de-DE"
                );
                setResults(found);
                toast({
                  title: "Suche abgeschlossen",
                  description: `${found.length} Dokument(e) gefunden.`,
                  variant: "success",
                });
                setStep(3);
              }}
            >
              Suchen
            </Button>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleLink}
              disabled={linking || !mainPid || selectedPids.size === 0}
              title={!mainPid ? "Kein Hauptdokument (PID) vorhanden" : undefined}
            >
              {linking ? "Verlinken…" : "Verlinken"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkDocumentsDialog;