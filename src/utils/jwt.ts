"use client";

export interface JwtPayload {
  [key: string]: any;
  sub?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  upn?: string;
}

/**
 * Einfaches Dekodieren eines JWT-Payloads ohne Signaturprüfung.
 * Gibt null zurück, wenn das Token nicht im erwarteten Format vorliegt.
 */
export const parseJwt = (token: string): JwtPayload | null => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};