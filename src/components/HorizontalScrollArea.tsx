"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

type HorizontalScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  children: React.ReactNode;
};

const HorizontalScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  HorizontalScrollAreaProps
>(({ className, children, ...props }, ref) => {
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      {/* Vertical scrollbar on the right */}
      <ScrollAreaPrimitive.ScrollAreaScrollbar
        orientation="vertical"
        className={cn(
          "flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
        )}
      >
        <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
      </ScrollAreaPrimitive.ScrollAreaScrollbar>
      {/* Horizontal scrollbar at the bottom */}
      <ScrollAreaPrimitive.ScrollAreaScrollbar
        orientation="horizontal"
        className={cn(
          "flex touch-none select-none transition-colors h-2.5 flex-col border-t border-t-transparent p-[1px]"
        )}
      >
        <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
      </ScrollAreaPrimitive.ScrollAreaScrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
HorizontalScrollArea.displayName = "HorizontalScrollArea";

export default HorizontalScrollArea;