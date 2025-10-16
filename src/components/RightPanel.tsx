"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload } from "lucide-react";
import { CloudEnvironment } from "@/authorization/configLoader";
import UploadDialog from "@/components/UploadDialog"; // Corrected import

interface RightPanelProps {
  selectedOpportunityId: string;
  onClose: () => void;
  authToken: string;
  cloudEnvironment: CloudEnvironment;
  entityNames: string[]; // New prop
  onUploadCompleted: () => void; // New prop
}

const RightPanel: React.FC<RightPanelProps> = ({
  selectedOpportunityId,
  onClose,
  authToken,
  cloudEnvironment,
  entityNames,
  onUploadCompleted,
}) => {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]); // State to hold files for upload

  const handleOpenUploadDialog = () => {
    // In a real scenario, you might have a file input here or a dropzone
    // For now, we'll just open the dialog.
    // If you want to integrate a file drop, you'd set filesToUpload here.
    setFilesToUpload([]); // Clear previous files, or pass specific files if available
    setIsUploadDialogOpen(true);
  };

  const handleUploadDialogClose = () => {
    setIsUploadDialogOpen(false);
    setFilesToUpload([]); // Clear files after dialog closes
  };

  const handleUploadCompleted = () => {
    onUploadCompleted(); // Notify parent to reload opportunities
    handleUploadDialogClose(); // Close the dialog
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 p-4 border-l border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Details für Gelegenheit: {selectedOpportunityId}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-grow overflow-y-auto">
        {/* Content for the right panel goes here */}
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Hier könnten weitere Details zur ausgewählten Gelegenheit angezeigt werden.
        </p>
        <Button onClick={handleOpenUploadDialog} className="mt-4">
          <Upload className="mr-2 h-4 w-4" /> Dokumente hochladen
        </Button>
      </div>

      {/* Render the UploadDialog */}
      <UploadDialog
        open={isUploadDialogOpen}
        onOpenChange={handleUploadDialogClose}
        files={filesToUpload} // Pass the files to upload
        entityNames={entityNames}
        authToken={authToken}
        cloudEnvironment={cloudEnvironment}
        onCompleted={handleUploadCompleted}
        selectedOpportunityId={selectedOpportunityId} // Pass the selected opportunity ID
      />
    </div>
  );
};

export default RightPanel;