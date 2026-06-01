import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Search } from 'lucide-react';
import { geocode } from '../api/client';
import type { Location } from '../context/types';

// Fix Leaflet's default marker icon paths under Vite bundling.
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
}

interface Props {
  value?: Location | null;
  onChange: (loc: Location | null) => void;
}

export default function LocationField({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        setResults(await geocode.search(query));
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const pick = (loc: Location) => {
    onChange(loc);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const onMarkerDragEnd = async (e: L.DragEndEvent) => {
    const { lat, lng } = e.target.getLatLng();
    try {
      const loc = await geocode.reverse(lat, lng);
      onChange(loc ?? { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lon: lng });
    } catch {
      onChange({ name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lon: lng });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <MapPin size={14} className="text-text-tertiary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          Location
        </span>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg bg-surface-hover px-2.5 py-1.5">
          <Search size={13} className="text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="Search an address or place…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-text-tertiary"
          />
        </div>
        {open && results.length > 0 && (
          <ul className="absolute z-[1000] mt-1 w-full max-h-52 overflow-auto rounded-lg border border-border bg-surface shadow-lg">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <button
                  onClick={() => pick(r)}
                  className="block w-full px-3 py-2 text-left text-[12px] text-text-secondary hover:bg-surface-hover"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value && (
        <div className="mt-2">
          {/* relative z-0 isolates Leaflet's internal z-indexes (panes/controls
              go up to ~1000) into their own stacking context, so they can't
              paint over sibling popovers like the date-picker calendar (z-50). */}
          <div className="relative z-0 h-40 w-full overflow-hidden rounded-lg border border-border">
            <MapContainer
              center={[value.lat, value.lon]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Recenter lat={value.lat} lon={value.lon} />
              <Marker
                position={[value.lat, value.lon]}
                icon={markerIcon}
                draggable
                eventHandlers={{ dragend: onMarkerDragEnd }}
              />
            </MapContainer>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <a
              href={`https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lon}#map=16/${value.lat}/${value.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[12px] text-accent hover:underline"
              title={value.name}
            >
              ↗ {value.name}
            </a>
            <button
              onClick={() => onChange(null)}
              className="flex shrink-0 items-center gap-1 text-[11px] text-text-tertiary hover:text-danger"
            >
              <X size={12} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
