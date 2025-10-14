"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RightPanelProps {
  selectedOpportunityId: string | null;
  onClose: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ selectedOpportunityId, onClose }) => {
  if (!selectedOpportunityId) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800">
        <p className="text-sm text-muted-foreground text-center">
          Select an opportunity to view details
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Opportunity Details</h3>
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
          <CardTitle>Related Information</CardTitle>
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
              <p>This panel will show more information about the selected opportunity.</p>
              <p>You can add widgets, related documents, or other relevant data here.</p>
              <p>For example, a small image gallery, activity feed, or contact details.</p>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default RightPanel;