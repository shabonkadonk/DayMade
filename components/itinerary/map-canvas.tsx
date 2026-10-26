"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { z } from "zod";
import type { Activity } from "@/types/itinerary";
import { MapEmpty } from "./itinerary-map";
const geoSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({
        coordinates: z.tuple([
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
        ]),
      }),
      properties: z.object({
        match_code: z.object({ confidence: z.string() }).optional(),
      }),
    }),
  ),
});
export default function MapCanvas({
  activities,
  location,
  selectedId,
  onSelect,
}: {
  activities: Activity[];
  location: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const markers = useRef<{ id: string; marker: Marker }[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    async function initialize() {
      try {
        const mapbox = (await import("mapbox-gl")).default;
        const points = await Promise.all(
          activities.map(async (a) => {
            if (!a.address) return null;
            const url = new URL(
              "https://api.mapbox.com/search/geocode/v6/forward",
            );
            url.search = new URLSearchParams({
              q: `${a.address}, ${location}`.slice(0, 256),
              access_token: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!,
              autocomplete: "false",
              types: "address",
              limit: "1",
            }).toString();
            const response = await fetch(url, {
              signal: controller.signal,
              cache: "no-store",
            });
            if (!response.ok) return null;
            const result = geoSchema.safeParse(await response.json());
            const feature = result.success
              ? result.data.features[0]
              : undefined;
            return feature &&
              ["exact", "high"].includes(
                feature.properties.match_code?.confidence ?? "",
              )
              ? {
                  id: a.id,
                  name: a.name,
                  coordinates: feature.geometry.coordinates,
                }
              : null;
          }),
        );
        const valid = points.filter((p) => p !== null);
        if (disposed) return;
        if (!valid.length || !container.current || !mapbox.supported()) {
          setState("unavailable");
          return;
        }
        const instance = new mapbox.Map({
          container: container.current,
          accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
          style: "mapbox://styles/mapbox/light-v11",
          center: valid[0].coordinates,
          zoom: 12,
          attributionControl: true,
        });
        map.current = instance;
        instance.addControl(
          new mapbox.NavigationControl({ showCompass: false }),
          "top-right",
        );
        const bounds = new mapbox.LngLatBounds();
        markers.current = valid.map((point) => {
          bounds.extend(point.coordinates);
          const el = document.createElement("button");
          el.type = "button";
          el.className = "map-pin";
          el.textContent = String(
            activities.findIndex((a) => a.id === point.id) + 1,
          );
          el.setAttribute("aria-label", point.name);
          el.addEventListener("click", () => onSelect(point.id));
          return {
            id: point.id,
            marker: new mapbox.Marker({ element: el })
              .setLngLat(point.coordinates)
              .addTo(instance),
          };
        });
        if (valid.length > 1)
          instance.fitBounds(bounds, { padding: 45, maxZoom: 14, duration: 0 });
        instance.once("load", () => {
          if (!disposed) setState("ready");
        });
        instance.on("error", () => {
          if (!disposed) setState("unavailable");
        });
      } catch {
        if (!disposed) setState("unavailable");
      }
    }
    void initialize();
    return () => {
      disposed = true;
      controller.abort();
      markers.current.forEach(({ marker }) => marker.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [activities, location, onSelect]);
  useEffect(() => {
    markers.current.forEach(({ id, marker }) =>
      marker.getElement().classList.toggle("selected", id === selectedId),
    );
  }, [selectedId, state]);
  return (
    <>
      <div
        ref={container}
        className="map-container"
        style={{ display: state === "unavailable" ? "none" : "block" }}
      />
      {state === "loading" && (
        <div className="absolute inset-0 bg-background">
          <MapEmpty
            title="Finding your stops…"
            detail="Checking addresses with Mapbox. No invented coordinates."
          />
        </div>
      )}
      {state === "unavailable" && (
        <MapEmpty
          title="Your map needs a moment."
          detail="The map or exact addresses couldn’t be loaded. Your timeline and venue sources are still available."
        />
      )}
    </>
  );
}
