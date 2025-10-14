import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import SettingsDialog from "./SettingsDialog";

interface SettingsButtonProps {
  currentCompanyNumber: string;
  onSaveCompanyNumber: (newCompanyNumber: string) => void;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({
  currentCompanyNumber,
  onSaveCompanyNumber,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50"
        onClick={() => setIsDialogOpen(true)}
        aria-label="Open settings"
      >
        <Settings className="h-6 w-6" />
      </Button>
      <SettingsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        currentCompanyNumber={currentCompanyNumber}
        onSave={onSaveCompanyNumber}
      />
    </>
  );
};

export default SettingsButton;