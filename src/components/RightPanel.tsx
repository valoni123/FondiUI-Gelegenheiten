"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileDropzone, { FileDropzoneHandle } from "./FileDropzone";
import { showSuccess } from "@/utils/toast";

interface RightPanelProps {
  selectedOpportunityId: string;
  onClose: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ selectedOpportunityId, onClose }) => {
  const [files, setFiles] = React.useState<File[]>([]);
  const dropzoneRef = React.useRef<FileDropzoneHandle | null>(null);

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