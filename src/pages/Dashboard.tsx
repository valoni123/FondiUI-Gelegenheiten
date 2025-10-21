import React from "react";
import AppTile from "@/components/AppTile";
import { Users, Box, LayoutGrid } from "lucide-react";

const Dashboard: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
      {/* Header with logo and subtitle */}
      <div className="px-6 pt-6">
        <div className="flex items-start">
          <img
            src="/fondiui-logo.png"
            alt="FONDIUI"
            className="w-40 sm:w-52 object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="mt-1 text-sm sm:text-base font-semibold text-muted-foreground">
          FONDIUM USER INTERFACE
        </div>
      </div>

      {/* Tiles grid */}
      <div className="flex w-full items-center justify-center">
        <div className="mt-16 sm:mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
          <AppTile title="GELEGENHEITEN" icon={Users} to="/opportunities" colorClass="text-blue-600" />
          <AppTile title="APP 2" icon={LayoutGrid} disabled />
          <AppTile title="APP 3" icon={Box} disabled />
        </div>
      </div>

      {/* Decorative wave at the bottom */}
      {/* Full-page decorative background (transparent PNG scaled larger) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 -z-10 opacity-80"
        style={{
          backgroundImage: "url('/fondiui-background-transparent.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center bottom",
          // Scale the image larger than the page so the wave spans across the whole view
          backgroundSize: "160% auto",
        }}
      />
    </div>
  );
};

export default Dashboard;