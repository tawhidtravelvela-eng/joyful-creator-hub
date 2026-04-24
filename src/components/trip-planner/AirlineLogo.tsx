import React from "react";
import { Plane } from "lucide-react";

interface AirlineLogoProps {
  code: string;
  name: string;
  size?: number;
}

const AirlineLogo: React.FC<AirlineLogoProps> = ({ code, name, size = 24 }) => {
  if (!code) return <Plane className="text-muted-foreground" style={{ width: size * 0.6, height: size * 0.6 }} />;
  return (
    <img
      src={`https://pics.avs.io/${size * 2}/${size * 2}/${code}@2x.png`}
      alt={name}
      className="object-contain rounded-sm bg-white/90 p-[1px]"
      style={{ width: size, height: size }}
      onError={(e) => {
        const el = e.target as HTMLImageElement;
        el.style.display = "none";
        const parent = el.parentElement;
        if (parent && !parent.querySelector('.airline-fallback')) {
          const span = document.createElement('span');
          span.className = 'airline-fallback';
          span.textContent = code;
          span.style.cssText = `font-size:${Math.max(8, size * 0.4)}px;font-weight:700;color:hsl(var(--primary));`;
          parent.appendChild(span);
        }
      }}
    />
  );
};

export default AirlineLogo;
