"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Link as LinkIcon, ExternalLink, Download, Check, X, Link2Off } from "lucide-react";
import { getExistingLinkedPids, getIdmItemByPid } from "@/api/idm";
import { unlinkIdmItemDocumentBidirectional, unlinkIdmItemDocumentsBidirectional } from "@/api/idm";
import { toast } from "@/components/ui/use-toast";
import { type CloudEnvironment } from "@/authorization/configLoader";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import DocumentPreviewDialog from "@/components/DocumentPreviewDialog";
import FileTypeIcon from "@/components/FileTypeIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

type LinkedItem = { pid: string; filename?: string; drillbackurl?: string; resourceUrl?: string; previewUrl?: string };

type LinkedDialogTrigger = (args: { open: boolean; setOpen: (v: boolean) => void }) => React.ReactNode;

type LinkedDocumentsDialogProps = {
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  mainPid?: string;
  trigger?: LinkedDialogTrigger; // optionaler eigener Trigger (z. B. Icon-Button)
};

const LinkedDocumentsDialog: React.FC<LinkedDocumentsDialogProps> = ({
  authToken,
  cloudEnvironment,
  mainPid,
  trigger,
}) => {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [linkedItems, setLinkedItems] = React.useState<LinkedItem[]>([]);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<{ url?: string; title?: string }>({}); 
  const [pendingDelete, setPendingDelete] = React.useState<LinkedItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = React.useState(false);
  const selectedCount = selected.size;

  const loadLinked = React.useCallback(async () => {
    if (!mainPid) return;
    setLoading(true);
    try {
      const pids = await getExistingLinkedPids(authToken, cloudEnvironment, mainPid, "de-DE");
      if (!pids || pids.length === 0) {
        setLinkedItems([]);
        setSelected(new Set());
        return;
      }
      const details = await Promise.all(
        pids.map(async (pid: string) => {
          try {
            const info = await getIdmItemByPid(authToken, cloudEnvironment, pid, "de-DE");
            return {
              pid,
              filename: info.filename,
              drillbackurl: info.drillbackurl,
              resourceUrl: info.resourceUrl,
              previewUrl: info.previewUrl,
            };
          } catch {
            return { pid };
          }
        })
      );
      setLinkedItems(details);
      // Clear previous selection after refresh
      setSelected(new Set());
    } catch (err: any) {
      toast({
        title: "Fehler beim Laden der Verlinkungen",
        description: String(err?.message ?? err ?? "Unbekannter Fehler"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [authToken, cloudEnvironment, mainPid]);

  React.useEffect(() => {
    if (open && mainPid) {
      loadLinked();
    }
    if (!open) {
      setSelected(new Set());
    }
  }, [open, loadLinked, mainPid]);

  const toggleSelect = (pid: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(pid);
      else next.delete(pid);
      return next;
    });
  };

  const openPreview = (item: LinkedItem) => {
    if (item.previewUrl) {
      setPreviewData({ url: item.previewUrl, title: item.filename || item.pid });
      setPreviewOpen(true);
    } else {
      toast({
        title: "Keine Vorschau verfügbar",
        description: "Für dieses Dokument wurde keine Preview-URL gefunden.",
      });
    }
  };

  return (
    <>
      {trigger ? (
        trigger({ open, setOpen })
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="bg-violet-600 text-white hover:bg-violet-700"
          disabled={!mainPid}
          onClick={() => setOpen(true)}
          title={mainPid ? "Verlinkte Dokumente anzeigen" : "Kein Hauptdokument ausgewählt"}
        >
          <LinkIcon className="mr-2 h-4 w-4" /> Verlinkte Dokumente
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Verlinkte Dokumente</DialogTitle>
            <DialogDescription>
              {mainPid
                ? loading
                  ? "Verlinkungen werden geladen…"
                  : linkedItems.length > 0
                  ? `Gefundene Verlinkungen: ${linkedItems.length}`
                  : ""
                : "Kein Hauptdokument (PID) vorhanden."}
            </DialogDescription>
          </DialogHeader>

          {selectedCount > 1 && (
            <div className="mb-2 flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => setPendingBulk(true)}
                title="Ausgewähle Verlinkungen entfernen"
              >
                <Link2Off className="mr-2 h-4 w-4" />
                Ausgewähle Verlinkungen entfernen
              </Button>
            </div>
          )}

          {!mainPid ? (
            <div className="text-sm text-muted-foreground">Bitte ein Dokument mit gültiger PID öffnen.</div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verlinkungen werden geladen…
            </div>
          ) : linkedItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine verlinkten Dokumente gefunden.</div>
          ) : (
            <TooltipProvider>
              <ScrollArea className="max-h-[60vh]">
                <ul className="space-y-2">
                  {linkedItems.map((it) => (
                    <li key={it.pid} className="rounded-md bg-muted px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex items-start gap-3">
                          <Checkbox
                            checked={selected.has(it.pid)}
                            onCheckedChange={(v: boolean) => toggleSelect(it.pid, !!v)}
                            className="mt-1"
                            aria-label="Auswählen"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <FileTypeIcon filename={it.filename} />
                              <button
                                type="button"
                                className="text-sm font-medium break-words text-blue-700 hover:underline text-left"
                                onClick={() => openPreview(it)}
                                title="Vorschau anzeigen"
                              >
                                {it.filename ?? "Dateiname unbekannt"}
                              </button>
                            </div>
                            <div className="text-xs text-muted-foreground break-words" title={it.pid}>
                              {it.pid}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                onClick={() => setPendingDelete(it)}
                                aria-label="Verlinkung entfernen"
                                title="Verlinkung entfernen"
                              >
                                <Link2Off className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>Verlinkung entfernen</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className={it.drillbackurl ? "h-8 w-8 text-blue-600 hover:text-blue-700" : "h-8 w-8 opacity-50 cursor-not-allowed"}
                                onClick={() => {
                                  if (it.drillbackurl) window.open(it.drillbackurl, "_blank", "noopener");
                                }}
                                aria-label="in IDM anzeigen"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>in IDM anzeigen</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className={it.resourceUrl ? "h-8 w-8 text-blue-600 hover:text-blue-700" : "h-8 w-8 opacity-50 cursor-not-allowed"}
                                onClick={() => {
                                  if (it.resourceUrl) window.open(it.resourceUrl, "_blank", "noopener");
                                }}
                                aria-label="Herunterladen"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>Herunterladen</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </TooltipProvider>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm unlink dialog */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o: boolean) => {
          if (!o && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soll die Verlinkung entfernt werden?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion entfernt nur die Verknüpfung. Das Dokument bleibt im IDM erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={deleting}>Nein</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async () => {
                if (!pendingDelete || !mainPid) {
                  setPendingDelete(null);
                  return;
                }
                try {
                  setDeleting(true);
                  await unlinkIdmItemDocumentBidirectional(authToken, cloudEnvironment, mainPid, pendingDelete.pid);
                  toast({
                    title: (
                      <span className="inline-flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Verlinkung entfernt
                      </span>
                    ),
                    variant: "success",
                  });
                  setPendingDelete(null);
                  await loadLinked();
                } catch (err: any) {
                  toast({
                    title: (
                      <span className="inline-flex items-center gap-2">
                        <X className="h-4 w-4 text-white" />
                        Entfernen fehlgeschlagen
                      </span>
                    ),
                    description: String(err?.message ?? err ?? "Unbekannter Fehler"),
                    variant: "destructive",
                  });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              Ja
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm bulk unlink dialog */}
      <AlertDialog
        open={pendingBulk}
        onOpenChange={(o: boolean) => {
          if (!o && !deleting) setPendingBulk(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soll die Verlinkung entfernt werden?</AlertDialogTitle>
            <AlertDialogDescription>
              Es werden {selectedCount} Verlinkungen entfernt. Die Dokumente bleiben im IDM erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={deleting}>Nein</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || selectedCount < 2 || !mainPid}
              onClick={async () => {
                if (!mainPid) return;
                const toRemove = Array.from(selected);
                try {
                  setDeleting(true);
                  await unlinkIdmItemDocumentsBidirectional(authToken, cloudEnvironment, mainPid, toRemove);
                  toast({
                    title: (
                      <span className="inline-flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Verlinkungen entfernt
                      </span>
                    ),
                    variant: "success",
                  });
                  setPendingBulk(false);
                  await loadLinked();
                } catch (err: any) {
                  toast({
                    title: (
                      <span className="inline-flex items-center gap-2">
                        <X className="h-4 w-4 text-white" />
                        Entfernen fehlgeschlagen
                      </span>
                    ),
                    description: String(err?.message ?? err ?? "Unbekannter Fehler"),
                    variant: "destructive",
                  });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              Ja
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <DocumentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        url={previewData.url}
        title={previewData.title}
      />
    </>
  );
};

export default LinkedDocumentsDialog;