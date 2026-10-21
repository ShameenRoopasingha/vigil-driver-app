import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  searchLandmarksOffline,
  searchNominatimOnline,
  mergeSearchResults,
  calculateDirectRouteOSRM,
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

const QUICK_DETOURS = [
  { label: '🐘 Pinnawala', name: 'Pinnawala Elephant Orphanage', lat: 7.3013, lon: 80.3871 },
  { label: '🗼 Ambuluwawa', name: 'Ambuluwawa Biodiversity Complex, Gampola', lat: 7.1742, lon: 80.5286 },
  { label: '🦁 Sigiriya', name: 'Sigiriya Rock Fortress, Sigiriya', lat: 7.9541, lon: 80.7553 },
  { label: '🪨 Dambulla', name: 'Dambulla Cave Temple, Dambulla', lat: 7.8569, lon: 80.6485 },
  { label: '🏯 Dalada Maligawa', name: 'Temple of the Tooth, Kandy', lat: 7.2936, lon: 80.6413 },
  { label: '🌿 Nine Arch Bridge', name: 'Nine Arches Bridge, Ella', lat: 6.8768, lon: 81.0608 },
  { label: '🌊 Mirissa Beach', name: 'Mirissa Beach, Mirissa', lat: 5.9482, lon: 80.4578 },
  { label: '🏰 Galle Fort', name: 'Galle Fort Main Gate, Galle', lat: 6.0354, lon: 80.2173 },
  { label: '🐆 Yala Safari', name: 'Yala National Park (Palatupana Gate)', lat: 6.2738, lon: 81.4288 },
  { label: '🌁 Horton Plains', name: 'Horton Plains National Park, Ohiya', lat: 6.8096, lon: 80.8144 },
];

export default function OpenStreetMapPicker({
  currentLocation,
  destinationLocation,
  pickupLocationName = '',
  dropLocationName = '',
  initialStops = [],
  routeType = 'DETOUR',
  onItineraryChanged,
  onSelectPlace,
  onRouteCalculated,
  placeholder = 'Search attraction, hotel or city to add stop...',
}: OpenStreetMapPickerProps) {
  // 1. Pickup (From) State
  const [pickup, setPickup] = useState<{ name: string; lat: number; lon: number }>(
    currentLocation
      ? {
          name: pickupLocationName || currentLocation.name || 'Current Location',
          lat: currentLocation.lat,
          lon: currentLocation.lon,
        }
      : {
          name: pickupLocationName || 'Colombo Fort',
          lat: 6.9271,
          lon: 79.8612,
        }
  );
  const [isEditingPickup, setIsEditingPickup] = useState(false);
  const [pickupSearchText, setPickupSearchText] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>([]);

  // 2. Drop-off (To) State
  const [dropoff, setDropoff] = useState<{ name: string; lat: number; lon: number }>(
    destinationLocation
      ? {
          name: dropLocationName || destinationLocation.name || 'Final Destination',
          lat: destinationLocation.lat,
          lon: destinationLocation.lon,
        }
      : {
          name: dropLocationName || 'Kandy City Center',
          lat: 7.2906,
          lon: 80.6337,
        }
  );
  const [isEditingDropoff, setIsEditingDropoff] = useState(false);
  const [dropoffSearchText, setDropoffSearchText] = useState('');
  const [dropoffSuggestions, setDropoffSuggestions] = useState<PlaceSuggestion[]>([]);

  // 3. Intermediate Stops (Waypoints) List
  const [stops, setStops] = useState<IntermediateStop[]>(initialStops);

  // 4. Add Stop Search State
  const [stopQuery, setStopQuery] = useState('');
  const [stopSuggestions, setStopSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showStopDropdown, setShowStopDropdown] = useState(false);
  const [isSearchingStop, setIsSearchingStop] = useState(false);

  // 5. Multi-Stop Route Result & Recalculation State
  const [routeResult, setRouteResult] = useState<MultiStopRouteResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // 6. UI Controls
  const [showLegsBreakdown, setShowLegsBreakdown] = useState(true);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const stopDebounceRef = useRef<any>(null);
  const searchCacheRef = useRef<Map<string, PlaceSuggestion[]>>(new Map());

  // Sync incoming props
  useEffect(() => {
    if (currentLocation && (currentLocation.lat !== pickup.lat || currentLocation.lon !== pickup.lon)) {
      setPickup({
        name: pickupLocationName || currentLocation.name || pickup.name,
        lat: currentLocation.lat,
        lon: currentLocation.lon,
      });
    }
  }, [currentLocation?.lat, currentLocation?.lon, pickupLocationName]);

  useEffect(() => {
    if (destinationLocation && (destinationLocation.lat !== dropoff.lat || destinationLocation.lon !== dropoff.lon)) {
      setDropoff({
        name: dropLocationName || destinationLocation.name || dropoff.name,
        lat: destinationLocation.lat,
        lon: destinationLocation.lon,
      });
    }
  }, [destinationLocation?.lat, destinationLocation?.lon, dropLocationName]);

  // Recalculate Route whenever Pickup, Dropoff, or Stops change
  const recalculateMultiStopRoute = useCallback(
    async (
      currentPickup = pickup,
      currentStops = stops,
      currentDropoff = dropoff
    ) => {
      setIsCalculating(true);
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

        // Notify parent component
        onItineraryChanged?.({
          pickupLocation: currentPickup,
          dropLocation: currentDropoff,
          stops: currentStops,
          extraKm: result.relativeExtraKm,
          totalKm: result.totalDistanceKm,
          directKm: result.directDistanceKm,
          routeResult: result,
        });

        // Backward compatibility callback
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

        // Inject new routes into Leaflet WebView
        if (webViewRef.current) {
          const payload = {
            origin: currentPickup,
            destination: currentDropoff,
            stops: currentStops,
            directGeoJson: result.directGeoJson,
            routeGeoJson: result.routeGeoJson,
          };
          webViewRef.current.injectJavaScript(
            `if (window.renderMultiRoutes) { window.renderMultiRoutes(${JSON.stringify(JSON.stringify(payload))}); } true;`
          );
        }
      } catch (err) {
        console.warn('Error recalculating multi-stop route:', err);
      } finally {
        setIsCalculating(false);
      }
    },
    [pickup, stops, dropoff, onItineraryChanged, onSelectPlace, onRouteCalculated]
  );

  // Trigger recalculation when endpoints or stops change
  useEffect(() => {
    recalculateMultiStopRoute(pickup, stops, dropoff);
  }, [pickup.lat, pickup.lon, dropoff.lat, dropoff.lon, stops.length]);

  // Handle Add Stop from suggestion or chip
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
    recalculateMultiStopRoute(pickup, nextStops, dropoff);
  };

  // Handle Remove Stop
  const handleRemoveStop = (id: string) => {
    const nextStops = stops.filter((s) => s.id !== id);
    setStops(nextStops);
    recalculateMultiStopRoute(pickup, nextStops, dropoff);
  };

  // Handle Live GPS Detection for Pickup
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
        recalculateMultiStopRoute(nextPickup, stops, dropoff);
      }
    } catch (err) {
      console.warn('Could not get GPS:', err);
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Debounced search for Add Stop input
  useEffect(() => {
    const trimmed = stopQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setStopSuggestions([]);
      setShowStopDropdown(false);
      setIsSearchingStop(false);
      return;
    }

    const clean = trimmed.toLowerCase();
    if (searchCacheRef.current.has(clean)) {
      setStopSuggestions(searchCacheRef.current.get(clean)!);
      setShowStopDropdown(true);
      return;
    }

    const instantCurated = searchLandmarksOffline(trimmed, pickup);
    if (instantCurated.length > 0) {
      setStopSuggestions(instantCurated);
      setShowStopDropdown(true);
    }

    if (stopDebounceRef.current) clearTimeout(stopDebounceRef.current);
    setIsSearchingStop(true);
    stopDebounceRef.current = setTimeout(async () => {
      try {
        const onlineResults = await searchNominatimOnline(trimmed, pickup);
        const merged = mergeSearchResults(instantCurated, onlineResults);
        searchCacheRef.current.set(clean, merged);
        setStopSuggestions(merged);
        setShowStopDropdown(merged.length > 0);
      } catch (err) {
        console.warn('Search error:', err);
      } finally {
        setIsSearchingStop(false);
      }
    }, 250);

    return () => {
      if (stopDebounceRef.current) clearTimeout(stopDebounceRef.current);
    };
  }, [stopQuery, pickup]);

  // Leaflet Map Message Handler (clicks on map add stop)
  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'map_clicked' && data.lat && data.lon) {
        const stopName = `Pinned Waypoint (${data.lat.toFixed(4)}, ${data.lon.toFixed(4)})`;
        handleAddStop({ name: stopName, lat: data.lat, lon: data.lon });
      }
    } catch (err) {
      console.warn('WebView message error:', err);
    }
  };

  // Real Leaflet HTML Template with Multi-Stop Pinning & Sequential Routes
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
    .custom-pin {
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 3px 5px rgba(0,0,0,0.35));
    }
    .custom-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3px 7px;
      border-radius: 12px;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      border: 1.5px solid #ffffff;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([${lat}, ${lon}], 9);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var directRouteLayer = null;
    var multiRouteLayer = null;
    var originMarker = null;
    var destMarker = null;
    var stopMarkers = [];

    var carIcon = L.divIcon({
      className: 'custom-pin',
      html: '<div class="custom-badge" style="background:#2563eb;">🚗 Start</div>',
      iconSize: [58, 22],
      iconAnchor: [29, 11]
    });

    var destIcon = L.divIcon({
      className: 'custom-pin',
      html: '<div class="custom-badge" style="background:#dc2626;">🏁 End</div>',
      iconSize: [54, 22],
      iconAnchor: [27, 11]
    });

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
        if (directRouteLayer) { map.removeLayer(directRouteLayer); directRouteLayer = null; }
        if (multiRouteLayer) { map.removeLayer(multiRouteLayer); multiRouteLayer = null; }
        if (originMarker) { map.removeLayer(originMarker); originMarker = null; }
        if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
        stopMarkers.forEach(function(m) { map.removeLayer(m); });
        stopMarkers = [];

        var points = [];

        if (data.origin) {
          originMarker = L.marker([data.origin.lat, data.origin.lon], { icon: carIcon }).addTo(map);
          points.push([data.origin.lat, data.origin.lon]);
        }

        if (Array.isArray(data.stops)) {
          data.stops.forEach(function(s, idx) {
            var stopIcon = L.divIcon({
              className: 'custom-pin',
              html: '<div class="custom-badge" style="background:#4f46e5;">📍 ' + (idx + 1) + '. ' + (s.name ? s.name.substring(0, 16) : 'Stop') + '</div>',
              iconSize: [85, 22],
              iconAnchor: [42, 11]
            });
            var sm = L.marker([s.lat, s.lon], { icon: stopIcon }).addTo(map);
            stopMarkers.push(sm);
            points.push([s.lat, s.lon]);
          });
        }

        if (data.destination) {
          destMarker = L.marker([data.destination.lat, data.destination.lon], { icon: destIcon }).addTo(map);
          points.push([data.destination.lat, data.destination.lon]);
        }

        if (data.directGeoJson && data.stops && data.stops.length > 0) {
          directRouteLayer = L.geoJSON(data.directGeoJson, {
            style: { color: '#64748b', weight: 3, dashArray: '6, 8', opacity: 0.75 }
          }).addTo(map);
        }

        if (data.routeGeoJson) {
          multiRouteLayer = L.geoJSON(data.routeGeoJson, {
            style: { color: '#10b981', weight: 5, opacity: 0.95 }
          }).addTo(map);
        }

        if (points.length > 1) {
          map.fitBounds(points, { padding: [35, 35], maxZoom: 14 });
        } else if (points.length === 1) {
          map.setView(points[0], 12);
        }
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
        <Text style={styles.brandSub}>OSRM Multi-Stop Road Routing</Text>
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
              onPress={() => setIsEditingPickup(!isEditingPickup)}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>{isEditingPickup ? 'Done' : '✏️ Edit'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isEditingPickup ? (
          <View>
            <TextInput
              style={styles.editInput}
              value={pickupSearchText}
              onChangeText={async (txt) => {
                setPickupSearchText(txt);
                if (txt.trim().length >= 2) {
                  const res = await searchNominatimOnline(txt, pickup);
                  setPickupSuggestions(res);
                } else {
                  setPickupSuggestions([]);
                }
              }}
              placeholder="Search new pickup location..."
              placeholderTextColor="#94a3b8"
            />
            {pickupSuggestions.length > 0 && (
              <View style={styles.subDropdown}>
                {pickupSuggestions.slice(0, 4).map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.subDropdownItem}
                    onPress={() => {
                      setPickup({ name: item.shortName || item.displayName, lat: item.lat, lon: item.lon });
                      setIsEditingPickup(false);
                      setPickupSuggestions([]);
                      setPickupSearchText('');
                    }}
                  >
                    <Text style={styles.subDropdownTitle} numberOfLines={1}>{item.shortName}</Text>
                    <Text style={styles.subDropdownSub} numberOfLines={1}>{item.displayName}</Text>
                  </TouchableOpacity>
                ))}
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

        {/* Stops List */}
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

        {/* Suggestions Dropdown */}
        {showStopDropdown && stopSuggestions.length > 0 && (
          <View style={styles.dropdownContainer}>
            <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {stopSuggestions.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.displayName}-${idx}`}
                  style={styles.dropdownItem}
                  onPress={() =>
                    handleAddStop({
                      name: item.shortName || item.displayName,
                      lat: item.lat,
                      lon: item.lon,
                    })
                  }
                >
                  <Text style={styles.dropdownPin}>📍</Text>
                  <View style={styles.dropdownTextCol}>
                    <Text style={styles.dropdownTitle} numberOfLines={1}>{item.shortName}</Text>
                    <Text style={styles.dropdownSub} numberOfLines={1}>{item.displayName}</Text>
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
            onPress={() => setIsEditingDropoff(!isEditingDropoff)}
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>{isEditingDropoff ? 'Done' : '✏️ Edit'}</Text>
          </TouchableOpacity>
        </View>

        {isEditingDropoff ? (
          <View>
            <TextInput
              style={styles.editInput}
              value={dropoffSearchText}
              onChangeText={async (txt) => {
                setDropoffSearchText(txt);
                if (txt.trim().length >= 2) {
                  const res = await searchNominatimOnline(txt, dropoff);
                  setDropoffSuggestions(res);
                } else {
                  setDropoffSuggestions([]);
                }
              }}
              placeholder="Search new final destination..."
              placeholderTextColor="#94a3b8"
            />
            {dropoffSuggestions.length > 0 && (
              <View style={styles.subDropdown}>
                {dropoffSuggestions.slice(0, 4).map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.subDropdownItem}
                    onPress={() => {
                      setDropoff({ name: item.shortName || item.displayName, lat: item.lat, lon: item.lon });
                      setIsEditingDropoff(false);
                      setDropoffSuggestions([]);
                      setDropoffSearchText('');
                    }}
                  >
                    <Text style={styles.subDropdownTitle} numberOfLines={1}>{item.shortName}</Text>
                    <Text style={styles.subDropdownSub} numberOfLines={1}>{item.displayName}</Text>
                  </TouchableOpacity>
                ))}
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
            if (routeResult) {
              const payload = {
                origin: pickup,
                destination: dropoff,
                stops,
                directGeoJson: routeResult.directGeoJson,
                routeGeoJson: routeResult.routeGeoJson,
              };
              webViewRef.current?.injectJavaScript(
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
    paddingHorizontal: 7,
    paddingVertical: 2,
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
  },
  editInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    color: '#0f172a',
    marginTop: 4,
  },
  subDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 140,
    overflow: 'hidden',
  },
  subDropdownItem: {
    padding: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  subDropdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  subDropdownSub: {
    fontSize: 10,
    color: '#64748b',
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
  dropdownContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#4f46e5',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 180,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  dropdownPin: {
    fontSize: 14,
    marginRight: 8,
  },
  dropdownTextCol: {
    flex: 1,
  },
  dropdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  dropdownSub: {
    fontSize: 10,
    color: '#64748b',
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
