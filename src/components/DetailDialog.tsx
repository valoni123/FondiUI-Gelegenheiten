import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Item } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar"; // Import Calendar
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Search, CalendarIcon } from "lucide-react"; // Import Search and CalendarIcon
import BusinessPartnerSelectDialog from "./BusinessPartnerSelectDialog";
import { BusinessPartner, getBusinessPartnerById } from "@/api/businessPartners";
import { cn } from "@/lib/utils"; // Import cn for conditional classNames
import { format } from "date-fns"; // Import format from date-fns

interface DetailDialogProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Item) => void;
  isAddingNewItem: boolean;
  opportunityStatusOptions: string[];
  authToken: string;
}

const DetailDialog: React.FC<DetailDialogProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
  isAddingNewItem,
  opportunityStatusOptions,
  authToken,
}) => {
  const [editedItem, setEditedItem] = useState<Item | null>(null);
  const [isBpSelectDialogOpen, setIsBpSelectDialogOpen] = useState(false);
  const [soldToBpName, setSoldToBpName] = useState<string | null>(null);

  useEffect(() => {
    if (isAddingNewItem) {
      setEditedItem({
        id: "",
        name: "",
        description: "",
        quantity: 0,
        SoldtoBusinessPartner: "",
        SoldtoBusinessPartnerName: "",
        BusinessPartnerStatus: "Active", // Default for new item
        AssignedTo: "",
        Type: "",
        Source: "",
        FirstContactDate: "",
        ExpectedCompletionDate: "",
        ActualCompletionDate: "",
        Status: opportunityStatusOptions.length > 0 ? opportunityStatusOptions[0] : "", // Default status
        SalesProcess: "",
        Phase: "",
        ProbabilityPercentage: 0,
        Reason: "",
        IncludeInForecast: false,
        ExpectedRevenue: 0,
        WeightedRevenue: 0,
        ItemRevenue: 0,
        CreatedBy: "",
        CreationDate: "",
        LastModifiedBy: "",
        LastTransactionDate: "",
      });
      setSoldToBpName(null);
    } else {
      setEditedItem(item);
      if (item?.SoldtoBusinessPartner && authToken) {
        const fetchBpName = async () => {
          try {
            const bp = await getBusinessPartnerById(authToken, item.SoldtoBusinessPartner);
            setSoldToBpName(bp?.Name || null);
          } catch (error) {
            console.error("Failed to fetch business partner name:", error);
            setSoldToBpName(null);
          }
        };
        fetchBpName();
      } else {
        setSoldToBpName(null);
      }
    }
  }, [item, isAddingNewItem, authToken, opportunityStatusOptions]);

  const handleChange = (field: string, value: string | number | boolean) => {
    if (editedItem) {
      setEditedItem({ ...editedItem, [field]: value });
    }
  };

  const handleSave = () => {
    if (editedItem) {
      onSave(editedItem);
      onClose();
    }
  };

  const handleSelectBusinessPartner = (bp: BusinessPartner) => {
    handleChange("SoldtoBusinessPartner", bp.BusinessPartner);
    setSoldToBpName(bp.Name);
  };

  if (!editedItem) return null;

  // Define the order and type of fields for the structured layout
  const structuredFields = {
    general: [
      { key: "description", label: "Allgemeine Daten", type: "textarea" },
      { key: "SoldtoBusinessPartner", label: "Kunde", type: "businessPartner" },
      { key: "BusinessPartnerStatus", label: "Handelspartnerstatus", type: "text", disabled: true, defaultValue: "Active" },
      { key: "AssignedTo", label: "Zugewiesen an", type: "text", hasSearch: true, hasAssignButton: true },
    ],
    classification: [
      { key: "Type", label: "Art", type: "text", hasSearch: true, defaultValue: "100" },
      { key: "Source", label: "Quelle", type: "text", hasSearch: true },
    ],
    dates: [
      { key: "FirstContactDate", label: "Erster Kontakt am", type: "date" },
      { key: "ExpectedCompletionDate", label: "Erwartetes Abschlussdatum", type: "date" },
      { key: "ActualCompletionDate", label: "Tatsächliches Abschlussdatum", type: "date" },
    ],
    progress: [
      { key: "Status", label: "Status", type: "select", options: opportunityStatusOptions },
      { key: "SalesProcess", label: "VK-Ablauf", type: "text", hasSearch: true },
      { key: "Phase", label: "Phase", type: "text", hasSearch: true },
      { key: "ProbabilityPercentage", label: "Wahrscheinlichkeitsprozentsatz", type: "number", suffix: "%" },
      { key: "Reason", label: "Grund", type: "text", hasSearch: true },
    ],
    forecast: [
      { key: "IncludeInForecast", label: "In Prognose berücksichtigen", type: "checkbox" },
      { key: "ExpectedRevenue", label: "Erwartete Erlöse", type: "number", hasSearch: true, suffix: "EUR", isRequired: true },
      { key: "WeightedRevenue", label: "Gewichteter Erlös", type: "number", disabled: true, suffix: "EUR" },
      { key: "ItemRevenue", label: "Artikelerlös", type: "number", disabled: true, suffix: "EUR" },
    ],
    user: [
      { key: "CreatedBy", label: "Erstellt von", type: "text", disabled: true },
      { key: "CreationDate", label: "Erstellt am", type: "datetime", disabled: true },
      { key: "LastModifiedBy", label: "Zuletzt geändert von", type: "text", disabled: true },
      { key: "LastTransactionDate", label: "Zuletzt geändert am", type: "datetime", disabled: true },
    ],
  };

  // Collect all keys that are part of the structured layout
  const structuredKeys = new Set<string>();
  Object.values(structuredFields).forEach(section => {
    section.forEach(field => structuredKeys.add(field.key));
  });

  // Filter out structured keys and internal OData keys for the "Other Details" section
  const otherKeys = Object.keys(editedItem).filter(key =>
    !structuredKeys.has(key) &&
    key !== "id" &&
    key !== "name" && // 'name' is implicitly handled by 'description' for 'Allgemeine Daten'
    key !== "@odata.etag" &&
    key !== "@odata.context"
  ).sort();

  const renderField = (fieldConfig: typeof structuredFields.general[0]) => {
    const { key, label, type, disabled, options, hasSearch, hasAssignButton, suffix, isRequired, defaultValue } = fieldConfig;
    const value = editedItem[key] !== null && editedItem[key] !== undefined ? editedItem[key] : (isAddingNewItem ? defaultValue : "");

    const commonInputProps = {
      id: key,
      className: "w-full",
      placeholder: `Enter ${label.toLowerCase()}`,
      disabled: disabled || key === "Opportunity" || key === "Guid", // Always disable Opportunity/Guid
    };

    switch (type) {
      case "textarea":
        return (
          <Textarea
            {...commonInputProps}
            value={String(value)}
            onChange={(e) => handleChange(key, e.target.value)}
            rows={3}
          />
        );
      case "select":
        return (
          <Select
            value={String(value)}
            onValueChange={(val) => handleChange(key, val)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${label}`} />
            </SelectTrigger>
            <SelectContent>
              {options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "date":
        const dateValue = value ? new Date(value) : undefined;
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateValue && "text-muted-foreground"
                )}
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateValue ? format(dateValue, "dd.MM.yyyy") : <span>{label}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={(date) => handleChange(key, date ? format(date, "yyyy-MM-dd") : "")}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      case "datetime":
        const dateTimeValue = value ? new Date(value) : undefined;
        return (
          <Input
            {...commonInputProps}
            value={dateTimeValue ? format(dateTimeValue, "dd.MM.yyyy HH:mm") : ""}
            disabled={true} // Always disabled for Created/Modified dates
          />
        );
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={key}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleChange(key, checked)}
              disabled={disabled}
            />
            <Label htmlFor={key}>{label}</Label>
          </div>
        );
      case "businessPartner":
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <Input
                {...commonInputProps}
                value={String(value)}
                onChange={(e) => {
                  handleChange(key, e.target.value);
                  setSoldToBpName(null);
                }}
                className="pr-10 w-full"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsBpSelectDialogOpen(true)}
                aria-label={`Select ${label}`}
                className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {soldToBpName && editedItem[key] && (
              <p className="text-sm text-muted-foreground whitespace-nowrap">{soldToBpName}</p>
            )}
          </div>
        );
      case "number":
      case "text":
      default:
        return (
          <div className="flex items-center gap-2">
            <Input
              {...commonInputProps}
              type={type === "number" ? "number" : "text"}
              value={String(value)}
              onChange={(e) => handleChange(key, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
              className={cn(hasSearch && "pr-10", suffix && "pr-12")}
            />
            {suffix && <span className="text-sm text-muted-foreground absolute right-2">{suffix}</span>}
            {hasSearch && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => console.log(`Search for ${key}`)} // Placeholder for search
                aria-label={`Search ${label}`}
                className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
            {hasAssignButton && (
              <Button
                variant="default"
                size="sm"
                onClick={() => console.log(`Assign to me: ${key}`)} // Placeholder for assign
                className="ml-2"
              >
                Mir zuweisen
              </Button>
            )}
          </div>
        );
    }
  };

  const renderSection = (title: string, fields: typeof structuredFields.general) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2 mb-4">{title}</h3>
      <div className="grid grid-cols-1 gap-4">
        {fields.map((fieldConfig) => (
          <div className="grid grid-cols-[150px_1fr] items-center gap-4" key={fieldConfig.key}>
            {fieldConfig.type !== "checkbox" && ( // Checkbox label is rendered inside renderField
              <Label htmlFor={fieldConfig.key} className={cn("text-right", fieldConfig.isRequired && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
                {fieldConfig.label}
              </Label>
            )}
            {renderField(fieldConfig)}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[90vw] lg:max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isAddingNewItem ? "Add New Item" : `Edit Item Details (ID: ${editedItem.id})`}
            </DialogTitle>
            <DialogDescription>
              {isAddingNewItem ? "Enter details for the new item." : "Make changes to your item here. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {renderSection("Allgemein", structuredFields.general)}
              {renderSection("Klassifizierung", structuredFields.classification)}
              {renderSection("Termine", structuredFields.dates)}
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {renderSection("Fortschritt", structuredFields.progress)}
              {renderSection("Prognose", structuredFields.forecast)}
              {renderSection("Anwender", structuredFields.user)}
            </div>

            {/* Other Details Section for any remaining dynamic fields */}
            {otherKeys.length > 0 && (
              <div className="lg:col-span-2 space-y-4 mt-8">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Other Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                  {otherKeys.map((key) => (
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4" key={key}>
                      <Label htmlFor={key} className="text-right capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <Input
                        id={key}
                        type={typeof editedItem[key] === "number" ? "number" : "text"}
                        value={String(editedItem[key] || "")}
                        onChange={(e) => handleChange(key, typeof editedItem[key] === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                        className="w-full"
                        placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`}
                        disabled={
                          key === "Opportunity" ||
                          key === "Guid" ||
                          key === "CreationDate" ||
                          key === "LastTransactionDate" ||
                          key === "CreatedBy" ||
                          key === "LastModifiedBy"
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSave}>
              {isAddingNewItem ? "Add Item" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BusinessPartnerSelectDialog
        isOpen={isBpSelectDialogOpen}
        onClose={() => setIsBpSelectDialogOpen(false)}
        onSelect={handleSelectBusinessPartner}
        authToken={authToken}
      />
    </>
  );
};

export default DetailDialog;