import React from "react";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface AppTileProps {
  title: string;
  to?: string;
  icon: IconType;
  colorClass?: string; // e.g., 'text-blue-600'
  disabled?: boolean;
}

const AppTile: React.FC<AppTileProps> = ({ title, to, icon: Icon, colorClass = "text-blue-600", disabled = false }) => {
  const content = (
    <Card
      className={cn(
        "group relative flex h-44 w-44 sm:h-52 sm:w-52 flex-col items-center justify-center rounded-xl border shadow-sm transition-all",
        disabled ? "opacity-70 cursor-not-allowed" : "hover:shadow-md hover:border-accent"
      )}
    >
      <div className={cn("w-12 h-[3px] rounded-full mb-3", disabled ? "bg-gray-300" : "bg-blue-600")} />
      <Icon className={cn("h-8 w-8 sm:h-10 sm:w-10 mb-3", disabled ? "text-gray-400" : colorClass)} />
      <div className={cn("text-xs sm:text-sm font-medium tracking-wide", disabled ? "text-muted-foreground" : "text-foreground")}>
        {title}
      </div>

      {disabled && (
        <div className="absolute bottom-2 text-[10px] text-muted-foreground">Coming soon</div>
      )}
    </Card>
  );

  if (disabled || !to) {
    return <div aria-disabled className="select-none">{content}</div>;
  }

  return (
    <Link to={to} className="select-none">
      {content}
    </Link>
  );
};

export default AppTile;