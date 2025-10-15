"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileDropzone, { FileDropzoneHandle } from "./FileDropzone";
import { showSuccess } from "@/utils/toast";
import { showError } from "@/utils/toast";
import { getIdmThumbnailForOpportunity } from "@/api/idm";
import { type CloudEnvironment } from "@/authorization/configLoader";
import { FileWarning } from "lucide-react";

interface RightPanelProps {
  selectedOpportunityId: string;
  onClose: () => void;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
}

const RightPanel: React.FC<RightPanelProps> = ({ selectedOpportunityId, onClose, authToken, cloudEnvironment }) => {
  const [files, setFiles] = React.useState<File[]>([]);
  const dropzoneRef = React.useRef<FileDropzoneHandle | null>(null);
  const [thumbnailData, setThumbnailData] = React.useState<{ url: string; contentType: string } | null>(null);
  const [isThumbLoading, setIsThumbLoading] = React.useState<boolean>(false);
  const lastThumbUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const loadThumb = async () => {
      if (!selectedOpportunityId || !authToken) {
        if (lastThumbUrlRef.current) {
          URL.revokeObjectURL(lastThumbUrlRef.current);
          lastThumbUrlRef.current = null;
        }
        setThumbnailData(null);
        return;
      }
      setIsThumbLoading(true);
      try {
        const data = await getIdmThumbnailForOpportunity(
          authToken,
          cloudEnvironment,
          selectedOpportunityId
        );
        if (cancelled) return;

        if (lastThumbUrlRef.current) {
          URL.revokeObjectURL(lastThumbUrlRef.current);
          lastThumbUrlRef.current = null;
        }

        if (data) {
          setThumbnailData(data);
          lastThumbUrlRef.current = data.url; // Store the object URL for revoking
        } else {
          setThumbnailData(null);
        }
      } catch (e) {
        console.error("Failed to load IDM thumbnail", e);
        setThumbnailData(null);
        showError("Konnte die Vorschau aus IDM nicht laden.");
      } finally {
        if (!cancelled) setIsThumbLoading(false);
      }
    };

    loadThumb();

    return () => {
      cancelled = true;
      if (lastThumbUrlRef.current) {
        URL.revokeObjectURL(lastThumbUrlRef.current);
        lastThumbUrlRef.current = null;
      }
    };
  }, [selectedOpportunityId, authToken, cloudEnvironment]);

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    setFiles((prev) => {
      // Deduplicate by name + size + lastModified to avoid duplicates on re-select
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
          <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-md border bg-accent/30">
            {isThumbLoading ? (
              <div className="text-sm text-muted-foreground">Vorschau wird geladen…</div>
            ) : thumbnailData ? (
              thumbnailData.contentType.startsWith('image/') ? (
                <img
                  src={thumbnailData.url}
                  alt={`Vorschau zu ${selectedOpportunityId}`}
                  className="max-h-full max-w-full object-contain"
                />
              ) : thumbnailData.contentType === 'application/pdf' ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">PDF-Dokument</span>
                  <a
                    href={thumbnailData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Dokument öffnen
                  </a>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileWarning className="h-12 w-12 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Dateityp nicht unterstützt</span>
                  <a
                    href={thumbnailData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Dokument öffnen
                  </a>
                </div>
              )
            ) : (
              <div className="text-sm text-muted-foreground">Keine Vorschau gefunden.</div>
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
    </div>
  );
};

export default RightPanel;