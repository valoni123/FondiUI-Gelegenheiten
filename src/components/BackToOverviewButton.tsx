"use client";

import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

type Props = {
  className?: string;
  label?: string;
  onBack?: () => void;
};

const BackToOverviewButton: React.FC<Props> = ({ className, label = "Zur Übersicht", onBack }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    navigate("/opportunities");
  };

  return (
    <Button onClick={handleClick} className={className || ""}>
      <ChevronLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
};

export default BackToOverviewButton;