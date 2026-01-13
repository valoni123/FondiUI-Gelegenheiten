"use client";

import React from "react";
import { Navigate, useLocation } from "react-router-dom";

type ProtectedRouteProps = {
  children: React.ReactElement;
};

const isTokenValid = (): boolean => {
  const token = localStorage.getItem("oauthAccessToken");
  const expiresAtRaw = localStorage.getItem("oauthExpiresAt");
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;
  return !!token && !!expiresAt && Date.now() < expiresAt;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();

  if (!isTokenValid()) {
    const redirectTarget = `${location.pathname}${location.search || ""}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;