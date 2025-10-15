"use client";

import React from "react";

type Props = {
  targetRect: DOMRect;
};

const ArrowOverlay: React.FC<Props> = ({ targetRect }) => {
  const [vw, setVw] = React.useState<number>(typeof window !== "undefined" ? window.innerWidth : 0);
  const [vh, setVh] = React.useState<number>(typeof window !== "undefined" ? window.innerHeight : 0);

  React.useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Startpunkt nahe der Toast-Message unten rechts (kleiner Abstand zu den Rändern)
  const startX = vw - 28;
  const startY = vh - 88; // etwas über dem unteren Rand, damit der Pfeil nicht von der Toast überlagert wird

  // Endpunkt: linke Mitte des Ziel-Feldes
  const endX = Math.max(8, targetRect.left - 10);
  const endY = targetRect.top + targetRect.height / 2;

  // Kontrollpunkte für eine sanfte Kurve
  const c1X = startX - 140;
  const c1Y = startY - 140;
  const c2X = endX + 70;
  const c2Y = endY - 40;

  // Für die Zeichen-Animation setzen wir strokeDasharray/-offset dynamisch
  const pathRef = React.useRef<SVGPathElement | null>(null);
  const [dashLen, setDashLen] = React.useState<number>(400);

  React.useEffect(() => {
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength();
      setDashLen(length || 400);
    }
  }, [startX, startY, endX, endY, c1X, c1Y, c2X, c2Y]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <svg className="absolute inset-0" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} fill="none" aria-hidden="true">
        <path
          ref={pathRef}
          d={`M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`}
          stroke="#ef4444"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          style={{ strokeDasharray: dashLen, strokeDashoffset: dashLen }}
          className="animate-[arrow-draw_0.9s_ease-out_forwards]"
        />
        {/* Pfeilspitze nahe des Endpunkts (linksgerichtet) */}
        <path
          d={`M ${endX} ${endY} L ${endX - 14} ${endY - 10} M ${endX} ${endY} L ${endX - 14} ${endY + 10}`}
          stroke="#ef4444"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
};

export default ArrowOverlay;