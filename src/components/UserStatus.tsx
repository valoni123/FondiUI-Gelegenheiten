"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import type { CloudEnvironment } from "@/authorization/configLoader";

interface UserStatusProps {
  isAuthenticated: boolean;
  cloudEnvironment: CloudEnvironment;
}

interface MeResponse {
  displayName?: string;
  profilePicture?: {
    cdnPathMediumImage?: string;
  };
}

const fetchMe = async (cloudEnvironment: CloudEnvironment, token: string): Promise<MeResponse> => {
  const url = `https://mingle-ionapi.eu1.inforcloudsuite.com/${cloudEnvironment}/ifsservice/usermgt/v2/users/me`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Fehler beim Laden des Benutzerprofils (${res.status})`);
  }

  const raw = await res.json();

  // Extract displayName and profilePicture from the nested userlist structure
  const user = raw?.response?.userlist?.[0];
  const displayName = user?.displayName || 
                     user?.name?.givenName + " " + user?.name?.familyName ||
                     "Unbekannter Benutzer";
  const profilePicture = user?.profilePicture;

  return { displayName, profilePicture };
};

const UserStatus: React.FC<UserStatusProps> = ({ isAuthenticated, cloudEnvironment }) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("oauthAccessToken") || "" : "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["me", cloudEnvironment, token],
    queryFn: () => fetchMe(cloudEnvironment, token),
    enabled: isAuthenticated && !!token,
    staleTime: 5 * 60 * 1000,
  });

  if (isError && error instanceof Error) {
    toast.error(error.message);
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur px-3 py-2 shadow border border-gray-200 dark:border-gray-700">
      <Avatar className="h-8 w-8">
        {data?.profilePicture?.cdnPathMediumImage ? (
          <AvatarImage src={data.profilePicture.cdnPathMediumImage} alt={data.displayName} />
        ) : (
          <AvatarFallback className="bg-orange-500/20 text-orange-600 dark:text-orange-400">
            <UserIcon className="h-4 w-4" />
          </AvatarFallback>
        )}
      </Avatar>
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {isLoading ? "Lade Benutzer ..." : (data?.displayName && data.displayName.length > 0 ? data.displayName : "Unbekannter Benutzer")}
      </div>
    </div>
  );
};

export default UserStatus;