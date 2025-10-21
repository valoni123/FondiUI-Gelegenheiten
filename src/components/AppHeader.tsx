"use client";

import React from "react";
import { Users, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({ title = "Gelegenheiten", subtitle = "FONDIUM USER INTERFACE" }) => {
  // apps stored in localStorage under "availableApps".
  // Supported formats:
  // - JSON array of strings: ["App 2", "App 3"]
  // - JSON array of objects: [{ title: "App 2", to: "/app2", disabled: false }, ...]
  const [apps, setApps] = React.useState<{ title: string; to?: string; disabled?: boolean }[]>([]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("availableApps");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map((p) =>
          typeof p === "string" ? { title: p } : { title: String(p.title ?? p.name ?? ""), to: p.to, disabled: !!p.disabled }
        );
        setApps(normalized.filter((a) => a.title && a.title.toLowerCase() !== (title || "").toLowerCase()));
      }
    } catch {
      // ignore parsing errors
    }
  }, [title]);

  return (
    <header className="w-full mb-6">
      <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-b-md">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-start py-5">
            <div className="flex items-center gap-4 ml-0">
              {/* Small logo card */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-3 focus:outline-none"
                    aria-label="Open apps menu"
                  >
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
                        <div className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide inline-flex items-center gap-2">
                          {title.toUpperCase()}
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {subtitle}
                        </div>
                      </div>
                    </div>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent sideOffset={8} align="start" className="w-56">
                  {apps.length === 0 ? (
                    <DropdownMenuItem className="text-sm opacity-70">Keine anderen Apps</DropdownMenuItem>
                  ) : (
                    apps.map((app, i) => (
                      <DropdownMenuItem
                        key={app.title + i}
                        className={cn("text-sm", app.disabled && "opacity-50 pointer-events-none")}
                        onClick={() => {
                          if (app.to) {
                            // preserve normal navigation behavior
                            window.location.href = app.to;
                          } else {
                            // If no path provided, just close menu (no-op)
                          }
                        }}
                      >
                        {app.title}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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