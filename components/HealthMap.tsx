"use client";

import { useEffect, useState, useRef } from "react";
import Map, { Marker, NavigationControl, MapRef } from "react-map-gl";
import {
  Hospital,
  Pill,
  Stethoscope,
  FlaskConical,
  Siren,
  Navigation,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import "mapbox-gl/dist/mapbox-gl.css";

interface Facility {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  openNow: boolean | null;
}

const CATEGORIES = [
  { key: "hospital", label: "Hospitals", icon: Hospital },
  { key: "pharmacy", label: "Pharmacies", icon: Pill },
  { key: "clinic", label: "Clinics", icon: Stethoscope },
  { key: "lab", label: "Labs", icon: FlaskConical },
  { key: "er", label: "Emergency", icon: Siren },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export function HealthMap() {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryKey>("hospital");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Facility | null>(null);
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocationError("Geolocation isn't supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () =>
        setLocationError(
          "Location access was denied. Enable it to find nearby care.",
        ),
    );
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSelected(null);
    apiFetch(
      `/map/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&category=${category}`,
    )
      .then((data: Facility[]) => setFacilities(data))
      .catch(() => setFacilities([]))
      .finally(() => setLoading(false));
  }, [userLocation, category]);

  // Smooth flyTo transitions when a sidebar facility card is clicked
  useEffect(() => {
    if (selected && mapRef.current) {
      mapRef.current.flyTo({
        center: [selected.lng, selected.lat],
        zoom: 15,
        essential: true,
      });
    }
  }, [selected]);

  if (locationError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <p className="mb-4 text-ink-muted">{locationError}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-panel-border px-4 py-2 text-sm font-semibold hover:bg-white/5"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!userLocation) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-muted">
        Getting your location...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex gap-2 overflow-x-auto border-b border-panel-border px-6 py-3">
        {CATEGORIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              category === key
                ? "bg-trace/10 text-trace"
                : "text-ink-muted hover:bg-white/5 hover:text-ink"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-panel-border">
          {loading && (
            <p className="p-4 text-sm text-ink-muted">Searching nearby...</p>
          )}
          {!loading && facilities.length === 0 && (
            <p className="p-4 text-sm text-ink-muted">
              No results found nearby.
            </p>
          )}
          {facilities.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f)}
              className={`block w-full border-b border-panel-border p-4 text-left transition-colors hover:bg-white/5 ${
                selected?.id === f.id ? "bg-trace/5" : ""
              }`}
            >
              <p className="mb-1 text-sm font-semibold text-ink">{f.name}</p>
              <p className="mb-2 text-xs text-ink-muted">{f.address}</p>
              <div className="flex items-center gap-3 text-xs">
                {f.rating != null && (
                  <span className="text-amber">★ {f.rating}</span>
                )}
                {f.openNow != null && (
                  <span className={f.openNow ? "text-trace" : "text-alert"}>
                    {f.openNow ? "Open now" : "Closed"}
                  </span>
                )}
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${f.lat},${f.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-trace hover:underline"
              >
                <Navigation size={12} />
                Directions
              </a>
            </button>
          ))}
        </div>

        <div className="flex-1 relative">
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              longitude: userLocation.lng,
              latitude: userLocation.lat,
              zoom: 14,
            }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: "100%", height: "100%" }}
          >
            <NavigationControl position="top-right" />

            {/* User Position Pin */}
            <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
              <div className="h-4 w-4 rounded-full bg-emerald-400 ring-4 ring-emerald-950" />
            </Marker>

            {/* Health Infrastructure Asset Pins */}
            {facilities.map((f) => (
              <Marker
                key={f.id}
                longitude={f.lng}
                latitude={f.lat}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelected(f);
                }}
              >
                <div
                  className={`h-5 w-5 rounded-full border-2 border-white shadow-md cursor-pointer transition-transform ${
                    selected?.id === f.id
                      ? "bg-rose-500 scale-125 z-10"
                      : "bg-slate-900"
                  }`}
                />
              </Marker>
            ))}
          </Map>
        </div>
      </div>
    </div>
  );
}
