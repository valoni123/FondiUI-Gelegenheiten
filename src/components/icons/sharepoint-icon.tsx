"use client";

import React from "react";

type SharePointIconProps = {
  className?: string;
};

const SharePointIcon: React.FC<SharePointIconProps> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Background rounded square in SharePoint blue */}
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#0078D4" />
      {/* Overlapping circle accent */}
      <circle cx="8" cy="12" r="6" fill="#106EBE" opacity="0.9" />
      {/* Stylized 'S' glyph */}
      <path
        d="M9 9.5c0-2.2 2-3.7 4.3-3.7h1.2c1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2h-2.8c-1 0-1.8.8-1.8 1.8s.8 1.8 1.8 1.8h3.6c1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2h-1.2c-2.6 0-4.9-1.6-4.9-3.8"
        fill="#ffffff"
      />
    </svg>
  );
};

export default SharePointIcon;