"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Upload, FileWarning, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileDropzone, { FileDropzoneHandle } from "./FileDropzone";
import { showSuccess } from "@/utils/toast";
import { searchIdmItemsByEntityJson, type IdmDocPreview, updateIdmItemAttributes } from "@/api/idm";
import { toast } from "@/components/ui/use-toast";
import { type CloudEnvironment } from "@/authorization/configLoader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import DocAttributesGrid from "./DocAttributesGrid";
import { replaceIdmItemResource } from "@/api/idm";

interface RightPanelProps {
  selectedOpportunityId: string;
  onClose: () => void;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  entityNames: string[];
}

const RightPanel: React.FC<RightPanelProps> = ({
  selectedOpportunityId,
  onClose,
  authToken,
  cloudEnvironment,
  entityNames,
}) => {
  const [files, setFiles] = React.useState<File[]>([]);
  const dropzoneRef = React.useRef<FileDropzoneHandle | null>(null);

  const [docPreviews, setDocPreviews] = React.useState<IdmDocPreview[]>([]);
  const [isPreviewsLoading, setIsPreviewsLoading] = React.useState<boolean>(false);

  const [isFullPreviewDialogOpen, setIsFullPreviewDialogOpen] = React.useState(false);
  const [fullPreviewData, setFullPreviewData] = React.useState<{ url: string; contentType: string } | null>(null);
  const [isFullPreviewLoading, setIsFullPreviewLoading] = React.useState(false);

  // ADD: helper to reload previews for the current opportunity
  const reloadPreviews = React.useCallback(async () => {
    if (!selectedOpportunityId || !authToken || !entityNames?.length) return;
    setIsPreviewsLoading(true);
    try {
      const results = await Promise.allSettled(
        entityNames.map((name) =>
          searchIdmItemsByEntityJson(authToken, cloudEnvironment, selectedOpportunityId, name)
        )
      );
      const merged: IdmDocPreview[] = [];
      results.forEach((r) => {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          merged.push(...r.value);
        }
      });
      setDocPreviews(merged);
    } finally {
      setIsPreviewsLoading(false);
    }
  }, [selectedOpportunityId, authToken, cloudEnvironment, entityNames]);

  // keep existing useEffect for initial load
  React.useEffect(() => {
    let cancelled = false;
    const loadPreviews = async () => {
      if (!selectedOpportunityId || !authToken || !entityNames?.length) {
        setDocPreviews([]);
        return;
      }
      setIsPreviewsLoading(true);
      try {
        const results = await Promise.allSettled(
          entityNames.map((name) =>
            searchIdmItemsByEntityJson(authToken, cloudEnvironment, selectedOpportunityId, name)
          )
        );
        if (cancelled) return;
        const merged: IdmDocPreview[] = [];
        results.forEach((r) => {
          if (r.status === "fulfilled" && Array.isArray(r.value)) {
            merged.push(...r.value);
          }
        });
        setDocPreviews(merged);
      } finally {
        if (!cancelled) setIsPreviewsLoading(false);
      }
    };
    loadPreviews();
    return () => { cancelled = true; };
  }, [selectedOpportunityId, authToken, cloudEnvironment, entityNames]);

  // DEBUG: Log component mount/unmount
  React.useEffect(() => {
    console.log("[RightPanel] Component MOUNTED");
    return () => console.log("[RightPanel] Component UNMOUNTED");
  }, []);

  // DEBUG: Log prop changes
  React.useEffect(() => {
    console.log("[RightPanel] Props changed:", {
      selectedOpportunityId,
      authToken: authToken ? "PRESENT" : "MISSING",
      cloudEnvironment,
      entityNames,
    });
  }, [selectedOpportunityId, authToken, cloudEnvironment, entityNames]);

  const openFullPreview = (doc: IdmDocPreview) => {
    const url = doc.fullUrl || doc.smallUrl;
    const contentType = doc.contentType || (doc.fullUrl ? "image/*" : "image/*");
    if (!url) return;

    setIsFullPreviewLoading(true);
    setIsFullPreviewDialogOpen(true);
    setFullPreviewData({ url, contentType });
    // No extra fetch here; we directly show presigned URL
    setIsFullPreviewLoading(false);
  };

  // ADD: Save handler
  const handleSaveRow = async (
    doc: IdmDocPreview,
    updates: { name: string; value: string }[]
  ) => {
    if (!doc.pid) return { ok: false, errorAttributes: [] };
    try {
      await updateIdmItemAttributes(authToken, cloudEnvironment, doc.pid, updates);
      toast({ 
        title: (
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" />
            Änderungen gespeichert
          </span>
        ), 
        variant: "success" 
      });
      // reload previews so updated values appear immediately
      await reloadPreviews();
      return { ok: true };
    } catch (err: any) {
      // Extrahiere message und detail aus XML-Fehlerantwort
      const xml = err.message || "";
      const messageMatch = xml.match(/<message>(.*?)<\/message>/i);
      const detailMatch = xml.match(/<detail>(.*?)<\/detail>/i);
      const userMsg = messageMatch?.[1] || "Fehler beim Speichern";
      const userDetail = detailMatch?.[1] || "";

      // Versuche, den fehlerhaften Attributnamen aus <detail> zu extrahieren (z. B. "Attribute name: Werk, ...")
      const detailText = userDetail || "";
      const attrNameMatch = detailText.match(/Attribute name:\s*([^,]+)/i);
      const failedAttr = attrNameMatch?.[1]?.trim();
      const failedAttrs = failedAttr ? [failedAttr] : undefined;

      toast({ 
        title: (
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 text-white" />
            {userMsg}
          </span>
        ), 
        description: userDetail,
        variant: "destructive" 
      });
      return { ok: false, errorAttributes: failedAttrs };
    }
  };

  // ADD: Replace handler
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

  const handleReplaceDoc = async (doc: IdmDocPreview, file: File) => {
    if (!doc.pid) return false;
    try {
      const base64 = await fileToBase64(file);
      await replaceIdmItemResource(authToken, cloudEnvironment, doc.pid, {
        filename: file.name,
        base64,
      });
      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" />
            Dokument ersetzt
          </span>
        ),
        variant: "success",
      });
      await reloadPreviews();
      return true;
    } catch (err: any) {
      const errorText = String(err?.message ?? err ?? "Unbekannter Fehler");
      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 text-white" />
            Ersetzen fehlgeschlagen
          </span>
        ),
        description: errorText,
        variant: "destructive",
      });
      return false;
    }
  };

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const toAdd = incoming.filter(
        (f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`)
      );
      const combined = [...prev, ...toAdd];
      if (toAdd.length) {
        showSuccess(`${toAdd.length} Datei(en) hinzugefügt`);
      }
      return combined;
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Gelegenheit - Anhänge</h3>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dateien auswählen"
            onClick={() => dropzoneRef.current?.open()}
            className="h-8 w-8"
            title="Dateien hochladen"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Schließen"
            title="Schließen"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="flex-grow flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-muted-foreground">
            Auswahl: {selectedOpportunityId}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="min-h-0">
            {isPreviewsLoading ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Vorschauen werden geladen…
              </div>
            ) : docPreviews.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Keine Vorschauen gefunden.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {docPreviews.map((doc, idx) => (
                  <div
                    key={`${doc.smallUrl}-${idx}`}
                    className="group relative flex h-40 items-center justify-center overflow-hidden rounded-md border bg-accent/30 cursor-pointer"
                    onClick={() => openFullPreview(doc)}
                    title={doc.filename || "Vorschau öffnen"}
                  >
                    {doc.smallUrl ? (
                      <img
                        src={doc.smallUrl}
                        alt={doc.filename || `Vorschau ${idx + 1}`}
                        className="max-h-full max-w-full object-contain transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <FileWarning className="h-10 w-10 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Keine SmallPreview</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.filename || doc.entityName || "Dokument"}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 bg-white/80 hover:bg-white text-black opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFullPreview(doc);
                      }}
                      title="Details anzeigen"
                    >
                      <ChevronLeft className="h-3 w-3 rotate-180" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <FileDropzone ref={dropzoneRef} onFilesAdded={addFiles} />

          <div className="min-h-0 flex-1">
            <DocAttributesGrid
              docs={docPreviews}
              onOpenFullPreview={openFullPreview}
              onSaveRow={handleSaveRow}
              onReplaceDoc={handleReplaceDoc}
            />
          </div>
        </CardContent>
      </Card>

      {/* Full Preview Dialog */}
      <Dialog open={isFullPreviewDialogOpen} onOpenChange={setIsFullPreviewDialogOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Vollständige Vorschau</DialogTitle>
            <DialogDescription>
              {selectedOpportunityId ? `Vorschau für: ${selectedOpportunityId}` : "Vorschau"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            {isFullPreviewLoading ? (
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" /> Vorschau wird geladen…
              </div>
            ) : fullPreviewData ? (
              fullPreviewData.contentType?.startsWith("image/") ? (
                <img
                  src={fullPreviewData.url}
                  alt="Vollständige Vorschau"
                  className="max-h-full max-w-full object-contain"
                />
              ) : fullPreviewData.contentType === "application/pdf" ? (
                <iframe
                  src={fullPreviewData.url}
                  title="Vollständige PDF-Vorschau"
                  className="w-full h-full border-none"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <FileWarning className="h-16 w-16" />
                  <span className="text-lg">Dateityp für Vorschau nicht unterstützt.</span>
                  <a
                    href={fullPreviewData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-base"
                  >
                    Dokument in neuem Tab öffnen
                  </a>
                </div>
              )
            ) : (
              <div className="text-muted-foreground">Keine vollständige Vorschau verfügbar.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RightPanel;