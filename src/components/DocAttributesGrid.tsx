"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, FileWarning } from "lucide-react";
import { type IdmDocPreview } from "@/api/idm";

interface DocAttributesGridProps {
  docs: IdmDocPreview[];
  onRowClick?: (doc: IdmDocPreview) => void;
}

const DocAttributesGrid: React.FC<DocAttributesGridProps> = ({ docs, onRowClick }) => {
  if (!docs || docs.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        <FileWarning className="h-4 w-4 mr-2" />
        Keine Dokumente vorhanden.
      </div>
    );
  }

  const handleRowClick = (doc: IdmDocPreview) => {
    if (onRowClick) {
      onRowClick(doc);
    }
  };

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Dateiname</TableHead>
            <TableHead>Entität</TableHead>
            <TableHead>Größe</TableHead>
            <TableHead>Typ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((doc, idx) => (
            <TableRow 
              key={`${doc.smallUrl}-${idx}`} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleRowClick(doc)}
            >
              <TableCell>
                {doc.smallUrl ? (
                  <img
                    src={doc.smallUrl}
                    alt={doc.filename || `Vorschau ${idx + 1}`}
                    className="w-8 h-8 object-cover rounded"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell className="font-medium">{doc.filename || "Unbenannt"}</TableCell>
              <TableCell>{doc.entityName || "-"}</TableCell>
              <TableCell>{doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : "-"}</TableCell>
              <TableCell>{doc.contentType || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
};

export default DocAttributesGrid;