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
import { Loader2, Link as LinkIcon, ExternalLink } from "lucide-react";
import { getExistingLinkedPids, getIdmItemByPid } from "@/api/idm";
import { toast } from "@/components/ui/use-toast";
import { type CloudEnvironment } from "@/authorization/configLoader";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type LinkedDocumentsDialogProps = {
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  mainPid?: string;
};

type LinkedItem = { pid: string; filename?: string; drillbackurl?: string };

const LinkedDocumentsDialog: React.FC<LinkedDocumentsDialogProps> = ({
  authToken,
  cloudEnvironment,
  mainPid,
}) => {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [linkedItems, setLinkedItems] = React.useState<LinkedItem[]>([]);

  const loadLinked = React.useCallback(async () => {
    if (!mainPid) return;
    setLoading(true);
    try {
      const pids = await getExistingLinkedPids(authToken, cloudEnvironment, mainPid, "de-DE");
      if (!pids || pids.length === 0) {
        setLinkedItems([]);
        return;
      }
      const details = await Promise.all(
        pids.map(async (pid) => {
          try {
            const info = await getIdmItemByPid(authToken, cloudEnvironment, pid, "de-DE");
            return { pid, filename: info.filename, drillbackurl: info.drillbackurl };
          } catch {
            return { pid };
          }
        })
      );
      setLinkedItems(details);
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
  }, [open, loadLinked, mainPid]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="bg-blue-600 text-white hover:bg-blue-700"
        disabled={!mainPid}
        onClick={() => setOpen(true)}
        title={mainPid ? "Verlinkte Dokumente anzeigen" : "Kein Hauptdokument ausgewählt"}
      >
        <LinkIcon className="mr-2 h-4 w-4" /> Verlinkte Dokumente
      </Button>

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
                  : "Keine verlinkten Dokumente gefunden."
                : "Kein Hauptdokument (PID) vorhanden."}
            </DialogDescription>
          </DialogHeader>

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
                        <div className="min-w-0">
                          <div className="text-sm font-medium break-words">
                            {it.filename ?? "Dateiname unbekannt"}
                          </div>
                          <div className="text-xs text-muted-foreground break-words" title={it.pid}>
                            {it.pid}
                          </div>
                        </div>
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
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </TooltipProvider>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LinkedDocumentsDialog;