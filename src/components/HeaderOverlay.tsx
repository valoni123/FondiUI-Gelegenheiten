"use client";

import React from "react";
import { useLocation } from "react-router-dom";
import UserStatus from "./UserStatus";
import SettingsButton from "./SettingsButton";
import { CloudEnvironment } from "@/authorization/configLoader";

interface HeaderOverlayProps {
  isAuthenticated: boolean;
  cloudEnvironment: CloudEnvironment;
  currentCompanyNumber: string;
  onSaveCompanyNumber: (newCompanyNumber: string) => void;
  onSaveCloudEnvironment: (newEnvironment: CloudEnvironment) => void;
}

const HeaderOverlay: React.FC<HeaderOverlayProps> = ({
  isAuthenticated,
  cloudEnvironment,
  currentCompanyNumber,
  onSaveCompanyNumber,
  onSaveCloudEnvironment,
}) => {
  const location = useLocation();
  // Hide overlay when path is a deep link like /M0000007
  const isDeepLink = /^\/M\d+$/i.test(location.pathname);

  if (isDeepLink) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      <UserStatus isAuthenticated={isAuthenticated} cloudEnvironment={cloudEnvironment} />
      <SettingsButton
        currentCompanyNumber={currentCompanyNumber}
        onSaveCompanyNumber={onSaveCompanyNumber}
        currentCloudEnvironment={cloudEnvironment}
        onSaveCloudEnvironment={onSaveCloudEnvironment}
      />
    </div>
  );
};

export default HeaderOverlay;