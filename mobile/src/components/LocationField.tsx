import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { WebView } from 'react-native-webview';
import { api, type Location } from '@/api/client';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  value?: Location | null;
  onChange: (loc: Location | null) => void;
}

// Self-contained Leaflet page. We pass the initial center in; taps post {lat,lon} back.
function mapHtml(lat: number, lon: number): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map').setView([${lat}, ${lon}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '&copy; OpenStreetMap' }).addTo(map);
  var marker = L.marker([${lat}, ${lon}], { draggable: true }).addTo(map);
  function post(ll){ window.ReactNativeWebView.postMessage(JSON.stringify({lat: ll.lat, lon: ll.lng})); }
  marker.on('dragend', function(){ post(marker.getLatLng()); });
  map.on('click', function(e){ marker.setLatLng(e.latlng); post(e.latlng); });
</script></body></html>`;
}

export default function LocationField({ value, onChange }: Props) {
  const { palette } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQuery = (q: string) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setResults(await api.geocodeSearch(q));
      } catch {
        setResults([]);
      }
    }, 400);
  };

  const pick = (loc: Location) => {
    onChange(loc);
    setQuery('');
    setResults([]);
  };

  const onMapMessage = async (raw: string) => {
    try {
      const { lat, lon } = JSON.parse(raw) as { lat: number; lon: number };
      const loc = await api.geocodeReverse(lat, lon);
      onChange(loc ?? { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon });
    } catch {
      /* ignore malformed messages */
    }
  };

  const html = useMemo(
    () => (value ? mapHtml(value.lat, value.lon) : ''),
    [value?.lat, value?.lon],
  );

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: palette.textTertiary, textTransform: 'uppercase' }}>
        Location
      </Text>
      <TextInput
        value={query}
        onChangeText={onQuery}
        placeholder="Search an address or place…"
        placeholderTextColor={palette.textTertiary}
        style={{ backgroundColor: palette.surfaceHover, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: palette.textPrimary }}
      />
      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(r, i) => `${r.lat},${r.lon},${i}`}
          style={{ maxHeight: 160, backgroundColor: palette.surface, borderRadius: 8 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => pick(item)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text numberOfLines={1} style={{ color: palette.textSecondary, fontSize: 13 }}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}
      {value && (
        <View style={{ gap: 6 }}>
          <View style={{ height: 180, borderRadius: 8, overflow: 'hidden' }}>
            <WebView
              originWhitelist={['*']}
              source={{ html }}
              onMessage={(e) => onMapMessage(e.nativeEvent.data)}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ flex: 1, color: palette.textSecondary, fontSize: 12 }}>
              📍 {value.name}
            </Text>
            <Pressable onPress={() => onChange(null)}>
              <Text style={{ color: palette.textTertiary, fontSize: 12 }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
