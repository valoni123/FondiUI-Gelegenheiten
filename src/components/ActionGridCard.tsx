"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PackageOpen, PlusCircle, CheckCircle2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface ActionItem {
  key: string;
  label: string;
  icon: IconType;
  colorClass: string;
}

const actions: ActionItem[] = [
  { key: "materialentnahme", label: "Materialentnahme", icon: PackageOpen, colorClass: "text-indigo-600" },
  { key: "zusatzverbrauch", label: "Zusatzverbrauch", icon: PlusCircle, colorClass: "text-amber-600" },
  { key: "abschliessen", label: "Abschließen", icon: CheckCircle2, colorClass: "text-emerald-600" },
  { key: "mengenmeldung", label: "Mengenmeldung", icon: ClipboardList, colorClass: "text-blue-600" },
];

const ActionGridCard: React.FC = () => {
  const handleClick = (item: ActionItem) => {
    toast(`Aktion: ${item.label}`, { description: "Funktion kommt bald." });
  };

  return (
    <Card
      className={cn(
        "group relative flex h-44 w-44 sm:h-52 sm:w-52 flex-col rounded-xl border shadow-sm transition-all",
        "hover:shadow-md hover:border-accent"
      )}
    >
      <div className="flex-1 p-3 sm:p-4">
        <div className="w-12 h-[3px] rounded-full mb-2 sm:mb-3 bg-blue-600" />
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {actions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleClick(item)}
                className="flex flex-col items-center justify-center rounded-lg border border-muted-foreground/10 bg-muted/20 hover:bg-muted/40 transition-colors p-2 sm:p-3"
              >
                <Icon className={cn("h-6 w-6 sm:h-7 sm:w-7", item.colorClass)} />
                <span className="mt-1 text-[10px] sm:text-xs font-medium text-muted-foreground text-center">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-2 left-0 right-0 text-[10px] text-center text-muted-foreground">
        Aktionen
      </div>
    </Card>
  );
};

export default ActionGridCard;