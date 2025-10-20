"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

interface UserBadgeProps {
  username: string | null;
  className?: string;
}

const UserBadge: React.FC<UserBadgeProps> = ({ username, className }) => {
  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <User className="h-4 w-4 text-muted-foreground" />
      <Badge variant="secondary" className="text-xs">
        Angemeldet als: {username ?? "Unbekannt"}
      </Badge>
    </div>
  );
};

export default UserBadge;