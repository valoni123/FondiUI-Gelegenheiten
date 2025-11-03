"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface SharePointFrameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

const SharePointFrameDialog: React.FC<SharePointFrameDialogProps> = ({ open, onOpenChange, url }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl sm:max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>SharePoint</DialogTitle>
          <DialogDescription>
            The SharePoint folder is displayed below. Some sites may block embedding in iframes; if so, use the button to open in a new tab.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end pb-2">
          <Button variant="outline" size="sm" className="bg-teal-600 text-white hover:bg-teal-700" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer" title="Open in new tab">
              <ExternalLink className="mr-2 h-4 w-4" /> Open in new tab
            </a>
          </Button>
        </div>

        <div className="flex-1 overflow-hidden rounded border">
          <iframe
            src={url}
            title="SharePoint"
            className="w-full h-full border-none"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharePointFrameDialog;