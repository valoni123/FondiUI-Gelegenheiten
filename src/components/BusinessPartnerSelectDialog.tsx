import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getActiveBusinessPartners, BusinessPartner } from "@/api/businessPartners";
import { toast } from "sonner";
import BusinessPartnerGrid from "./BusinessPartnerGrid";
import { useDebounce } from "@/hooks/use-debounce";

interface BusinessPartnerSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (businessPartner: BusinessPartner) => void;
  authToken: string;
  companyNumber: string;
}

const BusinessPartnerSelectDialog: React.FC<BusinessPartnerSelectDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  authToken,
  companyNumber,
}) => {
  const [businessPartners, setBusinessPartners] = useState<BusinessPartner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const fetchPartners = useCallback(async (term: string) => {
    if (!authToken || !companyNumber) return;

    setIsLoading(true);
    const loadingToastId = toast.loading("Loading business partners...");
    try {
      const partners = await getActiveBusinessPartners(authToken, companyNumber, term);
      setBusinessPartners(partners);
      toast.success("Business partners loaded!", { id: loadingToastId });
    } catch (error) {
      console.error("Failed to fetch business partners:", error);
      toast.error("Failed to load business partners.", { id: loadingToastId });
    } finally {
      setIsLoading(false);
    }
  }, [authToken, companyNumber]);

  useEffect(() => {
    if (isOpen) {
      fetchPartners(debouncedSearchTerm);
    }
  }, [isOpen, debouncedSearchTerm, fetchPartners]);

  const handleSelectPartner = (partner: BusinessPartner) => {
    onSelect(partner);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] lg:max-w-[1200px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Business Partner</DialogTitle>
          <DialogDescription>
            Search and select an active business partner from the list below.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 flex-shrink-0">
          <Input
            placeholder="Search by ID or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex-grow overflow-hidden">
          {isLoading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : (
            <ScrollArea className="h-full w-full rounded-md border">
              <BusinessPartnerGrid
                businessPartners={businessPartners}
                onSelect={handleSelectPartner}
              />
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessPartnerSelectDialog;