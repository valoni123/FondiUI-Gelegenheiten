import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import SettingsButton from "./components/SettingsButton";
import UserStatus from "./components/UserStatus";
import React, { useState, useEffect } from "react";
import { CloudEnvironment } from "./authorization/configLoader";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";

const queryClient = new QueryClient();

// Fade transition component
const FadeTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setIsAnimating(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [children]);

  return (
    <div
      className={`transition-opacity duration-300 ${
        isAnimating ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {displayChildren}
    </div>
  );
};

const App = () => {
  // Initialize company number from localStorage or a default
  const [companyNumber, setCompanyNumber] = useState<string>(
    localStorage.getItem("companyNumber") || "7000" // Default to "7000"
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

  // Ensure company is set to 7000 after successful login
  useEffect(() => {
    if (isAuthenticated) {
      const savedCompany = localStorage.getItem("companyNumber");
      if (savedCompany !== "7000") {
        setCompanyNumber("7000");
        localStorage.setItem("companyNumber", "7000");
      }
    }
  }, [isAuthenticated]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
            <UserStatus isAuthenticated={isAuthenticated} cloudEnvironment={cloudEnvironment} />
            <SettingsButton
              currentCompanyNumber={companyNumber}
              onSaveCompanyNumber={handleSaveCompanyNumber}
              currentCloudEnvironment={cloudEnvironment}
              onSaveCloudEnvironment={handleSaveCloudEnvironment}
            />
          </div>
          <FadeTransition>
            <Routes>
              <Route
                path="/"
                element={
                  isAuthenticated ? (
                    <Dashboard />
                  ) : (
                    <Login cloudEnvironment={cloudEnvironment} />
                  )
                }
              />
              <Route
                path="/fondiumapps"
                element={
                  isAuthenticated ? (
                    <Dashboard />
                  ) : (
                    <Login cloudEnvironment={cloudEnvironment} />
                  )
                }
              />
              <Route
                path="/opportunities"
                element={<Index companyNumber={companyNumber} cloudEnvironment={cloudEnvironment} />}
              />
              <Route path="/login" element={<Login cloudEnvironment={cloudEnvironment} />} />
              <Route path="/callback" element={<OAuthCallback />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </FadeTransition>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;