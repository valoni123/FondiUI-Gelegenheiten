"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, FileWarning, Loader2, Check, X, ArrowLeftRight, ChevronRight, Trash2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileDropzone, { FileDropzoneHandle } from "./FileDropzone";
import { showSuccess } from "@/utils/toast";
import { searchIdmItemsByEntityJson, type IdmDocPreview, updateIdmItemAttributes } from "@/api/idm";
import { toast } from "@/components/ui/use-toast";
import { type CloudEnvironment } from "@/authorization/configLoader";
import {
  Dialog,
  DialogContent,
  DialogHeader, // Keep DialogHeader import for other uses if any, but not used directly here
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import DocAttributesGrid from "./DocAttributesGrid";
import { replaceIdmItemResource, deleteIdmItem } from "@/api/idm";
import ReplacementDropzone from "@/components/ReplacementDropzone"; // Import ReplacementDropzone
import UploadDialog from "@/components/UploadDialog"; // Import UploadDialog
import LinkDocumentsDialog from "@/components/LinkDocumentsDialog"; // Import LinkDocumentsDialog
import LinkedDocumentsDialog from "@/components/LinkedDocumentsDialog";
import BackToOverviewButton from "./BackToOverviewButton";

interface RightPanelProps {
  selectedOpportunityId: string;
  onClose: () => void;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  entityNames: string[];
  selectedOpportunityProject?: string; // New optional prop
}

const RightPanel: React.FC<RightPanelProps> = ({
  selectedOpportunityId,
  onClose,
  authToken,
  cloudEnvironment,
  entityNames,
  selectedOpportunityProject, // Destructure new prop
}) => {
  const [files, setFiles] = React.useState<File[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
  const dropzoneRef = React.useRef<FileDropzoneHandle | null>(null);

  const [docPreviews, setDocPreviews] = React.useState<IdmDocPreview[]>([]);
  const [isPreviewsLoading, setIsPreviewsLoading] = React.useState<boolean>(false);

  const [isFullPreviewDialogOpen, setIsFullPreviewDialogOpen] = React.useState(false);
  const [fullPreviewData, setFullPreviewData] = React.useState<IdmDocPreview | null>(null);
  const [isFullPreviewLoading, setIsFullPreviewLoading] = React.useState(false);
  // ADD: track current index in docPreviews
  const [fullPreviewIndex, setFullPreviewIndex] = React.useState<number | null>(null);

  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = React.useState(false); // New state for replace dialog
  const [isReplacing, setIsReplacing] = React.useState(false); // New state for replacement loading
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false); // Confirm delete in preview
  const [isLinkDialogOpen, setIsLinkDialogOpen] = React.useState(false); // New state for link dialog

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
    setFullPreviewData(doc);
    setIsFullPreviewDialogOpen(true);
    // compute index in current docPreviews
    const byPid = docPreviews.findIndex((d) => d.pid && d.pid === doc.pid);
    let idx = byPid;
    if (idx < 0) {
      idx = docPreviews.findIndex((d) => d.smallUrl === doc.smallUrl && d.filename === doc.filename);
    }
    if (idx < 0) {
      idx = docPreviews.findIndex((d) => d.filename === doc.filename);
    }
    setFullPreviewIndex(idx >= 0 ? idx : null);
    setIsFullPreviewLoading(false);
  };

  // Keep index in sync if the list or doc changes (e.g., after replacements or reloads)
  React.useEffect(() => {
    if (!fullPreviewData) {
      setFullPreviewIndex(null);
      return;
    }
    const byPid = docPreviews.findIndex((d) => d.pid && d.pid === fullPreviewData.pid);
    let idx = byPid;
    if (idx < 0) {
      idx = docPreviews.findIndex(
        (d) => d.smallUrl === fullPreviewData.smallUrl && d.filename === fullPreviewData.filename
      );
    }
    if (idx < 0) {
      idx = docPreviews.findIndex((d) => d.filename === fullPreviewData.filename);
    }
    setFullPreviewIndex(idx >= 0 ? idx : null);
  }, [docPreviews, fullPreviewData]);

  // Navigation handlers
  const goToPrev = React.useCallback(() => {
    if (fullPreviewIndex == null) return;
    const prevIdx = fullPreviewIndex - 1;
    if (prevIdx >= 0) {
      const doc = docPreviews[prevIdx];
      if (doc) {
        setFullPreviewData(doc);
        setFullPreviewIndex(prevIdx);
      }
    }
  }, [fullPreviewIndex, docPreviews]);

  const goToNext = React.useCallback(() => {
    if (fullPreviewIndex == null) return;
    const nextIdx = fullPreviewIndex + 1;
    if (nextIdx < docPreviews.length) {
      const doc = docPreviews[nextIdx];
      if (doc) {
        setFullPreviewData(doc);
        setFullPreviewIndex(nextIdx);
      }
    }
  }, [fullPreviewIndex, docPreviews]);

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

  // DELETE handler
  const handleDeleteDoc = async (doc: IdmDocPreview) => {
    if (!doc.pid) return false;
    try {
      await deleteIdmItem(authToken, cloudEnvironment, doc.pid);
      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" />
            Dokument gelöscht
          </span>
        ),
        variant: "success",
      });
      // If the deleted doc is currently open in full preview, close it
      if (fullPreviewData?.pid && fullPreviewData.pid === doc.pid) {
        setIsFullPreviewDialogOpen(false);
      }
      await reloadPreviews();
      return true;
    } catch (err: any) {
      const errorText = String(err?.message ?? err ?? "Unbekannter Fehler");
      toast({
        title: (
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 text-white" />
            Löschen fehlgeschlagen
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
        setIsUploadDialogOpen(true); // OPEN dialog when new files are added
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
      <div className="mb-4 flex items-center">
        <h3 className="text-lg font-semibold">Gelegenheit - Anhänge</h3>
      </div>

      <div className="flex justify-end mb-3">
        <BackToOverviewButton />
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

          {/* Upload Dialog for new files */}
          <UploadDialog
            open={isUploadDialogOpen}
            onOpenChange={(open) => {
              setIsUploadDialogOpen(open);
              if (!open) {
                // Clear pending files when dialog closes so reopening starts fresh
                setFiles([]);
              }
            }}
            files={files}
            entityNames={entityNames}
            authToken={authToken}
            cloudEnvironment={cloudEnvironment}
            onCompleted={async () => {
              // Clear files and refresh previews
              setFiles([]);
              await reloadPreviews();
            }}
            defaultOpportunityNumber={selectedOpportunityId} // pass 'M000...' to prefill "Gelegenheit"
            defaultProjectName={selectedOpportunityProject} // NEW: prefill "Projekt"
          />

          <div className="min-h-0 flex-1">
            <DocAttributesGrid
              docs={docPreviews}
              onOpenFullPreview={openFullPreview}
              onSaveRow={handleSaveRow}
              onReplaceDoc={handleReplaceDoc}
              onDeleteDoc={handleDeleteDoc}
              authToken={authToken}
              cloudEnvironment={cloudEnvironment}
            />
          </div>
        </CardContent>
      </Card>

      {/* Full Preview Dialog */}
      <Dialog open={isFullPreviewDialogOpen} onOpenChange={setIsFullPreviewDialogOpen}>
        <DialogContent className="max-w-6xl sm:max-w-7xl h-[90vh] flex flex-col">
          {/* Custom header area with title, description, and replace button */}
          <div className="flex flex-col pb-4">
            <div className="flex flex-col">
              <DialogTitle>Vollständige Vorschau</DialogTitle>
              <DialogDescription>
                {fullPreviewData?.filename ? `Vorschau für: ${fullPreviewData.filename}` : "Vorschau"}
              </DialogDescription>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                {fullPreviewData && (
                  <>
                    <LinkedDocumentsDialog
                      authToken={authToken}
                      cloudEnvironment={cloudEnvironment}
                      mainPid={fullPreviewData?.pid}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => setIsLinkDialogOpen(true)}
                      title="Dokument(e) verlinken"
                    >
                      <LinkIcon className="mr-2 h-4 w-4" /> Dokument(e) verlinken
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-orange-500 text-white hover:bg-orange-600"
                      onClick={() => setIsReplaceDialogOpen(true)}
                      title="Dokument ersetzen"
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" /> Dokument ersetzen
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      title="Dokument löschen"
                      className="text-white"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Dokument löschen
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {typeof fullPreviewIndex === "number" && docPreviews.length > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Dokument {(fullPreviewIndex ?? 0) + 1}/{docPreviews.length}
                    </span>
                    <div className="flex items-center">
                      {fullPreviewIndex > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={goToPrev}
                          title="Vorheriges Dokument"
                          aria-label="Vorheriges Dokument"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                      )}
                      {fullPreviewIndex < docPreviews.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={goToNext}
                          title="Nächstes Dokument"
                          aria-label="Nächstes Dokument"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* The actual preview content */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            {isFullPreviewLoading ? (
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" /> Vorschau wird geladen…
              </div>
            ) : fullPreviewData ? (
              fullPreviewData.contentType?.startsWith("image/") ? (
                <img
                  src={fullPreviewData.fullUrl || fullPreviewData.smallUrl}
                  alt="Vollständige Vorschau"
                  className="max-h-full max-w-full object-contain"
                />
              ) : fullPreviewData.contentType === "application/pdf" ? (
                <iframe
                  src={fullPreviewData.fullUrl || fullPreviewData.smallUrl}
                  title="Vollständige PDF-Vorschau"
                  className="w-full h-full border-none"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <FileWarning className="h-16 w-16" />
                  <span className="text-lg">Dateityp für Vorschau nicht unterstützt.</span>
                  <a
                    href={fullPreviewData.fullUrl || fullPreviewData.smallUrl}
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

          {/* DocAttributesGrid for the current document */}
          {fullPreviewData && (
            <div className="flex-shrink-0 max-h-56 md:max-h-72 overflow-y-auto mt-4 border-t pt-4 px-6">
              <DocAttributesGrid
                docs={[fullPreviewData]} // Pass the single document as an array
                onOpenFullPreview={openFullPreview} // Pass the existing handler
                onSaveRow={handleSaveRow} // Pass the existing handler
                onReplaceDoc={handleReplaceDoc} // Pass the existing handler
                hideSaveAllButton={true} // New prop to hide the "Save All" button
                onDeleteDoc={handleDeleteDoc}
                authToken={authToken}
                cloudEnvironment={cloudEnvironment}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Replacement Dialog for Full Preview */}
      <Dialog
        open={isReplaceDialogOpen}
        onOpenChange={(open) => {
          if (!open || !isReplacing) setIsReplaceDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument ersetzen</DialogTitle>
            <DialogDescription>
              Legen Sie eine Datei ab oder klicken Sie, um eine neue Datei auszuwählen.
              {fullPreviewData?.filename && ` (Aktuelles Dokument: ${fullPreviewData.filename})`}
            </DialogDescription>
          </DialogHeader>
          <ReplacementDropzone
            disabled={isReplacing}
            onFileSelected={async (file) => {
              if (!fullPreviewData) return;
              setIsReplacing(true);
              const ok = await handleReplaceDoc(fullPreviewData, file);
              setIsReplacing(false);
              if (ok) {
                setIsReplaceDialogOpen(false);
                setIsFullPreviewDialogOpen(false); // Close full preview after successful replacement
              }
            }}
          />
          <div className="flex justify-end">
            <Button variant="ghost" disabled={isReplacing} onClick={() => setIsReplaceDialogOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog for Full Preview */}
      <Dialog
        open={isConfirmDeleteOpen}
        onOpenChange={(open) => setIsConfirmDeleteOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soll das Dokument wirklich gelöscht werden?</DialogTitle>
            <DialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsConfirmDeleteOpen(false)}>
              nein
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setIsConfirmDeleteOpen(false);
                if (fullPreviewData) {
                  await handleDeleteDoc(fullPreviewData);
                }
              }}
            >
              ja
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LinkDocumentsDialog
        open={isLinkDialogOpen}
        onOpenChange={setIsLinkDialogOpen}
        authToken={authToken}
        cloudEnvironment={cloudEnvironment}
        mainPid={fullPreviewData?.pid}
        mainEntityName={fullPreviewData?.entityName}
        onConfirm={async (selected) => {
          toast({
            title: "Verlinkung gestartet",
            description: `Ausgewählter Typ: ${selected.desc || selected.name}`,
            variant: "success",
          });
        }}
      />

      {/* REMOVED: SharePoint popup dialog */}
    </div>
  );
};

export default RightPanel;