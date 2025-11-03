"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Link as LinkIcon } from "lucide-react";
import { getExistingLinkedPids, getIdmItemByPid } from "@/api/idm";
import { toast } from "@/components/ui/use-toast";
import { type CloudEnvironment } from "@/authorization/configLoader";

type LinkedDocumentsPopoverProps = {
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  mainPid?: string;
};

const LinkedDocumentsPopover: React.FC<LinkedDocumentsPopoverProps> = ({
  authToken,
  cloudEnvironment,
  mainPid,
}) => {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  type LinkedItem = { pid: string; filename?: string };
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
            return { pid, filename: info.filename };
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-700"
          disabled={!mainPid}
          title={mainPid ? "Verlinkte Dokumente anzeigen" : "Kein Hauptdokument ausgewählt"}
        >
          <LinkIcon className="mr-2 h-4 w-4" /> Verlinkte Dokumente
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        {!mainPid ? (
          <div className="text-sm text-muted-foreground">Kein Hauptdokument (PID) vorhanden.</div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verlinkungen werden geladen…
          </div>
        ) : linkedItems.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine verlinkten Dokumente gefunden.</div>
        ) : (
          <div>
            <div className="text-sm font-medium mb-2">Verlinkte Dokumente ({linkedItems.length})</div>
            <ScrollArea className="max-h-60">
              <ul className="space-y-2">
                {linkedItems.map((it) => (
                  <li key={it.pid} className="rounded-md bg-muted px-3 py-2">
                    <div className="text-sm font-medium break-words">
                      {it.filename ?? "Dateiname unbekannt"}
                    </div>
                    <div className="text-xs text-muted-foreground break-words" title={it.pid}>
                      {it.pid}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default LinkedDocumentsPopover;