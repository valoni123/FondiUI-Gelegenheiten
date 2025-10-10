import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight } from "lucide-react";
import { getActiveBusinessPartners, BusinessPartner } from "@/api/businessPartners";
import { toast } from "sonner";
import BusinessPartnerGrid from "./BusinessPartnerGrid"; // Import the new grid component

interface BusinessPartnerSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (businessPartner: BusinessPartner) => void;
  authToken: string;
}

const BusinessPartnerSelectDialog: React.FC<BusinessPartnerSelectDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  authToken,
}) => {
  const [businessPartners, setBusinessPartners] = useState<BusinessPartner[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && authToken) {
      const fetchPartners = async () => {
        setIsLoading(true);
        const loadingToastId = toast.loading("Loading business partners...");
        try {
          const partners = await getActiveBusinessPartners(authToken);
          setBusinessPartners(partners);
          toast.success("Business partners loaded!", { id: loadingToastId });
        } catch (error) {
          console.error("Failed to fetch business partners:", error);
          toast.error("Failed to load business partners.", { id: loadingToastId });
        } finally {
          setIsLoading(false);
        }
      };
      fetchPartners();
    }
  }, [isOpen, authToken]);

  const handleSelectPartner = (partner: BusinessPartner) => {
    onSelect(partner);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] lg:max-w-[1200px] h-[90vh] flex flex-col"> {/* Increased width and height */}
        <DialogHeader>
          <DialogTitle>Select Business Partner</DialogTitle>
          <DialogDescription>
            Search and select an active business partner from the list below.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 flex-grow overflow-hidden"> {/* Allow content to grow and scroll */}
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