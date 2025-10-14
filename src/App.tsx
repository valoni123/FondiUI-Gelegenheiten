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

const queryClient = new QueryClient();

const App = () => {
  // Initialize company number from localStorage or a default
  const [companyNumber, setCompanyNumber] = useState<string>(
    localStorage.getItem("companyNumber") || "1000" // Default to "1000"
  );

  // Initialize cloud environment from localStorage or a default
  const [cloudEnvironment, setCloudEnvironment] = useState<CloudEnvironment>(
    (localStorage.getItem("cloudEnvironment") as CloudEnvironment) || "GAC_DEM" // Default to "GAC_DEM"
  );

  // Save company number to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("companyNumber", companyNumber);
  }, [companyNumber]);

  // Save cloud environment to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cloudEnvironment", cloudEnvironment);
  }, [cloudEnvironment]);

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
            <Route path="/" element={<Index companyNumber={companyNumber} cloudEnvironment={cloudEnvironment} />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;