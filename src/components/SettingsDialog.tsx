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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloudEnvironment } from "@/authorization/configLoader";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompanyNumber: string;
  onSaveCompanyNumber: (newCompanyNumber: string) => void;
  currentCloudEnvironment: CloudEnvironment;
  onSaveCloudEnvironment: (newEnvironment: CloudEnvironment) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  currentCompanyNumber,
  onSaveCompanyNumber,
  currentCloudEnvironment,
  onSaveCloudEnvironment,
}) => {
  const [companyNumberInput, setCompanyNumberInput] = useState(currentCompanyNumber);
  const [cloudEnvironmentInput, setCloudEnvironmentInput] = useState<CloudEnvironment>(currentCloudEnvironment);

  useEffect(() => {
    setCompanyNumberInput(currentCompanyNumber);
  }, [currentCompanyNumber]);

  useEffect(() => {
    setCloudEnvironmentInput(currentCloudEnvironment);
  }, [currentCloudEnvironment]);

  const handleSave = () => {
    onSaveCompanyNumber(companyNumberInput);
    onSaveCloudEnvironment(cloudEnvironmentInput);
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cloud-environment" className="text-right">
              Cloud Environment
            </Label>
            <Select
              value={cloudEnvironmentInput}
              onValueChange={(value: CloudEnvironment) => setCloudEnvironmentInput(value)}
            >
              <SelectTrigger id="cloud-environment" className="col-span-3">
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GAC_DEM">GAC - DEM Cloud</SelectItem>
                <SelectItem value="FONDIUM_TRN">FON - TRN Cloud</SelectItem>
              </SelectContent>
            </Select>
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