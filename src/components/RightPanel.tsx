"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RightPanelProps {
  selectedOpportunityId: string;
}

const RightPanel: React.FC<RightPanelProps> = ({ selectedOpportunityId }) => {
  return (
    <div className="h-full flex flex-col p-4">
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