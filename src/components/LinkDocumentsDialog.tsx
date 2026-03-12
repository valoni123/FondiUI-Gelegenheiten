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
import { getIdmEntityInfos, type IdmEntityInfo, type IdmAttribute, searchIdmItemsByAttributesJson, type IdmDocPreview, searchIdmItemsByXQueryJson } from "@/api/idm";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { linkIdmItemDocumentsBidirectional } from "@/api/idm";
import { getExistingLinkedPids } from "@/api/idm";

type LinkDocumentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  onConfirm?: (selected: IdmEntityInfo) => void;
  mainPid?: string; // PID des Hauptdokuments
  mainEntityName?: string; // EntityName des Hauptdokuments
  projectName?: string; // Projektname für zusätzliche Projekt-Verlinkung-Suche
};

const LinkDocumentsDialog: React.FC<LinkDocumentsDialogProps> = ({
  open,
  onOpenChange,
  authToken,
  cloudEnvironment,
  onConfirm,
  mainPid,
  mainEntityName,
  projectName,
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
  const [existingLinkedPids, setExistingLinkedPids] = React.useState<Set<string>>(new Set());

  const normalizePid = React.useCallback((pid?: string) => String(pid ?? "").trim(), []);

  const pidVariants = React.useCallback(
    (pid: string) => {
      const p = normalizePid(pid);
      if (!p) return [] as string[];
      const vars: string[] = [p];
      if (/-latest$/i.test(p)) vars.push(p.replace(/-latest$/i, ""));
      const dash = p.indexOf("-");
      if (dash > 0) {
        const tail = p.slice(dash + 1);
        if (tail) {
          vars.push(tail);
          if (/-latest$/i.test(tail)) vars.push(tail.replace(/-latest$/i, ""));
        }
      }
      return Array.from(new Set(vars.map((v) => v.trim()).filter(Boolean)));
    },
    [normalizePid]
  );

  const isAlreadyLinkedPid = React.useCallback(
    (pid?: string) => {
      const p = normalizePid(pid);
      if (!p) return false;
      for (const v of pidVariants(p)) {
        if (existingLinkedPids.has(v)) return true;
      }
      return false;
    },
    [existingLinkedPids, normalizePid, pidVariants]
  );

  const mainPidVariants = React.useMemo(() => {
    const set = new Set<string>();
    if (!mainPid) return set;
    for (const v of pidVariants(mainPid)) set.add(v);
    return set;
  }, [mainPid, pidVariants]);

  const isSameAsMainPid = React.useCallback(
    (pid?: string) => {
      const p = normalizePid(pid);
      if (!p || !mainPidVariants.size) return false;
      for (const v of pidVariants(p)) {
        if (mainPidVariants.has(v)) return true;
      }
      return false;
    },
    [mainPidVariants, normalizePid, pidVariants]
  );

  const isAlreadyLinkedByBackReference = React.useCallback(
    (doc: IdmDocPreview) => {
      if (!mainPidVariants.size) return false;
      const raw = (doc.attributes ?? []).find((a) => a?.name === "Dokument_Verlinkung")?.value ?? "";
      const values = String(raw)
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const val of values) {
        for (const v of pidVariants(val)) {
          if (mainPidVariants.has(v)) return true;
        }
      }
      return false;
    },
    [mainPidVariants, pidVariants]
  );

  const getDocKey = React.useCallback((doc: IdmDocPreview) => {
    if (doc.pid) return `pid:${doc.pid}`;
    // fallback when pid is missing (avoid preview URLs because they can be re-signed)
    return `f:${doc.entityName ?? ""}|${doc.filename ?? ""}|${doc.createdTS ?? ""}|${doc.lastChangedTS ?? ""}`;
  }, []);

  const sortDocsByCreatedAt = React.useCallback(
    (docs: IdmDocPreview[]) => {
      const toMs = (v?: string) => {
        if (!v) return Number.NEGATIVE_INFINITY;
        const t = new Date(v).getTime();
        return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
      };

      return [...docs].sort((a, b) => {
        const diff = toMs(b.createdTS) - toMs(a.createdTS);
        if (diff !== 0) return diff;
        const diffChanged = toMs(b.lastChangedTS) - toMs(a.lastChangedTS);
        if (diffChanged !== 0) return diffChanged;
        return getDocKey(a).localeCompare(getDocKey(b), "de");
      });
    },
    [getDocKey]
  );

  const mergeDocs = React.useCallback(
    (primary: IdmDocPreview[], projectLinked: IdmDocPreview[]) => {
      const byKey = new Map<string, IdmDocPreview>();

      for (const d of primary) {
        byKey.set(getDocKey(d), d);
      }

      for (const d of projectLinked) {
        const key = getDocKey(d);
        const existing = byKey.get(key);
        if (existing) {
          byKey.set(key, {
            ...existing,
            linkedViaProject: existing.linkedViaProject || true,
            linkedProjectValue: existing.linkedProjectValue || d.linkedProjectValue,
          });
        } else {
          byKey.set(key, d);
        }
      }

      return Array.from(byKey.values());
    },
    [getDocKey]
  );

  const linkedProjectXQuery = React.useMemo(() => {
    const raw = (projectName ?? "").toString().trim();
    if (!raw) return null;
    const escaped = raw.replace(/"/g, "\\\"");
    return (
      `/Anfrage_Kunde[Projekt_Verlinkung/@Value = "${escaped}"] ` +
      `UNION /_Anfrage__Lieferant_[Projekt_Verlinkung/@Value = "${escaped}"] ` +
      `SORTBY(@LASTCHANGEDTS DESCENDING)`
    );
  }, [projectName]);

  React.useEffect(() => {
    if (!open) {
      setStep(1);
      setSelected(null);
      setSelectedAttributes([]);
      setResults([]);
      setAttrQuery("");
      setQuery("");
      setSelectedPids(new Set());
      setExistingLinkedPids(new Set());
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

  React.useEffect(() => {
    if (!open || !mainPid) return;
    let cancelled = false;

    (async () => {
      try {
        const pids = await getExistingLinkedPids(authToken, cloudEnvironment, mainPid, "de-DE");
        if (!cancelled) {
          const next = new Set<string>();
          for (const raw of pids || []) {
            for (const v of pidVariants(String(raw))) next.add(v);
          }
          setExistingLinkedPids(next);
        }
      } catch (err: any) {
        if (!cancelled) setExistingLinkedPids(new Set());
        toast({
          title: "Verlinkungen konnten nicht geladen werden",
          description: String(err?.message ?? "Unbekannter Fehler"),
          variant: "destructive",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mainPid, authToken, cloudEnvironment, pidVariants]);

  // If the user searched/selected quickly before the existing links finished loading,
  // ensure already linked PIDs are removed from the current selection.
  React.useEffect(() => {
    if (existingLinkedPids.size === 0) return;
    setSelectedPids((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const pid of Array.from(next)) {
        if (isAlreadyLinkedPid(pid)) {
          next.delete(pid);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [existingLinkedPids, isAlreadyLinkedPid]);

  const preparedEntities = React.useMemo(() => {
    // Match UploadDialog behavior: only show entries whose desc starts with '*', strip '*', and sort by label.
    return entities
      .filter((e) => (e.desc || "").trim().startsWith("*"))
      .map((e) => ({
        entity: e,
        label: (e.desc || e.name).replace(/^\*/, "").trim(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [entities]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return preparedEntities;
    const q = query.toLowerCase();
    return preparedEntities.filter(
      ({ entity, label }) =>
        label.toLowerCase().includes(q) ||
        (entity.name || "").toLowerCase().includes(q) ||
        (entity.desc || "").toLowerCase().includes(q)
    );
  }, [preparedEntities, query]);

  const selectedLabel = React.useMemo(() => {
    if (!selected) return "";
    return (selected.desc || selected.name).replace(/^\*/, "").trim();
  }, [selected]);

  const attributesFull: IdmAttribute[] = React.useMemo(() => {
    const raw = selected?.entity?.attrs?.attr ?? [];
    const arr: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr
      .map((a) => {
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
      })
      .filter((a: IdmAttribute) => a.name.length > 0);
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
    const p = normalizePid(pid);
    if (!p) return;
    if (isSameAsMainPid(p)) return;
    if (isAlreadyLinkedPid(p)) return;
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleLink = async () => {
    if (!mainPid || selectedPids.size === 0) return;
    setLinking(true);
    try {
      const newlySelected = Array.from(selectedPids);
      const entity = mainEntityName || selected?.name || "";
      await linkIdmItemDocumentsBidirectional(authToken, cloudEnvironment, mainPid, entity, newlySelected, "de-DE");
      toast({
        title: "Verlinkung erfolgreich",
        description: `${newlySelected.length} Dokument(e) mit PID „${mainPid}” beidseitig verlinkt.`,
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
                      {filtered.map(({ entity, label }) => {
                        const isActive = selected?.name === entity.name;
                        return (
                          <CommandItem
                            key={entity.name}
                            onSelect={() => {
                              setSelected(entity);
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
                              <span className="text-sm">{label}</span>
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
                  <Badge variant="secondary" className="text-xs">{selectedLabel}</Badge>
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
                            onChange={(val: string) => setAttrValue(a.name, val)}
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
                  {results.map((r) => {
                    const pidStr = normalizePid(r.pid);
                    const alreadyLinked =
                      !!pidStr && (isAlreadyLinkedPid(pidStr) || isAlreadyLinkedByBackReference(r));
                    const isSelf = !!pidStr && isSameAsMainPid(pidStr);
                    const isSelected = !!pidStr ? selectedPids.has(pidStr) : false;
                    const checkboxDisabled = !pidStr || alreadyLinked || isSelf;
                    const checkboxTitle = alreadyLinked
                      ? "Dieses Dokument ist bereits verlinkt"
                      : isSelf
                        ? "Das Hauptdokument kann nicht mit sich selbst verlinkt werden"
                        : undefined;

                    return (
                      <div
                        key={getDocKey(r)}
                        className={cn(
                          "relative border rounded-md p-2 hover:bg-muted cursor-pointer",
                          isSelected && "ring-2 ring-blue-600",
                          (alreadyLinked || isSelf) && "opacity-70"
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
                            checked={alreadyLinked || isSelected}
                            disabled={checkboxDisabled}
                            onCheckedChange={() => togglePid(pidStr)}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            aria-label="Dokument auswählen"
                            title={checkboxTitle}
                          />
                        </div>

                        {/* Bereits verlinkt Badge */}
                        {alreadyLinked ? (
                          <div className="absolute bottom-2 left-2 z-10">
                            <Badge
                              variant="secondary"
                              className="bg-amber-100 text-amber-900 border border-amber-200"
                              title="Dieses Dokument ist bereits mit dem Hauptdokument verlinkt"
                            >
                              verlinkt
                            </Badge>
                          </div>
                        ) : null}

                        {/* Projekt-Verlinkung Badge */}
                        {r.linkedViaProject ? (
                          <div className="absolute top-2 right-2 z-10">
                            <Badge
                              variant="default"
                              className="bg-gray-700 text-white border border-gray-800 shadow-sm text-[11px] px-2 py-0.5 font-semibold"
                              title={
                                (r.attributes ?? []).find((a) => a?.name === "Projekt")?.value
                                  ? `Hauptprojekt: ${(r.attributes ?? []).find((a) => a?.name === "Projekt")?.value}`
                                  : "Hauptprojekt: unbekannt"
                              }
                            >
                              verknüpft
                            </Badge>
                          </div>
                        ) : null}

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
                  description: `„${selectedLabel || selected.name}“ ausgewählt. Bitte wählen Sie Attribute.`,
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

                const [found, projectLinked] = await Promise.all([
                  searchIdmItemsByAttributesJson(
                    authToken,
                    cloudEnvironment,
                    selected.name,
                    filters,
                    0,
                    50,
                    "de-DE"
                  ),
                  linkedProjectXQuery
                    ? searchIdmItemsByXQueryJson(authToken, cloudEnvironment, linkedProjectXQuery, 0, 200, "de-DE")
                        .then((docs) =>
                          docs.map((d) => ({
                            ...d,
                            linkedViaProject: true,
                            linkedProjectValue: (projectName ?? "").toString().trim(),
                          }))
                        )
                        .catch(() => [])
                    : Promise.resolve([] as IdmDocPreview[]),
                ]);

                const merged = sortDocsByCreatedAt(mergeDocs(found, projectLinked));
                setResults(merged);
                toast({
                  title: "Suche abgeschlossen",
                  description: `${merged.length} Dokument(e) gefunden.`,
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