"use client";

import React from "react";

const ForegroundBackground: React.FC = () => {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 opacity-40">
      <img
        src="/fondiui-background.jpg"
        alt=""
        className="w-full h-full object-cover select-none"
        draggable={false}
      />
    </div>
  );
};

export default ForegroundBackground;