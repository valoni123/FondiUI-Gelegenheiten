import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableCellInputProps {
  itemId: string;
  fieldKey: string;
  initialValue: string | number | boolean;
  onUpdateItem: (id: string, field: string, value: string | number | boolean) => void;
  type?: "text" | "number";
  disabled?: boolean;
  className?: string;
  // For BusinessPartner specific styling/button
  hasSearchButton?: boolean;
  onSearchButtonClick?: (itemId: string) => void;
  displaySuffix?: string;
}

const EditableCellInput: React.FC<EditableCellInputProps> = ({
  itemId,
  fieldKey,
  initialValue,
  onUpdateItem,
  type = "text",
  disabled = false,
  className,
  hasSearchButton = false,
  onSearchButtonClick,
  displaySuffix,
}) => {
  const [currentValue, setCurrentValue] = useState<string>(String(initialValue));

  // Sync internal state with prop changes (e.g., after an API update or initial load)
  useEffect(() => {
    setCurrentValue(String(initialValue));
  }, [initialValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentValue(e.target.value);
  };

  const handleBlur = () => {
    const parsedValue = type === "number" ? parseFloat(currentValue) || 0 : currentValue;
    // Only call onUpdateItem if the value has actually changed
    if (parsedValue !== initialValue) {
      onUpdateItem(itemId, fieldKey, parsedValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur(); // Trigger blur to save changes
    }
  };

  return (
    <div className="relative flex items-center">
      <Input
        value={currentValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        type={type}
        disabled={disabled}
        className={cn(className, (hasSearchButton || displaySuffix) && "pr-10")}
      />
      {displaySuffix && <span className="absolute right-2 text-sm text-muted-foreground">{displaySuffix}</span>}
      {hasSearchButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSearchButtonClick && onSearchButtonClick(itemId)}
          aria-label={`Search for ${fieldKey}`}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
        >
          <Search className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default EditableCellInput;