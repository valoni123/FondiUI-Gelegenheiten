"use client";

import React from "react";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({ title = "Gelegenheiten", subtitle = "FONDIUM USER INTERFACE" }) => {
  return (
    <header className="w-full mb-6">
      <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-b-md">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-start py-5">
            <div className="flex items-center gap-4 ml-0">
              {/* Small logo card */}
              <div className="flex items-center">
                <div className="flex items-center justify-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm w-14 h-14 relative overflow-hidden">
                  {/* Blue top accent */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
                  <div className="flex items-center justify-center z-10 w-full h-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-transparent text-blue-600">
                        <Users className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <div className="ml-3 hidden sm:block">
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
                    {title.toUpperCase()}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {subtitle}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right side intentionally left empty so header stays left-aligned */}
            <div className="flex-1" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;