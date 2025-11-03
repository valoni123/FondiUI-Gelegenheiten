"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { IdmAttribute } from "@/api/idm";

type AttributeValueFieldProps = {
  attr: IdmAttribute;
  value?: string;
  onChange: (val: string) => void;
};

const AttributeValueField: React.FC<AttributeValueFieldProps> = ({ attr, value, onChange }) => {
  const hasValueset = Array.isArray(attr.valueset) && attr.valueset.length > 0;

  if (hasValueset) {
    return (
      <Select value={value ?? ""} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Wert auswählen" />
        </SelectTrigger>
        <SelectContent>
          {attr.valueset!.map((v) => (
            <SelectItem key={v.name} value={v.name}>
              {v.desc || v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (attr.type === "7") {
    // Date attribute, use native date input for simplicity; expects YYYY-MM-DD
    return (
      <Input
        type="date"
        className="w-[240px]"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Default to text input
  return (
    <Input
      type="text"
      className="w-[240px]"
      value={value ?? ""}
      placeholder="Wert eingeben…"
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

export default AttributeValueField;