"use client";

import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type Props = {
  className?: string;
  label?: string;
};

const BackToOverviewButton: React.FC<Props> = ({ className, label = "Zur Übersicht" }) => {
  const navigate = useNavigate();
  return (
    <Button
      onClick={() => navigate("/opportunities")}
      className={`bg-orange-500 hover:bg-orange-600 text-white ${className || ""}`}
    >
      {label}
    </Button>
  );
};

export default BackToOverviewButton;