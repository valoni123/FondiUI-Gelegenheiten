"use client";

import React from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ReplacementDropzoneProps = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  className?: string;
};

const ReplacementDropzone: React.FC<ReplacementDropzoneProps> = ({
  onFileSelected,
  disabled = false,
  className,
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelected(f);
  };

  const onBrowse = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileSelected(f);
    // reset the input so the same file can be selected again if needed
    e.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (disabled) return;
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center",
        isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
      role="button"
      aria-disabled={disabled}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) onBrowse();
      }}
    >
      <Upload className="h-6 w-6 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm">
          Datei hierher ziehen oder
          <Button variant="link" className="px-1 py-0 h-auto align-baseline" onClick={onBrowse}>
            klicken
          </Button>
          zum Auswählen.
        </p>
        <p className="text-xs text-muted-foreground">Es wird genau eine Datei akzeptiert.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="*/*"
        onChange={onChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
};

export default ReplacementDropzone;