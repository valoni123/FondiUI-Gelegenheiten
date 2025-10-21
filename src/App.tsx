import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SettingsButton from "./components/SettingsButton";
import React, { useState, useEffect } from "react";
import { CloudEnvironment } from "./authorization/configLoader";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";

const queryClient = new QueryClient();

const App = () => {
  // Initialize company number from localStorage or a default
  const [companyNumber, setCompanyNumber] = useState<string>(
    localStorage.getItem("companyNumber") || "1000" // Default to "1000"
  );

  // Initialize cloud environment from localStorage or a default
  const [cloudEnvironment, setCloudEnvironment] = useState<CloudEnvironment>("FONDIUM_TRN");

  // Save company number to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("companyNumber", companyNumber);
  }, [companyNumber]);

  // Save cloud environment to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cloudEnvironment", cloudEnvironment);
  }, [cloudEnvironment]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem("oauthAccessToken"));

  useEffect(() => {
    const handler = () => {
      setIsAuthenticated(!!localStorage.getItem("oauthAccessToken"));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const handleSaveCompanyNumber = (newCompanyNumber: string) => {
    setCompanyNumber(newCompanyNumber);
  };

  const handleSaveCloudEnvironment = (newEnvironment: CloudEnvironment) => {
    setCloudEnvironment(newEnvironment);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SettingsButton
            currentCompanyNumber={companyNumber}
            onSaveCompanyNumber={handleSaveCompanyNumber}
            currentCloudEnvironment={cloudEnvironment}
            onSaveCloudEnvironment={handleSaveCloudEnvironment}
          />
          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Index companyNumber={companyNumber} cloudEnvironment={cloudEnvironment} />
                ) : (
                  <Login cloudEnvironment={cloudEnvironment} />
                )
              }
            />
            <Route path="/login" element={<Login cloudEnvironment={cloudEnvironment} />} />
            <Route path="/callback" element={<OAuthCallback />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;