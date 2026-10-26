"use client";
import dynamic from "next/dynamic";
import { Map } from "lucide-react";
import type { Activity } from "@/types/itinerary";
const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => (
    <MapEmpty
      title="Opening your map…"
      detail="Only successfully geocoded stops will appear."
    />
  ),
});
export function MapEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="map-empty">
      <Map size={29} strokeWidth={1.3} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
export function ItineraryMap({
  activities,
  selectedId,
  onSelect,
  location,
}: {
  activities: Activity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  location: string;
}) {
  return (
    <div className="map-frame" aria-label="Itinerary map">
      {process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ? (
        <MapCanvas
          activities={activities}
          selectedId={selectedId}
          onSelect={onSelect}
          location={location}
        />
      ) : (
        <MapEmpty
          title="A little perspective."
          detail="Connect Mapbox to see your stops on a map. Your itinerary works just as well without it."
        />
      )}
    </div>
  );
}
