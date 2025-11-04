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
import { ExternalLink, AlertTriangle } from "lucide-react";

interface SharePointFrameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

const SharePointFrameDialog: React.FC<SharePointFrameDialogProps> = ({ open, onOpenChange, url }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setLoaded(false);
      setBlocked(false);
      return;
    }
    const t = setTimeout(() => {
      // If the iframe hasn't signaled load after a short delay, assume it's blocked by CSP
      if (!loaded) setBlocked(true);
    }, 1500);
    return () => clearTimeout(t);
  }, [open, loaded]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl sm:max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>SharePoint</DialogTitle>
          <DialogDescription>
            {blocked
              ? "Embedding is blocked by SharePoint's security policy. Please open the link in a new tab."
              : "The SharePoint folder is displayed below. Some sites may block embedding in iframes; if so, use the button to open in a new tab."}
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
          {blocked ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                This SharePoint site refuses to load inside an iframe due to its Content Security Policy.
              </p>
              <Button asChild className="bg-teal-600 text-white hover:bg-teal-700">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open SharePoint in new tab
                </a>
              </Button>
            </div>
          ) : (
            <iframe
              src={url}
              title="SharePoint"
              className="w-full h-full border-none"
              onLoad={() => setLoaded(true)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharePointFrameDialog;