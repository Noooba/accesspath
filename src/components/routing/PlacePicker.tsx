"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, MapPin, Search, X } from "lucide-react";
import { apiJson } from "@/lib/http-client";
import type { RealPlace, PlaceSearchResponse } from "@/types/live-routing";

export function PlacePicker({
  label,
  target,
  selected,
  onChange,
  onPickMap,
  isPicking,
  serviceAvailable = true,
}: {
  label: string;
  target: "start" | "end";
  selected: RealPlace | null;
  onChange: (place: RealPlace | null) => void;
  onPickMap: () => void;
  isPicking: boolean;
  serviceAvailable?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<RealPlace[] | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null),
    version = useRef(0);
  useEffect(() => () => request.current?.abort(), []);

  function edit(value: string) {
    version.current++;
    request.current?.abort();
    setBusy(false);
    setQuery(value);
    setPlaces(null);
    setError("");
    if (selected) onChange(null);
  }
  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!serviceAvailable || query.trim().length < 3) return;
    request.current?.abort();
    const c = new AbortController();
    request.current = c;
    const current = ++version.current,
      timer = setTimeout(() => c.abort(), 18000);
    setBusy(true);
    setError("");
    setPlaces(null);
    try {
      const data = await apiJson<PlaceSearchResponse>("/api/live/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
        signal: c.signal,
      });
      if (current === version.current) setPlaces(data.places);
    } catch (e) {
      if (current === version.current)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "Place search timed out. Try again or choose a point on the map."
            : e instanceof Error
              ? e.message
              : "Place search is unavailable.",
        );
    } finally {
      clearTimeout(timer);
      if (current === version.current) setBusy(false);
    }
  }

  return (
    <div className="real-place-picker">
      <form onSubmit={search} aria-busy={busy}>
        <div className="field-label">
          <label htmlFor={`real-${target}-search`}>
            <i className={`real-endpoint ${target}`}>
              {target === "start" ? "A" : "B"}
            </i>
            {label}
          </label>
          <span className="real-search-input">
            <input
              id={`real-${target}-search`}
              aria-label={label}
              value={selected?.label ?? query}
              maxLength={160}
              minLength={3}
              autoComplete="off"
              placeholder={
                target === "start"
                  ? "Search a place or address"
                  : "Where are you going?"
              }
              onChange={(e) => edit(e.target.value)}
            />
            <button
              type="submit"
              disabled={
                !serviceAvailable ||
                busy ||
                Boolean(selected) ||
                query.trim().length < 3
              }
              aria-label={`Search ${target === "start" ? "starting" : "destination"} places`}
            >
              {busy ? (
                <span className="button-spinner dark" />
              ) : (
                <Search size={17} />
              )}
            </button>
          </span>
        </div>
      </form>
      {selected && (
        <div className="real-selected-place">
          <Check size={14} />
          <span>
            Selected · {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}
          </span>
          <button
            aria-label={`Clear ${target === "start" ? "starting" : "destination"} place`}
            onClick={() => {
              edit("");
              onChange(null);
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {error && (
        <p className="real-search-error" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status">
        {busy ? `Searching for ${label.toLowerCase()}.` : ""}
      </p>
      {places && !selected && (
        <div className="real-search-results" aria-live="polite">
          {places.length ? (
            <>
              <p>Choose a matching place</p>
              <ul aria-label={`${label} search results`}>
                {places.map((place) => (
                  <li key={place.id}>
                    <button
                      onClick={() => {
                        setQuery(place.label);
                        setPlaces(null);
                        onChange(place);
                      }}
                    >
                      <MapPin size={15} />
                      <span>{place.label}</span>
                      <ArrowRight size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <small>Search by Photon · © OpenStreetMap contributors</small>
            </>
          ) : (
            <p role="status">
              No matching places found. Add a city or use the map.
            </p>
          )}
        </div>
      )}
      <div className="real-place-tools">
        <button aria-pressed={isPicking} onClick={onPickMap}>
          <MapPin size={13} />
          {isPicking ? "Choosing on map…" : "Choose on map"}
        </button>
        <CoordinateEntry
          key={selected?.id ?? "empty"}
          label={label}
          selected={selected}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function CoordinateEntry({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: RealPlace | null;
  onChange: (place: RealPlace) => void;
}) {
  const [lat, setLat] = useState<string | null>(null),
    [lon, setLon] = useState<string | null>(null);
  const [error, setError] = useState(""),
    details = useRef<HTMLDetailsElement>(null);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const latitude = lat ?? (selected ? String(selected.lat) : "");
    const longitude = lon ?? (selected ? String(selected.lon) : "");
    const a = Number(latitude),
      o = Number(longitude);
    if (
      !latitude.trim() ||
      !longitude.trim() ||
      !Number.isFinite(a) ||
      !Number.isFinite(o) ||
      a < -90 ||
      a > 90 ||
      o < -180 ||
      o > 180
    ) {
      setError("Enter latitude from −90 to 90 and longitude from −180 to 180.");
      return;
    }
    setError("");
    onChange({
      id: `coordinates-${a}-${o}`,
      label: `Coordinates · ${a.toFixed(5)}, ${o.toFixed(5)}`,
      lat: a,
      lon: o,
      source: "coordinates",
    });
    if (details.current) details.current.open = false;
  }
  return (
    <details ref={details} className="real-coordinate-entry">
      <summary>Use coordinates</summary>
      <form onSubmit={submit}>
        <label>
          Latitude
          <input
            aria-label={`${label} latitude`}
            type="number"
            min="-90"
            max="90"
            step="any"
            required
            value={lat ?? (selected ? String(selected.lat) : "")}
            onChange={(e) => setLat(e.target.value)}
          />
        </label>
        <label>
          Longitude
          <input
            aria-label={`${label} longitude`}
            type="number"
            min="-180"
            max="180"
            step="any"
            required
            value={lon ?? (selected ? String(selected.lon) : "")}
            onChange={(e) => setLon(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button secondary small" type="submit">
          Use this point <ArrowRight size={13} />
        </button>
      </form>
    </details>
  );
}
