"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RightPanelProps {
  selectedOpportunityId: string; // Now guaranteed to be a string when rendered
  onClose: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ selectedOpportunityId, onClose }) => {
  // The parent component (Index.tsx) now handles conditional rendering,
  // so selectedOpportunityId is guaranteed to be non-null here.

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Gelegenheit - Anhänge</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <Card className="flex-grow">
        <CardHeader>
          <CardTitle></CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-80px)]">
          <ScrollArea className="h-full w-full pr-4">
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Details for selected opportunity:{" "}
                <span className="font-semibold text-foreground">
                  {selectedOpportunityId}
                </span>
              </p>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default RightPanel;