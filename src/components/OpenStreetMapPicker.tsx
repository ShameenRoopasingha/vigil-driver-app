import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  searchLandmarksOffline,
  searchNominatimOnline,
  searchPlacesOnlineUnified,
  mergeSearchResults,
  calculateMultiStopRouteOSRM,
  geocodePlace,
  type PlaceSuggestion,
  type IntermediateStop,
  type MultiStopRouteResult,
  type RouteLeg,
} from '../services/osmService';
import { locationService } from '../services/locationService';

export interface ItineraryChangePayload {
  pickupLocation: { name: string; lat: number; lon: number };
  dropLocation: { name: string; lat: number; lon: number };
  stops: IntermediateStop[];
  extraKm: number;
  totalKm: number;
  directKm: number;
  routeResult: MultiStopRouteResult | null;
}

export interface OpenStreetMapPickerProps {
  currentLocation?: { lat: number; lon: number; name?: string } | null;
  destinationLocation?: { lat: number; lon: number; name?: string } | null;
  pickupLocationName?: string;
  dropLocationName?: string;
  initialStops?: IntermediateStop[];
  routeType?: 'DETOUR' | 'DESTINATION' | 'ITINERARY';
  onItineraryChanged?: (payload: ItineraryChangePayload) => void;
  // Backwards compatibility props
  onSelectPlace?: (place: any) => void;
  onRouteCalculated?: (info: any) => void;
  initialLocationName?: string;
  initialCoords?: { lat: number; lon: number } | null;
  placeholder?: string;
}

// Curated Quick Chips
const POPULAR_PICKUPS = [
  { label: '✈️ BIA Airport', name: 'Bandaranaike International Airport (BIA), Katunayake', lat: 7.1804, lon: 79.8841 },
  { label: '🏙️ Colombo Fort', name: 'Colombo Fort Station, Colombo', lat: 6.9344, lon: 79.8504 },
  { label: '🏖️ Negombo Beach', name: 'Negombo Beach, Negombo', lat: 7.2285, lon: 79.8415 },
  { label: '🏯 Kandy City', name: 'Kandy Lake, Kandy', lat: 7.2906, lon: 80.6337 },
  { label: '🏰 Galle Fort', name: 'Galle Fort Main Gate, Galle', lat: 6.0354, lon: 80.2173 },
];

const POPULAR_DROPOFFS = [
  { label: '🏯 Kandy', name: 'Temple of the Tooth, Kandy', lat: 7.2936, lon: 80.6413 },
  { label: '⛰️ Nuwara Eliya', name: 'Grand Hotel, Nuwara Eliya', lat: 6.9686, lon: 80.7672 },
  { label: '🌿 Ella', name: 'Nine Arches Bridge, Ella', lat: 6.8768, lon: 81.0608 },
  { label: '🦁 Sigiriya', name: 'Sigiriya Rock Fortress, Sigiriya', lat: 7.9541, lon: 80.7553 },
  { label: '🏖️ Mirissa Beach', name: 'Mirissa Beach, Mirissa', lat: 5.9482, lon: 80.4578 },
  { label: '✈️ BIA Airport', name: 'Bandaranaike International Airport (BIA), Katunayake', lat: 7.1804, lon: 79.8841 },
];

const QUICK_DETOURS = [
  { label: '🐘 Pinnawala', name: 'Pinnawala Elephant Orphanage', lat: 7.3013, lon: 80.3871 },
  { label: '🗼 Ambuluwawa', name: 'Ambuluwawa Tower, Gampola', lat: 7.1742, lon: 80.5286 },
  { label: '🦁 Sigiriya', name: 'Sigiriya Lion Rock', lat: 7.9541, lon: 80.7553 },
  { label: '🪨 Dambulla', name: 'Dambulla Cave Temple', lat: 7.8569, lon: 80.6485 },
  { label: '🏯 Dalada Maligawa', name: 'Temple of the Tooth, Kandy', lat: 7.2936, lon: 80.6413 },
  { label: '🌿 Nine Arch Bridge', name: 'Nine Arches Bridge, Ella', lat: 6.8768, lon: 81.0608 },
  { label: '🌊 Mirissa Beach', name: 'Mirissa Beach & Harbor', lat: 5.9482, lon: 80.4578 },
  { label: '🏰 Galle Fort', name: 'Galle Fort Main Gate', lat: 6.0354, lon: 80.2173 },
  { label: '🐆 Yala Safari', name: 'Yala National Park Gate', lat: 6.2738, lon: 81.4288 },
  { label: '🌁 Horton Plains', name: 'Horton Plains (World\'s End)', lat: 6.8096, lon: 80.8144 },
];

export default function OpenStreetMapPicker({
  currentLocation,
  destinationLocation,
  pickupLocationName = '',
  dropLocationName = '',
  initialStops = [],
  onItineraryChanged,
  onSelectPlace,
  onRouteCalculated,
  placeholder = 'Search attraction, hotel or city to add stop...',
}: OpenStreetMapPickerProps) {
  // 1. Pickup State
  const [pickup, setPickup] = useState<{ name: string; lat: number; lon: number }>(
    currentLocation
      ? {
          name: pickupLocationName || currentLocation.name || 'Pickup Location',
          lat: currentLocation.lat,
          lon: currentLocation.lon,
        }
      : {
          name: pickupLocationName || 'Meegoda',
          lat: 6.8406,
          lon: 80.0573,
        }
  );
  const [isEditingPickup, setIsEditingPickup] = useState(false);
  const [pickupQuery, setPickupQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);

  // 2. Drop-off State
  const [dropoff, setDropoff] = useState<{ name: string; lat: number; lon: number }>(
    destinationLocation
      ? {
          name: dropLocationName || destinationLocation.name || 'Final Destination',
          lat: destinationLocation.lat,
          lon: destinationLocation.lon,
        }
      : {
          name: dropLocationName || 'Colombo Fort Station',
          lat: 6.9344,
          lon: 79.8504,
        }
  );
  const [isEditingDropoff, setIsEditingDropoff] = useState(false);
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [dropoffSuggestions, setDropoffSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);

  // 3. Intermediate Stops List
  const [stops, setStops] = useState<IntermediateStop[]>(initialStops);

  // 4. Add Stop Search State
  const [stopQuery, setStopQuery] = useState('');
  const [stopSuggestions, setStopSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showStopDropdown, setShowStopDropdown] = useState(false);
  const [isSearchingStop, setIsSearchingStop] = useState(false);

  // 5. Route Result
  const [routeResult, setRouteResult] = useState<MultiStopRouteResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // 6. UI Controls
  const [showLegsBreakdown, setShowLegsBreakdown] = useState(true);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const lastInjectedPayloadRef = useRef<any>(null);
  const pickupDebounceRef = useRef<any>(null);
  const dropoffDebounceRef = useRef<any>(null);
  const stopDebounceRef = useRef<any>(null);
  const recalcDebounceRef = useRef<any>(null);
  const searchCacheRef = useRef<Map<string, PlaceSuggestion[]>>(new Map());

  // Fast Recalculate Multi-Stop Route (Debounced by 120ms to prevent duplicate calls)
  const triggerRecalculate = useCallback(
    (currentPickup = pickup, currentStops = stops, currentDropoff = dropoff) => {
      if (recalcDebounceRef.current) clearTimeout(recalcDebounceRef.current);

      setIsCalculating(true);
      recalcDebounceRef.current = setTimeout(async () => {
        try {
          const result = await calculateMultiStopRouteOSRM(
            currentPickup,
            currentStops,
            currentDropoff
          );
          setRouteResult(result);

          // Update each stop's distanceFromPrevKm from legs
          if (result.legs && result.legs.length > 0 && currentStops.length > 0) {
            const updatedStops = currentStops.map((stop, idx) => {
              const leg = result.legs[idx];
              return {
                ...stop,
                distanceFromPrevKm: leg ? leg.distanceKm : undefined,
                durationFromPrevText: leg ? leg.durationText : undefined,
              };
            });
            setStops(updatedStops);
          }

          onItineraryChanged?.({
            pickupLocation: currentPickup,
            dropLocation: currentDropoff,
            stops: currentStops,
            extraKm: result.relativeExtraKm,
            totalKm: result.totalDistanceKm,
            directKm: result.directDistanceKm,
            routeResult: result,
          });

          // Backward compatibility callbacks
          if (currentStops.length > 0) {
            const lastStop = currentStops[currentStops.length - 1];
            onSelectPlace?.({
              name: currentStops.map((s) => s.name).join(' ➔ '),
              displayName: currentStops.map((s) => s.name).join(' ➔ '),
              shortName: lastStop.name,
              lat: lastStop.lat,
              lon: lastStop.lon,
              roadDistanceKm: result.relativeExtraKm,
              relativeExtraKm: result.relativeExtraKm,
              directDistanceKm: result.directDistanceKm,
              detourTotalKm: result.totalDistanceKm,
              distanceToDetourKm: result.legs?.[0]?.distanceKm || result.totalDistanceKm,
              durationText: result.totalDurationText,
            });
          }

          onRouteCalculated?.({
            directDistanceKm: result.directDistanceKm,
            detourDistanceKm: result.totalDistanceKm,
            relativeExtraKm: result.relativeExtraKm,
            distanceToDetourKm: result.legs?.[0]?.distanceKm || 0,
            durationToDetourText: result.legs?.[0]?.durationText || '',
            detourDurationText: result.totalDurationText,
            directGeoJson: result.directGeoJson,
            detourGeoJson: result.routeGeoJson,
          });

          // Inject into Leaflet WebView
          const payload = {
            origin: currentPickup,
            destination: currentDropoff,
            stops: currentStops,
            directGeoJson: result.directGeoJson,
            routeGeoJson: result.routeGeoJson,
          };
          lastInjectedPayloadRef.current = payload;
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(
              `if (window.renderMultiRoutes) { window.renderMultiRoutes(${JSON.stringify(JSON.stringify(payload))}); } true;`
            );
          }
        } catch (err) {
          console.warn('Error recalculating multi-stop route:', err);
        } finally {
          setIsCalculating(false);
        }
      }, 120);
    },
    [pickup, stops, dropoff, onItineraryChanged, onSelectPlace, onRouteCalculated]
  );

  // Initial Route Load
  useEffect(() => {
    triggerRecalculate(pickup, stops, dropoff);
  }, []);

  // Synchronize when destinationLocation prop resolves or changes
  useEffect(() => {
    if (destinationLocation && (Math.abs(destinationLocation.lat - dropoff.lat) > 0.001 || Math.abs(destinationLocation.lon - dropoff.lon) > 0.001)) {
      const nextDropoff = {
        name: dropLocationName || destinationLocation.name || dropoff.name,
        lat: destinationLocation.lat,
        lon: destinationLocation.lon,
      };
      setDropoff(nextDropoff);
      triggerRecalculate(pickup, stops, nextDropoff);
    }
  }, [destinationLocation?.lat, destinationLocation?.lon]);

  // Synchronize when currentLocation prop resolves or changes
  useEffect(() => {
    if (currentLocation && (Math.abs(currentLocation.lat - pickup.lat) > 0.001 || Math.abs(currentLocation.lon - pickup.lon) > 0.001)) {
      const nextPickup = {
        name: pickupLocationName || currentLocation.name || pickup.name,
        lat: currentLocation.lat,
        lon: currentLocation.lon,
      };
      setPickup(nextPickup);
      triggerRecalculate(nextPickup, stops, dropoff);
    }
  }, [currentLocation?.lat, currentLocation?.lon]);

  // Geocode pickupLocationName and dropLocationName directly to ensure exact coordinates
  useEffect(() => {
    if (pickupLocationName && (!currentLocation || !currentLocation.lat)) {
      geocodePlace(pickupLocationName).then((geo) => {
        if (geo && (Math.abs(geo.lat - pickup.lat) > 0.01 || Math.abs(geo.lon - pickup.lon) > 0.01)) {
          const next = { name: pickupLocationName, lat: geo.lat, lon: geo.lon };
          setPickup(next);
          triggerRecalculate(next, stops, dropoff);
        }
      });
    }

    if (dropLocationName && (!destinationLocation || !destinationLocation.lat)) {
      geocodePlace(dropLocationName).then((geo) => {
        if (geo && (Math.abs(geo.lat - dropoff.lat) > 0.01 || Math.abs(geo.lon - dropoff.lon) > 0.01)) {
          const next = { name: dropLocationName, lat: geo.lat, lon: geo.lon };
          setDropoff(next);
          triggerRecalculate(pickup, stops, next);
        }
      });
    }
  }, [pickupLocationName, dropLocationName]);

  // ----------------------------------------------------
  // TWO-PHASE SEARCH LOGIC (0ms Instant Curated + 200ms Debounced Online Photon + Nominatim)
  // ----------------------------------------------------
  const performSearch = useCallback(
    (
      query: string,
      referenceCoords: { lat: number; lon: number },
      setResults: (res: PlaceSuggestion[]) => void,
      setLoading: (l: boolean) => void,
      debounceRef: React.MutableRefObject<any>
    ) => {
      const trimmed = query.trim();
      if (!trimmed || trimmed.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      const clean = trimmed.toLowerCase();

      // 1. Instant Curated Matches (0ms)
      const instantCurated = searchLandmarksOffline(trimmed, referenceCoords);
      if (instantCurated.length > 0) {
        setResults(instantCurated);
      }

      // 2. Debounced Online Photon & Nominatim Query (200ms)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          if (searchCacheRef.current.has(clean)) {
            const cached = searchCacheRef.current.get(clean)!;
            setResults(cached);
            setLoading(false);
            return;
          }
          const onlineResults = await searchPlacesOnlineUnified(trimmed, referenceCoords);
          const merged = mergeSearchResults(instantCurated, onlineResults);
          if (merged.length > 0) {
            searchCacheRef.current.set(clean, merged);
          }
          setResults(merged);
        } catch (err) {
          console.warn('Search error:', err);
        } finally {
          setLoading(false);
        }
      }, 200);
    },
    []
  );

  // Listen for Pickup search text changes
  useEffect(() => {
    if (isEditingPickup) {
      performSearch(pickupQuery, pickup, setPickupSuggestions, setIsSearchingPickup, pickupDebounceRef);
    }
  }, [pickupQuery, isEditingPickup, pickup, performSearch]);

  // Listen for Drop-off search text changes
  useEffect(() => {
    if (isEditingDropoff) {
      performSearch(dropoffQuery, dropoff, setDropoffSuggestions, setIsSearchingDropoff, dropoffDebounceRef);
    }
  }, [dropoffQuery, isEditingDropoff, dropoff, performSearch]);

  // Listen for Add Stop search text changes
  useEffect(() => {
    if (stopQuery.trim().length >= 2) {
      setShowStopDropdown(true);
    }
    performSearch(
      stopQuery,
      pickup,
      (res) => {
        setStopSuggestions(res);
      },
      setIsSearchingStop,
      stopDebounceRef
    );
  }, [stopQuery, pickup, performSearch]);

  // Handle Add Stop
  const handleAddStop = (place: { name: string; lat: number; lon: number }) => {
    const newStop: IntermediateStop = {
      id: `stop-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
    };
    const nextStops = [...stops, newStop];
    setStops(nextStops);
    setStopQuery('');
    setStopSuggestions([]);
    setShowStopDropdown(false);
    triggerRecalculate(pickup, nextStops, dropoff);
  };

  // Handle Remove Stop
  const handleRemoveStop = (id: string) => {
    const nextStops = stops.filter((s) => s.id !== id);
    setStops(nextStops);
    triggerRecalculate(pickup, nextStops, dropoff);
  };

  // Handle Live GPS Detection
  const handleUseCurrentGps = async () => {
    setIsDetectingGps(true);
    try {
      const coords = await locationService.getCurrentCoordinates();
      if (coords) {
        const nextPickup = {
          name: 'Current Live GPS Location',
          lat: coords.lat,
          lon: coords.lon,
        };
        setPickup(nextPickup);
        setIsEditingPickup(false);
        triggerRecalculate(nextPickup, stops, dropoff);
      }
    } catch (err) {
      console.warn('GPS detection error:', err);
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Map Message Handler (Tap on map to add waypoint, handshake when map is ready)
  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'map_ready') {
        if (lastInjectedPayloadRef.current && webViewRef.current) {
          webViewRef.current.injectJavaScript(
            `if (window.renderMultiRoutes) { window.renderMultiRoutes(${JSON.stringify(JSON.stringify(lastInjectedPayloadRef.current))}); } true;`
          );
        }
      } else if (data.type === 'map_clicked' && data.lat && data.lon) {
        const stopName = `Pinned Waypoint (${data.lat.toFixed(4)}, ${data.lon.toFixed(4)})`;
        handleAddStop({ name: stopName, lat: data.lat, lon: data.lon });
      }
    } catch (err) {
      console.warn('WebView message error:', err);
    }
  };

  // Leaflet HTML with Teardrop SVG Map Pins and Dual-Color Route Rendering
  const generateLeafletHtml = (lat: number, lon: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #f8fafc; }
    .custom-map-pin {
      background: transparent !important;
      border: 0 !important;
    }
    .route-legend {
      position: absolute;
      bottom: 10px;
      left: 10px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(4px);
      padding: 5px 9px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10.5px;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      pointer-events: none;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .legend-bar {
      display: inline-block;
      width: 15px;
      height: 4px;
      border-radius: 2px;
    }
    .legend-bar.dashed {
      border-bottom: 2px dashed #ea580c;
      background: transparent;
      height: 2px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="route-legend" class="route-legend" style="display: none;">
    <div class="legend-item">
      <span class="legend-bar" style="background: #2563eb;"></span>
      <span id="legend-label-1" style="color: #1d4ed8;">Forward</span>
    </div>
    <div class="legend-item" id="legend-item-2">
      <span class="legend-bar dashed"></span>
      <span id="legend-label-2" style="color: #c2410c;">Return</span>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([${lat}, ${lon}], 9);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // Handshake: notify React Native that Leaflet map instance is fully ready
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map_ready' }));
    }

    var directRouteLayer = null;
    var multiRouteLayers = [];
    var originMarker = null;
    var destMarker = null;
    var stopMarkers = [];

    // Precise Teardrop Map Pin Factory (matching Quotation Map & Google Maps)
    function createTeardropPin(label, markerColor, isDual) {
      var pinW = isDual ? 36 : 28;
      var pinH = isDual ? 38 : 36;
      var anchorX = pinW / 2;
      var circleR = isDual ? 11 : 9;
      var circleCy = isDual ? 15 : 14;
      var fontSize = isDual ? 9 : 11;
      var textY = isDual ? 18.5 : 18;

      var path = isDual
        ? 'M18 0C8.059 0 0 8.059 0 18C0 28 18 38 18 38C18 38 36 28 36 18C36 8.059 27.941 0 18 0Z'
        : 'M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z';

      var html = '<div style="position:relative;width:' + pinW + 'px;height:' + pinH + 'px;">' +
        '<svg width="' + pinW + '" height="' + pinH + '" viewBox="0 0 ' + pinW + ' ' + pinH + '" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">' +
          '<path d="' + path + '" fill="' + markerColor + '" stroke="#ffffff" stroke-width="2"/>' +
          '<circle cx="' + anchorX + '" cy="' + circleCy + '" r="' + circleR + '" fill="#ffffff"/>' +
          '<text x="' + anchorX + '" y="' + textY + '" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="' + fontSize + '" font-weight="900" fill="' + markerColor + '" text-anchor="middle">' + label + '</text>' +
        '</svg>' +
      '</div>';

      return L.divIcon({
        className: 'custom-map-pin',
        html: html,
        iconSize: [pinW, pinH],
        iconAnchor: [anchorX, pinH],
        popupAnchor: [0, -pinH]
      });
    }

    map.on('click', function(e) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'map_clicked',
          lat: e.latlng.lat,
          lon: e.latlng.lng
        }));
      }
    });

    window.renderMultiRoutes = function(dataStr) {
      try {
        var data = (typeof dataStr === 'string') ? JSON.parse(dataStr) : dataStr;
        if (!data) return;

        if (directRouteLayer) { map.removeLayer(directRouteLayer); directRouteLayer = null; }
        if (multiRouteLayers && multiRouteLayers.length > 0) {
          multiRouteLayers.forEach(function(l) { map.removeLayer(l); });
          multiRouteLayers = [];
        }
        if (originMarker) { map.removeLayer(originMarker); originMarker = null; }
        if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
        stopMarkers.forEach(function(m) { map.removeLayer(m); });
        stopMarkers = [];

        var points = [];

        var isRoundTrip = data.origin && data.destination && (
          Math.hypot(data.origin.lat - data.destination.lat, data.origin.lon - data.destination.lon) < 0.05 ||
          ((data.origin.name || '').toLowerCase().split(',')[0].trim() === (data.destination.name || '').toLowerCase().split(',')[0].trim())
        );

        // 1. Origin Pin (Teardrop Marker 'A')
        if (data.origin) {
          var originColor = isRoundTrip ? '#0f766e' : '#059669';
          var originLabel = isRoundTrip ? 'A • B' : 'A';
          var originPin = createTeardropPin(originLabel, originColor, isRoundTrip);
          originMarker = L.marker([data.origin.lat, data.origin.lon], { icon: originPin }).addTo(map);
          originMarker.bindPopup('<div style="font-family:-apple-system,sans-serif;padding:3px;"><div style="font-weight:700;font-size:12px;color:' + originColor + ';">' + (isRoundTrip ? 'Start & Finish (Round Trip)' : 'Origin') + '</div><div style="font-size:11px;color:#0f172a;margin-top:2px;">' + (data.origin.name || '') + '</div></div>');
          points.push([data.origin.lat, data.origin.lon]);
        }

        // 2. Intermediate Stop Pins (Teardrop Markers '1', '2', '3'...)
        if (Array.isArray(data.stops)) {
          data.stops.forEach(function(s, idx) {
            var stopColor = '#2563eb';
            var stopPin = createTeardropPin('' + (idx + 1), stopColor, false);
            var sm = L.marker([s.lat, s.lon], { icon: stopPin }).addTo(map);
            sm.bindPopup('<div style="font-family:-apple-system,sans-serif;padding:3px;"><div style="font-weight:700;font-size:12px;color:#2563eb;">Stop ' + (idx + 1) + '</div><div style="font-size:11px;color:#0f172a;margin-top:2px;">' + (s.name || '') + '</div></div>');
            stopMarkers.push(sm);
            points.push([s.lat, s.lon]);
          });
        }

        // 3. Destination Pin (Teardrop Marker 'B')
        if (data.destination && !isRoundTrip) {
          var destColor = '#e11d48';
          var destLabel = 'B';
          var destPin = createTeardropPin(destLabel, destColor, false);
          destMarker = L.marker([data.destination.lat, data.destination.lon], { icon: destPin }).addTo(map);
          destMarker.bindPopup('<div style="font-family:-apple-system,sans-serif;padding:3px;"><div style="font-weight:700;font-size:12px;color:#e11d48;">Destination</div><div style="font-size:11px;color:#0f172a;margin-top:2px;">' + (data.destination.name || '') + '</div></div>');
          points.push([data.destination.lat, data.destination.lon]);
        }

        // 4. Baseline Direct Route (Sky Blue Dashed Line)
        if (data.directGeoJson && data.stops && data.stops.length > 0) {
          directRouteLayer = L.geoJSON(data.directGeoJson, {
            style: { color: '#0ea5e9', weight: 3.5, dashArray: '6, 6', opacity: 0.8 }
          }).addTo(map);
        }

        // 5. Active Tour Route - Dual Color Split (Quotation & Live Radar style)
        var coords = [];
        if (data.routeGeoJson && data.routeGeoJson.coordinates && Array.isArray(data.routeGeoJson.coordinates) && data.routeGeoJson.coordinates.length > 0) {
          // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
          coords = data.routeGeoJson.coordinates.map(function(c) { return [c[1], c[0]]; });
        } else if (points.length >= 2) {
          // Guaranteed fallback: connect all waypoints directly
          coords = points.slice();
        }

        if (coords.length > 1) {
          var splitIndex = -1;

          // A. If intermediate stops exist, split at the last intermediate stop
          if (Array.isArray(data.stops) && data.stops.length > 0) {
            var lastStop = data.stops[data.stops.length - 1];
            var minD = Infinity;
            for (var i = 1; i < coords.length - 1; i++) {
              var d = Math.hypot(coords[i][0] - lastStop.lat, coords[i][1] - lastStop.lon);
              if (d < minD) {
                minD = d;
                splitIndex = i;
              }
            }
          }

          // B. If round trip circuit without intermediate stops, find turnaround point
          if (isRoundTrip && splitIndex <= 0 && coords.length > 4) {
            var maxD = -1;
            var turnaroundIdx = Math.floor(coords.length / 2);
            for (var i = 1; i < coords.length - 1; i++) {
              var d = Math.hypot(coords[i][0] - data.origin.lat, coords[i][1] - data.origin.lon);
              if (d > maxD) {
                maxD = d;
                turnaroundIdx = i;
              }
            }
            splitIndex = turnaroundIdx;
          }

          // C. If direct A-to-B route with no intermediate stops, split at midpoint so it ALWAYS displays in Dual Colors (Forward Blue & Approach Orange)
          if (splitIndex <= 0 || splitIndex >= coords.length - 1) {
            splitIndex = Math.max(1, Math.floor(coords.length / 2));
          }

          // Ensure valid split bounds
          if (splitIndex < 1) splitIndex = 1;
          if (splitIndex >= coords.length) splitIndex = Math.max(1, coords.length - 1);

          var legendEl = document.getElementById('route-legend');
          var legendLabel1 = document.getElementById('legend-label-1');
          var legendLabel2 = document.getElementById('legend-label-2');
          var legendItem2 = document.getElementById('legend-item-2');

          // 🔵 Forward / Outbound Polyline: Royal Blue (#2563eb)
          var outboundCoords = coords.slice(0, splitIndex + 1);
          var outboundPolyline = L.polyline(outboundCoords, {
            color: '#2563eb', // Blue-600
            weight: 5,
            opacity: 0.92,
            lineJoin: 'round'
          }).addTo(map);

          // 🟠 Return / Final Leg / Approach: Vibrant Amber Orange (#ea580c)
          var returnCoords = coords.slice(splitIndex);
          var returnPolyline = L.polyline(returnCoords, {
            color: '#ea580c', // Orange-600
            weight: 5,
            opacity: 0.95,
            dashArray: isRoundTrip ? '8, 4' : undefined,
            lineJoin: 'round'
          }).addTo(map);

          multiRouteLayers.push(outboundPolyline, returnPolyline);

          if (legendEl) {
            legendEl.style.display = 'flex';
            if (isRoundTrip) {
              legendLabel1.innerText = 'Outbound';
              legendLabel2.innerText = 'Return';
            } else if (Array.isArray(data.stops) && data.stops.length > 0) {
              legendLabel1.innerText = 'Forward Route';
              legendLabel2.innerText = 'Final Leg';
            } else {
              legendLabel1.innerText = 'Departure Leg';
              legendLabel2.innerText = 'Arrival Leg';
            }
            legendItem2.style.display = 'flex';
          }
        }

        // Auto-fit to view with padding
        if (coords.length > 1) {
          var bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
        } else if (points.length > 1) {
          map.fitBounds(points, { padding: [35, 35], maxZoom: 14 });
        } else if (points.length === 1) {
          map.setView(points[0], 12);
        }

        // Invalidate size on mobile WebViews
        setTimeout(function() { map.invalidateSize(); }, 150);
        setTimeout(function() { map.invalidateSize(); }, 450);
      } catch (err) {
        console.error('renderMultiRoutes error:', err);
      }
    };
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.wrapper}>
      {/* Brand Header */}
      <View style={styles.brandRow}>
        <View style={styles.brandTag}>
          <Text style={styles.brandTagText}>🗺️ TOUR ITINERARY PLANNER</Text>
        </View>
        <Text style={styles.brandSub}>OSRM Fast Road Engine</Text>
      </View>

      {/* 🟢 SECTION 1: Pickup Location (From) */}
      <View style={styles.endpointCard}>
        <View style={styles.endpointHeader}>
          <View style={styles.endpointTitleRow}>
            <View style={[styles.endpointDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.endpointLabel}>Pickup Location (From)</Text>
          </View>
          <View style={styles.endpointActions}>
            <TouchableOpacity
              onPress={handleUseCurrentGps}
              disabled={isDetectingGps}
              style={styles.gpsBtn}
            >
              {isDetectingGps ? (
                <ActivityIndicator size="small" color="#047857" />
              ) : (
                <Text style={styles.gpsBtnText}>🎯 Use GPS</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!isEditingPickup) {
                  setPickupQuery('');
                  setPickupSuggestions([]);
                }
                setIsEditingPickup(!isEditingPickup);
              }}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>{isEditingPickup ? '✕ Close' : '✏️ Edit'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isEditingPickup ? (
          <View style={styles.editBox}>
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={pickupQuery}
                onChangeText={setPickupQuery}
                placeholder="Search town, village, hotel or address..."
                placeholderTextColor="#94a3b8"
                autoFocus
              />
              {isSearchingPickup && (
                <ActivityIndicator size="small" color="#10b981" style={{ marginRight: 6 }} />
              )}
              {pickupQuery.length > 0 && (
                <TouchableOpacity onPress={() => setPickupQuery('')} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Pickup Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniChipsScroll}>
              {POPULAR_PICKUPS.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.miniChip}
                  onPress={() => {
                    const nextPickup = { name: item.name, lat: item.lat, lon: item.lon };
                    setPickup(nextPickup);
                    setIsEditingPickup(false);
                    triggerRecalculate(nextPickup, stops, dropoff);
                  }}
                >
                  <Text style={styles.miniChipText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Searching indicator feedback */}
            {isSearchingPickup && pickupSuggestions.length === 0 && (
              <View style={styles.searchingBox}>
                <ActivityIndicator size="small" color="#10b981" />
                <Text style={styles.searchingText}>Searching OSM map for "{pickupQuery}"...</Text>
              </View>
            )}

            {/* No results feedback */}
            {!isSearchingPickup && pickupQuery.trim().length >= 2 && pickupSuggestions.length === 0 && (
              <View style={styles.noResultsBox}>
                <Text style={styles.noResultsText}>No locations found for "{pickupQuery}".</Text>
                <Text style={styles.noResultsSub}>Try typing a nearby town or junction.</Text>
              </View>
            )}

            {/* Search Suggestions Dropdown */}
            {pickupSuggestions.length > 0 && (
              <View style={styles.searchDropdown}>
                <ScrollView
                  style={{ maxHeight: 220 }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {pickupSuggestions.map((item, idx) => (
                    <TouchableOpacity
                      key={`${item.displayName}-${idx}`}
                      style={styles.searchDropdownItem}
                      onPress={() => {
                        const nextPickup = {
                          name: item.shortName || item.displayName,
                          lat: item.lat,
                          lon: item.lon,
                        };
                        setPickup(nextPickup);
                        setIsEditingPickup(false);
                        triggerRecalculate(nextPickup, stops, dropoff);
                      }}
                    >
                      <Text style={styles.searchItemPin}>📍</Text>
                      <View style={styles.searchItemTextCol}>
                        <View style={styles.searchItemTitleRow}>
                          <Text style={styles.searchItemTitle} numberOfLines={1}>{item.shortName}</Text>
                          {item.category && (
                            <Text style={styles.searchItemCategoryBadge}>{item.category}</Text>
                          )}
                        </View>
                        <Text style={styles.searchItemSub} numberOfLines={1}>{item.displayName}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.endpointValue} numberOfLines={2}>
            📍 {pickup.name}
          </Text>
        )}
      </View>

      {/* 📍 SECTION 2: Intermediate Stops (Waypoints) List */}
      <View style={styles.stopsSection}>
        <View style={styles.stopsHeader}>
          <Text style={styles.stopsLabel}>
            📍 Intermediate Stops ({stops.length})
          </Text>
          {isCalculating && (
            <View style={styles.calcIndicator}>
              <ActivityIndicator size="small" color="#4f46e5" />
              <Text style={styles.calcText}>Recalculating...</Text>
            </View>
          )}
        </View>

        {/* Render Each Stop */}
        {stops.map((stop, idx) => (
          <View key={stop.id} style={styles.stopCard}>
            <View style={styles.stopBadge}>
              <Text style={styles.stopBadgeText}>{idx + 1}</Text>
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName} numberOfLines={1}>
                {stop.name}
              </Text>
              {stop.distanceFromPrevKm !== undefined && (
                <Text style={styles.stopDistance}>
                  ~{stop.distanceFromPrevKm} km from previous • {stop.durationFromPrevText || ''}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleRemoveStop(stop.id)}
              style={styles.trashBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.trashIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Stop Input & Search */}
        <View style={styles.addStopContainer}>
          <Text style={styles.addStopSearchIcon}>➕</Text>
          <TextInput
            style={styles.addStopInput}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            value={stopQuery}
            onChangeText={setStopQuery}
            onFocus={() => {
              if (stopSuggestions.length > 0) setShowStopDropdown(true);
            }}
          />
          {isSearchingStop && (
            <ActivityIndicator size="small" color="#4f46e5" style={{ marginRight: 6 }} />
          )}
          {stopQuery.length > 0 && (
            <TouchableOpacity onPress={() => setStopQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Suggestions Dropdown for Stops */}
        {showStopDropdown && isSearchingStop && stopSuggestions.length === 0 && (
          <View style={[styles.searchingBox, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}>
            <ActivityIndicator size="small" color="#4f46e5" />
            <Text style={[styles.searchingText, { color: '#3730a3' }]}>Searching OSM map for "{stopQuery}"...</Text>
          </View>
        )}

        {showStopDropdown && !isSearchingStop && stopQuery.trim().length >= 2 && stopSuggestions.length === 0 && (
          <View style={styles.noResultsBox}>
            <Text style={styles.noResultsText}>No locations found for "{stopQuery}".</Text>
            <Text style={styles.noResultsSub}>Try typing a nearby town or junction.</Text>
          </View>
        )}

        {showStopDropdown && stopSuggestions.length > 0 && (
          <View style={styles.searchDropdown}>
            <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {stopSuggestions.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.displayName}-${idx}`}
                  style={styles.searchDropdownItem}
                  onPress={() =>
                    handleAddStop({
                      name: item.shortName || item.displayName,
                      lat: item.lat,
                      lon: item.lon,
                    })
                  }
                >
                  <Text style={styles.searchItemPin}>📍</Text>
                  <View style={styles.searchItemTextCol}>
                    <View style={styles.searchItemTitleRow}>
                      <Text style={styles.searchItemTitle} numberOfLines={1}>{item.shortName}</Text>
                      {item.category && (
                        <Text style={styles.searchItemCategoryBadge}>{item.category}</Text>
                      )}
                    </View>
                    <Text style={styles.searchItemSub} numberOfLines={1}>{item.displayName}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick Sightseeing Chips */}
        <View style={styles.chipsWrapper}>
          <Text style={styles.chipsLabel}>⚡ Quick Add Sightseeing Stops:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {QUICK_DETOURS.map((item, index) => {
              const alreadyAdded = stops.some((s) => s.name === item.name);
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleAddStop(item)}
                  style={[styles.chip, alreadyAdded && styles.chipAdded]}
                >
                  <Text style={[styles.chipText, alreadyAdded && styles.chipTextAdded]}>
                    {alreadyAdded ? `✓ ${item.label}` : `+ ${item.label}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* 🏁 SECTION 3: Drop-off Location (To) */}
      <View style={styles.endpointCard}>
        <View style={styles.endpointHeader}>
          <View style={styles.endpointTitleRow}>
            <View style={[styles.endpointDot, { backgroundColor: '#dc2626' }]} />
            <Text style={styles.endpointLabel}>Drop-off / Final Destination (To)</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (!isEditingDropoff) {
                setDropoffQuery('');
                setDropoffSuggestions([]);
              }
              setIsEditingDropoff(!isEditingDropoff);
            }}
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>{isEditingDropoff ? '✕ Close' : '✏️ Edit'}</Text>
          </TouchableOpacity>
        </View>

        {isEditingDropoff ? (
          <View style={styles.editBox}>
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={dropoffQuery}
                onChangeText={setDropoffQuery}
                placeholder="Search town, village, hotel or address..."
                placeholderTextColor="#94a3b8"
                autoFocus
              />
              {isSearchingDropoff && (
                <ActivityIndicator size="small" color="#dc2626" style={{ marginRight: 6 }} />
              )}
              {dropoffQuery.length > 0 && (
                <TouchableOpacity onPress={() => setDropoffQuery('')} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Drop-off Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniChipsScroll}>
              {POPULAR_DROPOFFS.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.miniChip}
                  onPress={() => {
                    const nextDropoff = { name: item.name, lat: item.lat, lon: item.lon };
                    setDropoff(nextDropoff);
                    setIsEditingDropoff(false);
                    triggerRecalculate(pickup, stops, nextDropoff);
                  }}
                >
                  <Text style={styles.miniChipText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Searching indicator feedback */}
            {isSearchingDropoff && dropoffSuggestions.length === 0 && (
              <View style={[styles.searchingBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                <ActivityIndicator size="small" color="#dc2626" />
                <Text style={[styles.searchingText, { color: '#991b1b' }]}>Searching OSM map for "{dropoffQuery}"...</Text>
              </View>
            )}

            {/* No results feedback */}
            {!isSearchingDropoff && dropoffQuery.trim().length >= 2 && dropoffSuggestions.length === 0 && (
              <View style={styles.noResultsBox}>
                <Text style={styles.noResultsText}>No locations found for "{dropoffQuery}".</Text>
                <Text style={styles.noResultsSub}>Try typing a nearby town or junction.</Text>
              </View>
            )}

            {/* Search Suggestions Dropdown */}
            {dropoffSuggestions.length > 0 && (
              <View style={styles.searchDropdown}>
                <ScrollView
                  style={{ maxHeight: 220 }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {dropoffSuggestions.map((item, idx) => (
                    <TouchableOpacity
                      key={`${item.displayName}-${idx}`}
                      style={styles.searchDropdownItem}
                      onPress={() => {
                        const nextDropoff = {
                          name: item.shortName || item.displayName,
                          lat: item.lat,
                          lon: item.lon,
                        };
                        setDropoff(nextDropoff);
                        setIsEditingDropoff(false);
                        triggerRecalculate(pickup, stops, nextDropoff);
                      }}
                    >
                      <Text style={styles.searchItemPin}>📍</Text>
                      <View style={styles.searchItemTextCol}>
                        <View style={styles.searchItemTitleRow}>
                          <Text style={styles.searchItemTitle} numberOfLines={1}>{item.shortName}</Text>
                          {item.category && (
                            <Text style={styles.searchItemCategoryBadge}>{item.category}</Text>
                          )}
                        </View>
                        <Text style={styles.searchItemSub} numberOfLines={1}>{item.displayName}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.endpointValue} numberOfLines={2}>
            🏁 {dropoff.name}
          </Text>
        )}
      </View>

      {/* 🗺️ SECTION 4: Real Leaflet.js Map */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: generateLeafletHtml(pickup.lat, pickup.lon) }}
          style={styles.webView}
          nestedScrollEnabled={true}
          onMessage={onWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          androidLayerType="hardware"
          onLoadEnd={() => {
            const payload = lastInjectedPayloadRef.current || (routeResult ? {
              origin: pickup,
              destination: dropoff,
              stops,
              directGeoJson: routeResult.directGeoJson,
              routeGeoJson: routeResult.routeGeoJson,
            } : null);
            if (payload && webViewRef.current) {
              webViewRef.current.injectJavaScript(
                `if (window.renderMultiRoutes) { window.renderMultiRoutes(${JSON.stringify(JSON.stringify(payload))}); } true;`
              );
            }
          }}
        />
        <View pointerEvents="none" style={styles.attributionBadge}>
          <Text style={styles.attributionText}>🗺️ Leaflet • Tap map to add stop</Text>
        </View>
      </View>

      {/* 🛣️ SECTION 5: Route Impact & Legs Breakdown Card */}
      {routeResult ? (
        <View style={styles.impactCard}>
          <View style={styles.impactHeader}>
            <View style={styles.impactTitleRow}>
              <Text style={styles.impactEmoji}>🛣️</Text>
              <Text style={styles.impactTitle}>ROUTE IMPACT & LEGS (OSRM)</Text>
            </View>
            <View style={styles.autoTag}>
              <Text style={styles.autoTagText}>AUTO-CALCULATED</Text>
            </View>
          </View>

          {/* Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Scheduled Direct</Text>
              <Text style={styles.metricVal}>{routeResult.directDistanceKm} KM</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Via Stops Total</Text>
              <Text style={styles.metricVal}>{routeResult.totalDistanceKm} KM</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={[styles.metricBox, styles.metricHighlight]}>
              <Text style={styles.metricLabelHighlight}>Net Extra KM</Text>
              <Text style={styles.metricValHighlight}>+{routeResult.relativeExtraKm} KM</Text>
            </View>
          </View>

          {/* Toggle Legs Breakdown */}
          {routeResult.legs && routeResult.legs.length > 1 && (
            <View style={styles.legsWrapper}>
              <TouchableOpacity
                onPress={() => setShowLegsBreakdown(!showLegsBreakdown)}
                style={styles.legsToggle}
              >
                <Text style={styles.legsToggleText}>
                  {showLegsBreakdown ? '▼ Hide Step-by-Step Legs' : '▶ View Step-by-Step Legs'}
                </Text>
              </TouchableOpacity>

              {showLegsBreakdown && (
                <View style={styles.legsList}>
                  {routeResult.legs.map((leg: RouteLeg, idx: number) => (
                    <View key={idx} style={styles.legItem}>
                      <View style={styles.legBullet}>
                        <Text style={styles.legBulletText}>{idx + 1}</Text>
                      </View>
                      <View style={styles.legInfo}>
                        <Text style={styles.legNames} numberOfLines={1}>
                          {leg.fromName} ➔ {leg.toName}
                        </Text>
                        <Text style={styles.legMeta}>
                          {leg.distanceKm} km • ~{leg.durationText}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandTag: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  brandTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 0.6,
  },
  brandSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  endpointCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  endpointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  endpointTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endpointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  endpointLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  endpointActions: {
    flexDirection: 'row',
    gap: 6,
  },
  gpsBtn: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gpsBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  editBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  endpointValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  editBox: {
    marginTop: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 38,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    paddingVertical: 0,
  },
  miniChipsScroll: {
    flexDirection: 'row',
    marginTop: 6,
  },
  miniChip: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  miniChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  searchDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    borderRadius: 8,
    marginTop: 6,
    maxHeight: 220,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  searchingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  searchingText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
    marginLeft: 6,
  },
  noResultsBox: {
    padding: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noResultsText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '700',
  },
  noResultsSub: {
    fontSize: 10,
    color: '#b45309',
    marginTop: 2,
  },
  searchDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  searchItemPin: {
    fontSize: 13,
    marginRight: 8,
  },
  searchItemTextCol: {
    flex: 1,
  },
  searchItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  searchItemCategoryBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: 6,
  },
  searchItemSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  stopsSection: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  stopsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stopsLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calcIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calcText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4f46e5',
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  stopBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stopBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e1b4b',
  },
  stopDistance: {
    fontSize: 10,
    color: '#6366f1',
    fontWeight: '600',
    marginTop: 1,
  },
  trashBtn: {
    padding: 6,
    marginLeft: 6,
  },
  trashIcon: {
    fontSize: 14,
  },
  addStopContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 40,
    marginTop: 2,
  },
  addStopSearchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  addStopInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chipsWrapper: {
    marginTop: 8,
  },
  chipsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 6,
  },
  chipAdded: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  chipTextAdded: {
    color: '#3730a3',
  },
  mapContainer: {
    height: 190,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    position: 'relative',
    marginBottom: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  attributionBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  attributionText: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '700',
  },
  impactCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  impactTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  impactEmoji: {
    fontSize: 13,
  },
  impactTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#064e3b',
    letterSpacing: 0.5,
  },
  autoTag: {
    backgroundColor: '#a7f3d0',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  autoTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#065f46',
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricHighlight: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  metricLabelHighlight: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
    textTransform: 'uppercase',
  },
  metricValHighlight: {
    fontSize: 13,
    fontWeight: '900',
    color: '#047857',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
  },
  legsWrapper: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#d1fae5',
    paddingTop: 6,
  },
  legsToggle: {
    alignItems: 'center',
    paddingVertical: 3,
  },
  legsToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  legsList: {
    marginTop: 4,
  },
  legItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  legBullet: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  legBulletText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  legInfo: {
    flex: 1,
  },
  legNames: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  legMeta: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
  },
});
