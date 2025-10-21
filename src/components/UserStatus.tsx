"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, LogOut } from "lucide-react";
import { toast } from "sonner";
import type { CloudEnvironment } from "@/authorization/configLoader";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { revokeAccessToken } from "@/authorization/authService";

interface UserStatusProps {
  isAuthenticated: boolean;
  cloudEnvironment: CloudEnvironment;
}

interface MeResponse {
  displayName?: string;
  profilePicture?: {
    cdnPathMediumImage?: string;
  };
  name?: {
    givenName?: string;
    familyName?: string;
  };
  title?: string;
  department?: string;
  email?: string;
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

  const user = raw?.response?.userlist?.[0];
  const displayName =
    user?.displayName ||
    (user?.name?.givenName && user?.name?.familyName ? `${user.name.givenName} ${user.name.familyName}` : undefined) ||
    "Unbekannter Benutzer";
  const profilePicture = user?.profilePicture;
  const name = user?.name;
  const title = user?.title ?? "";
  const department = user?.department ?? "";
  const email = user?.userName ?? "";

  return { displayName, profilePicture, name, title, department, email };
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

  const handleLogout = async () => {
    try {
      const currentToken = localStorage.getItem("oauthAccessToken") || "";
      if (currentToken) {
        await revokeAccessToken(cloudEnvironment, currentToken);
      }
    } catch (e) {
      console.warn("Logout revoke failed:", e);
    } finally {
      localStorage.removeItem("oauthAccessToken");
      localStorage.removeItem("oauthExpiresAt");
      sessionStorage.removeItem("pkce_verifier");
      toast.success("Abgemeldet.");
      // Force route update and fresh auth state recalculation
      window.location.href = "/login";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur px-3 py-2 shadow border border-gray-200 dark:border-gray-700 cursor-pointer"
          aria-label="Benutzerinformationen öffnen"
        >
          <Avatar className="h-8 w-8">
            {data?.profilePicture?.cdnPathMediumImage ? (
              <AvatarImage src={data.profilePicture.cdnPathMediumImage} alt={data?.displayName ?? "Benutzer"} />
            ) : (
              <AvatarFallback className="bg-orange-500/20 text-orange-600 dark:text-orange-400">
                <UserIcon className="h-4 w-4" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {isLoading ? "Lade Benutzer ..." : (data?.displayName && data.displayName.length > 0 ? data.displayName : "Unbekannter Benutzer")}
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95"
      >
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            {data?.profilePicture?.cdnPathMediumImage ? (
              <AvatarImage src={data.profilePicture.cdnPathMediumImage} alt={data?.displayName ?? "Benutzer"} />
            ) : (
              <AvatarFallback className="bg-orange-500/20 text-orange-600 dark:text-orange-400">
                <UserIcon className="h-5 w-5" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="text-sm">
            <div className="font-semibold text-gray-900 dark:text-gray-100">{data?.displayName ?? "-"}</div>
            <div className="text-gray-500 dark:text-gray-400">{data?.email ?? "-"}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Vorname</div>
            <Input disabled value={data?.name?.givenName ?? "-"} />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nachname</div>
            <Input disabled value={data?.name?.familyName ?? "-"} />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Titel</div>
            <Input disabled value={data?.title ?? "-"} />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Abteilung</div>
            <Input disabled value={data?.department ?? "-"} />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">E-Mail</div>
            <Input disabled value={data?.email ?? "-"} />
          </div>
        </div>

        <div className="mt-4">
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:bg-red-50 cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserStatus;