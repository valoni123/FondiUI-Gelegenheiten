"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GreetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GreetingDialog: React.FC<GreetingDialogProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hallo Robert</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end mt-4">
          <Button onClick={() => onOpenChange(false)}>OK</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GreetingDialog;