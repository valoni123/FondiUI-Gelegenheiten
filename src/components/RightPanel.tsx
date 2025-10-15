"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Upload, FileText, FileWarning, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileDropzone, { FileDropzoneHandle } from "./FileDropzone";
import { showSuccess, showError } from "@/utils/toast";
import { searchIdmItemsForOpportunityUnion, type IdmDocPreview } from "@/api/idm";
import { type CloudEnvironment } from "@/authorization/configLoader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

  React.useEffect(() => {
    let cancelled = false;

    const loadPreviews = async () => {
      if (!selectedOpportunityId || !authToken || !entityNames?.length) {
        setDocPreviews([]);
        return;
      }
      setIsPreviewsLoading(true);
      try {
        const previews = await searchIdmItemsForOpportunityUnion(
          authToken,
          cloudEnvironment,
          selectedOpportunityId,
          entityNames
        );
        if (cancelled) return;
        setDocPreviews(previews);
      } catch (e) {
        console.error("Failed to load IDM union previews", e);
        if (!cancelled) {
          setDocPreviews([]);
          showError("Konnte die Vorschauen aus IDM nicht laden.");
        }
      } finally {
        if (!cancelled) setIsPreviewsLoading(false);
      }
    };

    loadPreviews();
    return () => {
      cancelled = true;
    };
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

      <Card className="flex-grow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-muted-foreground">
            Auswahl: {selectedOpportunityId}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-56px)] flex-col gap-4">
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
                  </div>
                ))}
              </div>
            )}
          </div>

          <FileDropzone ref={dropzoneRef} onFilesAdded={addFiles} />

          <div className="min-h-0 flex-1">
            <ScrollArea className="h-full w-full pr-4">
              {files.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Noch keine Dateien hochgeladen.
                </div>
              ) : (
                <ul className="divide-y">
                  {files.map((file, idx) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}-${idx}`} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
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