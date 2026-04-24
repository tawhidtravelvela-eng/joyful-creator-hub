import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Star, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fix default marker icons for Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface HotelMapItem {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  price?: number;
  stars?: number;
  image?: string | null;
  source?: string;
}

interface HotelMapProps {
  hotels: HotelMapItem[];
  selectedHotelId?: string | null;
  onHotelClick?: (hotel: HotelMapItem) => void;
  formatPrice?: (price: number) => string;
  className?: string;
  singleMode?: boolean; // For detail page — single marker, higher zoom
}

const FitBounds = ({ hotels }: { hotels: HotelMapItem[] }) => {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    const valid = hotels.filter(h => h.latitude && h.longitude);
    if (valid.length === 0 || fitted.current) return;
    fitted.current = true;

    if (valid.length === 1) {
      map.setView([valid[0].latitude!, valid[0].longitude!], 15);
    } else {
      const bounds = L.latLngBounds(valid.map(h => [h.latitude!, h.longitude!]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [hotels, map]);

  return null;
};

const HotelMap = ({ hotels, selectedHotelId, onHotelClick, formatPrice, className = "", singleMode = false }: HotelMapProps) => {
  const validHotels = hotels.filter(h => h.latitude && h.longitude);

  if (validHotels.length === 0) return null;

  const center: [number, number] = [validHotels[0].latitude!, validHotels[0].longitude!];

  return (
    <div className={`rounded-xl overflow-hidden border border-border/50 ${className}`}>
      <MapContainer
        center={center}
        zoom={singleMode ? 15 : 12}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", minHeight: singleMode ? "250px" : "400px" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds hotels={validHotels} />
        {validHotels.map((hotel) => {
          const isSelected = hotel.id === selectedHotelId;
          const icon = L.divIcon({
            className: "custom-hotel-marker",
            html: `<div style="
              background: ${isSelected ? "hsl(var(--primary))" : "hsl(var(--card))"};
              color: ${isSelected ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"};
              border: 2px solid ${isSelected ? "hsl(var(--primary))" : "hsl(var(--border))"};
              border-radius: 8px;
              padding: 2px 8px;
              font-size: 12px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              transform: translate(-50%, -100%);
            ">${hotel.price && formatPrice ? formatPrice(hotel.price) : "•"}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          return (
            <Marker
              key={`${hotel.source}-${hotel.id}`}
              position={[hotel.latitude!, hotel.longitude!]}
              icon={singleMode ? new L.Icon.Default() : icon}
              eventHandlers={{
                click: () => onHotelClick?.(hotel),
              }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  {hotel.image && (
                    <img src={hotel.image} alt={hotel.name} className="w-full h-24 object-cover rounded-md mb-2" />
                  )}
                  <p className="font-semibold text-sm leading-tight">{hotel.name}</p>
                  {hotel.stars && hotel.stars > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: hotel.stars }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-warning/40 text-warning" />
                      ))}
                    </div>
                  )}
                  {hotel.price && formatPrice && (
                    <p className="font-bold text-primary mt-1">{formatPrice(hotel.price)}/night</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default HotelMap;
