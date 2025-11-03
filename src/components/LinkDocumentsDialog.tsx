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
                        onSelect={() => setSelected(e)}
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

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                toast({
                  title: "Verlinkungsziel gesetzt",
                  description: `Dokument(e) werden mit „${selected.desc || selected.name}“ verlinkt.`,
                  variant: "success",
                });
                onConfirm?.(selected);
                onOpenChange(false);
              }}
            >
              Bestätigen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkDocumentsDialog;