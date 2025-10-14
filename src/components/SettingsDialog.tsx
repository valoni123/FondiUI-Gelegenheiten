import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompanyNumber: string;
  onSave: (newCompanyNumber: string) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  currentCompanyNumber,
  onSave,
}) => {
  const [companyNumberInput, setCompanyNumberInput] = useState(currentCompanyNumber);

  useEffect(() => {
    setCompanyNumberInput(currentCompanyNumber);
  }, [currentCompanyNumber]);

  const handleSave = () => {
    onSave(companyNumberInput);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Application Settings</DialogTitle>
          <DialogDescription>
            Manage application-wide settings here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="company-number" className="text-right">
              Company Number
            </Label>
            <Input
              id="company-number"
              value={companyNumberInput}
              onChange={(e) => setCompanyNumberInput(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;