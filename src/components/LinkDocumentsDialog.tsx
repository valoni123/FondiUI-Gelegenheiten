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
import { getIdmEntityInfos, type IdmEntityInfo } from "@/api/idm";

type LinkDocumentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  onConfirm?: (selected: IdmEntityInfo) => void;
};

const LinkDocumentsDialog: React.FC<LinkDocumentsDialogProps> = ({
  open,
  onOpenChange,
  authToken,
  cloudEnvironment,
  onConfirm,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [entities, setEntities] = React.useState<IdmEntityInfo[]>([]);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<IdmEntityInfo | null>(null);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [attrQuery, setAttrQuery] = React.useState("");
  const [selectedAttrName, setSelectedAttrName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setStep(1);
      setSelected(null);
      setSelectedAttrName(null);
      setAttrQuery("");
      setQuery("");
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

  const attributeNames = React.useMemo(() => {
    const raw = selected?.entity?.attrs?.attr ?? [];
    const arr: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr
      .map((a) => String(a?.name ?? ""))
      .filter((n) => n.length > 0);
  }, [selected]);

  const filteredAttributes = React.useMemo(() => {
    if (!attrQuery.trim()) return attributeNames;
    const q = attrQuery.toLowerCase();
    return attributeNames.filter((n) => n.toLowerCase().includes(q));
  }, [attributeNames, attrQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-blue-600" />
            Dokument(e) verlinken
          </DialogTitle>
          <DialogDescription>
            Wählen oder suchen Sie einen Dokumententyp (Dokumententypen), um die Verlinkung festzulegen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                              setSelectedAttrName(null);
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
          ) : (
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
                        const isActive = selectedAttrName === name;
                        return (
                          <CommandItem
                            key={name}
                            onSelect={() => setSelectedAttrName(name)}
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

              {selectedAttrName ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ausgewähltes Attribut:</span>
                  <Badge variant="secondary" className="text-xs">{selectedAttrName}</Badge>
                </div>
              ) : null}
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            {step === 1 ? (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!selected}
                onClick={() => {
                  if (!selected) return;
                  toast({
                    title: "Dokumententyp gewählt",
                    description: `„${selected.desc || selected.name}“ ausgewählt. Bitte wählen Sie ein Attribut.`,
                    variant: "success",
                  });
                  setStep(2);
                }}
              >
                Weiter
              </Button>
            ) : (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!selectedAttrName}
                onClick={() => {
                  if (!selected || !selectedAttrName) return;
                  toast({
                    title: "Verlinkung vorbereitet",
                    description: `Typ: „${selected.desc || selected.name}“, Attribut: „${selectedAttrName}“`,
                    variant: "success",
                  });
                  onConfirm?.(selected);
                  onOpenChange(false);
                }}
              >
                Bestätigen
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkDocumentsDialog;