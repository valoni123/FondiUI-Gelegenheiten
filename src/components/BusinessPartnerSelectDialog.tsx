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

interface BusinessPartnerSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (businessPartnerId: string) => void;
  authToken: string;
}

const BusinessPartnerSelectDialog: React.FC<BusinessPartnerSelectDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  authToken,
}) => {
  const [businessPartners, setBusinessPartners] = useState<BusinessPartner[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredPartners = businessPartners.filter(
    (partner) =>
      partner.BusinessPartner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.Name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectPartner = (partnerId: string) => {
    onSelect(partnerId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Business Partner</DialogTitle>
          <DialogDescription>
            Search and select an active business partner from the list below.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Input
            placeholder="Search by ID or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          {isLoading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : (
            <ScrollArea className="h-[300px] w-full rounded-md border">
              <div className="p-4">
                {filteredPartners.length > 0 ? (
                  filteredPartners.map((partner) => (
                    <div
                      key={partner.BusinessPartner}
                      className="flex items-center justify-between py-2 border-b last:border-b-0"
                    >
                      <div>
                        <p className="font-medium">{partner.Name}</p>
                        <p className="text-sm text-muted-foreground">ID: {partner.BusinessPartner}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSelectPartner(partner.BusinessPartner)}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground">No business partners found.</p>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessPartnerSelectDialog;