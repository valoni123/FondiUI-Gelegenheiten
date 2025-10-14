"use client";

import React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileDropzoneHandle {
  open: () => void;
}

interface FileDropzoneProps {
  onFilesAdded: (files: File[]) => void;
  className?: string;
}

const FileDropzone = React.forwardRef<FileDropzoneHandle, FileDropzoneProps>(
  ({ onFilesAdded, className }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const handleBrowse = () => {
      inputRef.current?.click();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length) onFilesAdded(files);
      // reset input so selecting the same file again still triggers change
      e.target.value = "";
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) onFilesAdded(files);
    };

    React.useImperativeHandle(ref, () => ({
      open: handleBrowse,
    }));

    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Dateien hochladen"
        onClick={handleBrowse}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleBrowse();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-background/50 text-center transition-colors",
          "hover:border-primary/50 hover:bg-accent/30",
          isDragging && "border-primary ring-2 ring-primary/20",
          className
        )}
      >
        <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          Dateien hierher ziehen oder klicken, um hochzuladen
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }
);

FileDropzone.displayName = "FileDropzone";

export default FileDropzone;