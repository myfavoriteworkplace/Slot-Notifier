import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, MapPin, X, Navigation } from "lucide-react";

const PIN_ICON = L.divIcon({
  html: `<div style="width:32px;height:40px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">
    <div style="width:28px;height:28px;background:hsl(258 90% 56%);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25)"></div>
    <div style="width:4px;height:12px;background:hsl(258 90% 56%);border-radius:0 0 2px 2px;margin-top:-2px"></div>
  </div>`,
  className: "",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});

function DraggableMarker({
  position,
  onChange,
}: {
  position: [number, number];
  onChange: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const { lat, lng } = marker.getLatLng();
        onChange(lat, lng);
      }
    },
  };
  return <Marker position={position} icon={PIN_ICON} draggable eventHandlers={eventHandlers} ref={markerRef} />;
}

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 16, { duration: 1.2 });
  }, [position]);
  return null;
}

interface MapLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export default function MapLocationPicker({ latitude, longitude, onChange }: MapLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const hasPin = latitude != null && longitude != null;
  const pinPos: [number, number] = hasPin ? [latitude!, longitude!] : [20.5937, 78.9629];

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const url = `${NOMINATIM}?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const results = await res.json();
      if (!results || results.length === 0) {
        setSearchError("No results found. Try a more specific address.");
        return;
      }
      const { lat, lon } = results[0];
      const newLat = parseFloat(lat);
      const newLng = parseFloat(lon);
      onChange(newLat, newLng);
      setFlyTarget([newLat, newLng]);
    } catch {
      setSearchError("Search failed. Please check your connection.");
    } finally {
      setSearching(false);
    }
  }

  function handlePlace(lat: number, lng: number) {
    onChange(lat, lng);
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-3 h-9 text-sm"
            placeholder="Search clinic address or landmark…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            data-testid="input-map-search"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 px-3 shrink-0"
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          data-testid="button-map-search"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        {hasPin && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 px-3 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onChange(null, null)}
            data-testid="button-clear-location"
            title="Clear saved location"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {searchError && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <X className="h-3 w-3 shrink-0" />{searchError}
        </p>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-border/60 shadow-sm" style={{ height: 280 }}>
        <MapContainer
          center={pinPos}
          zoom={hasPin ? 15 : 5}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ClickToPlace onPlace={handlePlace} />
          {hasPin && <DraggableMarker position={[latitude!, longitude!]} onChange={(lat, lng) => onChange(lat, lng)} />}
          {flyTarget && <FlyTo position={flyTarget} />}
        </MapContainer>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between gap-2">
        {hasPin ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
            <Navigation className="h-3.5 w-3.5 shrink-0" />
            Pin saved — drag it to fine-tune the exact entrance
          </p>
        ) : (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            Search for an address or click anywhere on the map to drop a pin
          </p>
        )}
        {hasPin && (
          <p className="text-[10px] text-muted-foreground font-mono shrink-0">
            {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  );
}
