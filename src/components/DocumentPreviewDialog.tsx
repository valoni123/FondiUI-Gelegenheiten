"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type DocumentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url?: string;
  title?: string;
};

const DocumentPreviewDialog: React.FC<DocumentPreviewDialogProps> = ({ open, onOpenChange, url, title }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title || "Vorschau"}</DialogTitle>
        </DialogHeader>
        {url ? (
          <ScrollArea className="max-h-[70vh]">
            <div className="flex items-center justify-center bg-muted/30 p-2">
              <img
                src={url}
                alt={title || "Dokumentvorschau"}
                className="max-h-[68vh] w-auto rounded border bg-white"
              />
            </div>
          </ScrollArea>
        ) : (
          <div className="text-sm text-muted-foreground">Keine Vorschau verfügbar.</div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreviewDialog;