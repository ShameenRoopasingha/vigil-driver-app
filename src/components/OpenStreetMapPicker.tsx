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
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  searchLandmarksOffline,
  searchNominatimOnline,
  mergeSearchResults,
  calculateRoadDistanceOSRM,
  calculateDirectRouteOSRM,
  calculateRelativeDetourOSRM,
  SRI_LANKA_LANDMARKS,
  type PlaceSuggestion,
  type OSRMRouteInfo,
  type RelativeRouteInfo,
} from '../services/osmService';
import { locationService } from '../services/locationService';

export interface OpenStreetMapPickerProps {
  onSelectPlace: (place: {
    name: string;
    displayName: string;
    shortName: string;
    lat: number;
    lon: number;
    roadDistanceKm?: number;
    durationText?: string;
    relativeExtraKm?: number;
    directDistanceKm?: number;
    detourTotalKm?: number;
    distanceToDetourKm?: number;
    durationToDetourText?: string;
  }) => void;
  currentLocation?: { lat: number; lon: number } | null;
  destinationLocation?: { lat: number; lon: number; name?: string } | null;
  initialLocationName?: string;
  initialCoords?: { lat: number; lon: number } | null;
  placeholder?: string;
  routeType?: 'DETOUR' | 'DESTINATION';
  onRouteCalculated?: (info: RelativeRouteInfo | null) => void;
}

export default function OpenStreetMapPicker({
  onSelectPlace,
  currentLocation,
  destinationLocation,
  initialLocationName = '',
  initialCoords = null,
  placeholder = 'Search attraction, city, hotel or address in Sri Lanka...',
  routeType = 'DETOUR',
  onRouteCalculated,
}: OpenStreetMapPickerProps) {
  const [query, setQuery] = useState(initialLocationName);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Selected place state
  const [selectedPlace, setSelectedPlace] = useState<{
    displayName: string;
    shortName: string;
    lat: number;
    lon: number;
  } | null>(
    initialCoords
      ? {
          displayName: initialLocationName || 'Selected Location',
          shortName: initialLocationName || 'Selected Location',
          lat: initialCoords.lat,
          lon: initialCoords.lon,
        }
      : null
  );

  // Relative routing calculation info (direct vs detour)
  const [relativeRoute, setRelativeRoute] = useState<RelativeRouteInfo | null>(null);
  const [baseTourRoute, setBaseTourRoute] = useState<{
    distanceKm: number;
    durationText: string;
    geometry?: any;
  } | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Interactive OpenStreetMap preview zoom level
  const [zoom, setZoom] = useState(14);

  const webViewRef = useRef<WebView>(null);
  const debounceTimerRef = useRef<any>(null);
  const searchCacheRef = useRef<Map<string, PlaceSuggestion[]>>(new Map());

  // Load the initial scheduled tour navigation route when currentLocation or destinationLocation is available
  useEffect(() => {
    let isCancelled = false;
    const loadBaseTour = async () => {
      let origin = currentLocation;
      if (!origin) origin = await locationService.getCurrentCoordinates();
      if (!origin || !destinationLocation) return;

      const direct = await calculateDirectRouteOSRM(origin, destinationLocation);
      if (!isCancelled && direct) {
        setBaseTourRoute(direct);
        if (webViewRef.current) {
          const payload = {
            origin,
            destination: destinationLocation,
            directGeoJson: direct.geometry,
          };
          webViewRef.current.injectJavaScript(
            `if (window.renderRoutes) { window.renderRoutes(${JSON.stringify(JSON.stringify(payload))}); } true;`
          );
        }
      }
    };
    loadBaseTour();
    return () => {
      isCancelled = true;
    };
  }, [
    currentLocation?.lat,
    currentLocation?.lon,
    destinationLocation?.lat,
    destinationLocation?.lon,
  ]);

  // Live Instant (Offline First) + Debounced Online OpenStreetMap Search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    if (
      selectedPlace &&
      (trimmed === selectedPlace.shortName || trimmed === selectedPlace.displayName)
    ) {
      return;
    }

    const clean = trimmed.toLowerCase();

    // 1. Check memory cache for instant results
    if (searchCacheRef.current.has(clean)) {
      const cached = searchCacheRef.current.get(clean)!;
      setSuggestions(cached);
      setShowDropdown(cached.length > 0);
      setIsSearching(false);
      return;
    }

    // 2. INSTANT phase: Show curated Sri Lanka landmarks immediately (0ms delay)
    const instantCurated = searchLandmarksOffline(trimmed, currentLocation);
    if (instantCurated.length > 0) {
      setSuggestions(instantCurated);
      setShowDropdown(true);
    }

    // 3. ONLINE phase: Debounced Nominatim query in background (250ms)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const onlineResults = await searchNominatimOnline(trimmed, currentLocation);
        const merged = mergeSearchResults(instantCurated, onlineResults);
        searchCacheRef.current.set(clean, merged);
        setSuggestions(merged);
        if (merged.length > 0) setShowDropdown(true);
      } catch (err) {
        console.warn('OSM search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, currentLocation, selectedPlace]);

  // When a place is selected, compute Relative OSRM driving distance & draw routes
  const handleSelectSuggestion = async (place: PlaceSuggestion) => {
    setShowDropdown(false);
    setQuery(place.shortName);
    setSelectedPlace({
      displayName: place.displayName,
      shortName: place.shortName,
      lat: place.lat,
      lon: place.lon,
    });

    // Resolve origin coordinates
    let origin = currentLocation;
    if (!origin) {
      origin = await locationService.getCurrentCoordinates();
    }
    if (!origin) {
      origin = { lat: 6.9271, lon: 79.8612 }; // Colombo default fallback
    }

    setIsCalculatingRoute(true);
    try {
      const relInfo = await calculateRelativeDetourOSRM(
        origin,
        { lat: place.lat, lon: place.lon },
        routeType === 'DESTINATION' ? null : destinationLocation
      );

      if (relInfo) {
        setRelativeRoute(relInfo);
        onRouteCalculated?.(relInfo);

        // Inject both routes into Leaflet WebView
        if (webViewRef.current) {
          const payload = {
            origin,
            destination: routeType === 'DESTINATION' ? null : destinationLocation,
            detour: { lat: place.lat, lon: place.lon },
            directGeoJson: relInfo.directGeoJson,
            detourGeoJson: relInfo.detourGeoJson,
          };
          webViewRef.current.injectJavaScript(
            `if (window.renderRoutes) { window.renderRoutes(${JSON.stringify(JSON.stringify(payload))}); } true;`
          );
        }

        onSelectPlace({
          name: place.displayName,
          displayName: place.displayName,
          shortName: place.shortName,
          lat: place.lat,
          lon: place.lon,
          roadDistanceKm: relInfo.relativeExtraKm,
          relativeExtraKm: relInfo.relativeExtraKm,
          directDistanceKm: relInfo.directDistanceKm,
          detourTotalKm: relInfo.detourDistanceKm,
          distanceToDetourKm: relInfo.distanceToDetourKm,
          durationText: relInfo.detourDurationText,
          durationToDetourText: relInfo.durationToDetourText,
        });
      }
    } catch (err) {
      console.warn('Error calculating relative detour:', err);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSelectedPlace(null);
    setRelativeRoute(null);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const openInExternalMaps = () => {
    if (!selectedPlace) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.lat},${selectedPlace.lon}&travelmode=driving`;
    Linking.openURL(url).catch((err) => console.warn('Could not open map:', err));
  };

  const openInOsmWeb = () => {
    if (!selectedPlace) return;
    const url = `https://www.openstreetmap.org/?mlat=${selectedPlace.lat}&mlon=${selectedPlace.lon}#map=${zoom}/${selectedPlace.lat}/${selectedPlace.lon}`;
    Linking.openURL(url).catch((err) => console.warn('Could not open OSM:', err));
  };

  // Real Leaflet.js HTML Template (Renders scheduled tour route & detour deviation)
  const generateLeafletHtml = (lat: number, lon: number, zoomLevel: number = 14) => `
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
      font-size: 28px;
      line-height: 28px;
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
    .leaflet-control-zoom {
      border: 1px solid #cbd5e1 !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1) !important;
      border-radius: 8px !important;
      overflow: hidden !important;
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
    }).setView([${lat}, ${lon}], ${zoomLevel});

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var directRouteLayer = null;
    var detourRouteLayer = null;
    var originMarker = null;
    var destMarker = null;
    var detourMarker = null;

    var carIcon = L.divIcon({
      className: 'custom-pin',
      html: '<div class="custom-badge" style="background:#2563eb;">🚗 You</div>',
      iconSize: [54, 22],
      iconAnchor: [27, 11]
    });

    var destIcon = L.divIcon({
      className: 'custom-pin',
      html: '<div class="custom-badge" style="background:#dc2626;">🏁 End</div>',
      iconSize: [54, 22],
      iconAnchor: [27, 11]
    });

    var detourIcon = L.divIcon({
      className: 'custom-pin',
      html: '<div class="custom-badge" style="background:#059669;">📍 Detour</div>',
      iconSize: [66, 22],
      iconAnchor: [33, 11]
    });

    map.on('click', function(e) {
      if (!detourMarker) {
        detourMarker = L.marker(e.latlng, { icon: detourIcon }).addTo(map);
      } else {
        detourMarker.setLatLng(e.latlng);
      }
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'map_clicked',
          lat: e.latlng.lat,
          lon: e.latlng.lng
        }));
      }
    });

    window.updatePosition = function(newLat, newLon) {
      if (!detourMarker) {
        detourMarker = L.marker([newLat, newLon], { icon: detourIcon }).addTo(map);
      } else {
        detourMarker.setLatLng([newLat, newLon]);
      }
      map.flyTo([newLat, newLon], 14, { duration: 0.6 });
    };

    window.renderRoutes = function(dataStr) {
      try {
        var data = (typeof dataStr === 'string') ? JSON.parse(dataStr) : dataStr;
        if (directRouteLayer) { map.removeLayer(directRouteLayer); directRouteLayer = null; }
        if (detourRouteLayer) { map.removeLayer(detourRouteLayer); detourRouteLayer = null; }
        if (originMarker) { map.removeLayer(originMarker); originMarker = null; }
        if (destMarker) { map.removeLayer(destMarker); destMarker = null; }

        var points = [];

        if (data.origin) {
          originMarker = L.marker([data.origin.lat, data.origin.lon], { icon: carIcon }).addTo(map);
          points.push([data.origin.lat, data.origin.lon]);
        }

        if (data.destination) {
          destMarker = L.marker([data.destination.lat, data.destination.lon], { icon: destIcon }).addTo(map);
          points.push([data.destination.lat, data.destination.lon]);
        }

        if (data.detour) {
          if (!detourMarker) {
            detourMarker = L.marker([data.detour.lat, data.detour.lon], { icon: detourIcon }).addTo(map);
          } else {
            detourMarker.setLatLng([data.detour.lat, data.detour.lon]);
          }
          points.push([data.detour.lat, data.detour.lon]);
        }

        if (data.directGeoJson) {
          directRouteLayer = L.geoJSON(data.directGeoJson, {
            style: { color: '#64748b', weight: 4, dashArray: '6, 8', opacity: 0.8 }
          }).addTo(map);
        }

        if (data.detourGeoJson) {
          detourRouteLayer = L.geoJSON(data.detourGeoJson, {
            style: { color: '#10b981', weight: 5, opacity: 0.95 }
          }).addTo(map);
        }

        if (points.length > 1) {
          map.fitBounds(points, { padding: [35, 35], maxZoom: 14 });
        } else if (points.length === 1) {
          map.setView(points[0], 14);
        }
      } catch (err) {
        console.error('renderRoutes error:', err);
      }
    };
  </script>
</body>
</html>
`;

  const onWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'map_clicked') {
        const { lat, lon } = data;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
            { headers: { 'User-Agent': 'VigilDriverApp/1.0.4 (driver@vigil.app)' } }
          );
          if (res.ok) {
            const json = await res.json();
            const parts = (json.display_name || '').split(',');
            const shortName = parts.slice(0, 2).join(',').trim();
            handleSelectSuggestion({
              displayName: json.display_name,
              shortName: shortName || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
              category: 'Tapped on Map',
              lat,
              lon,
            });
          }
        } catch {
          handleSelectSuggestion({
            displayName: `Selected Coordinate (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
            shortName: `Pinned (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
            category: 'Tapped on Map',
            lat,
            lon,
          });
        }
      }
    } catch (err) {
      console.warn('WebView message parse error:', err);
    }
  };

  // Render Real Leaflet.js Map in Native WebView (Always available)
  const renderMapTiles = () => {
    const centerLat =
      selectedPlace?.lat ||
      currentLocation?.lat ||
      destinationLocation?.lat ||
      7.8731;
    const centerLon =
      selectedPlace?.lon ||
      currentLocation?.lon ||
      destinationLocation?.lon ||
      80.7718;
    const initialZoom = selectedPlace
      ? 13
      : currentLocation && destinationLocation
      ? 9
      : 8;

    return (
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: generateLeafletHtml(centerLat, centerLon, initialZoom) }}
          style={styles.webView}
          nestedScrollEnabled={true}
          onMessage={onWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          androidLayerType="hardware"
          onLoadEnd={() => {
            const origin = currentLocation || { lat: 6.9271, lon: 79.8612 };
            if (selectedPlace && relativeRoute) {
              const payload = {
                origin,
                destination: routeType === 'DESTINATION' ? null : destinationLocation,
                detour: { lat: selectedPlace.lat, lon: selectedPlace.lon },
                directGeoJson: relativeRoute.directGeoJson,
                detourGeoJson: relativeRoute.detourGeoJson,
              };
              webViewRef.current?.injectJavaScript(
                `if (window.renderRoutes) { window.renderRoutes(${JSON.stringify(JSON.stringify(payload))}); } true;`
              );
            } else if (destinationLocation && baseTourRoute?.geometry) {
              const payload = {
                origin,
                destination: destinationLocation,
                directGeoJson: baseTourRoute.geometry,
              };
              webViewRef.current?.injectJavaScript(
                `if (window.renderRoutes) { window.renderRoutes(${JSON.stringify(JSON.stringify(payload))}); } true;`
              );
            }
          }}
        />
        <View pointerEvents="none" style={styles.attributionBadge}>
          <Text style={styles.attributionText}>🗺️ Leaflet • OpenStreetMap Navigation</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Brand Header */}
      <View style={styles.brandRow}>
        <View style={styles.brandTag}>
          <Text style={styles.brandTagText}>🗺️ OPENSTREETMAP</Text>
        </View>
        <Text style={styles.brandSub}>Live Place & Route Explorer</Text>
      </View>

      {/* Search Input Box */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputSearchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {isSearching && (
          <ActivityIndicator size="small" color="#10b981" style={{ marginRight: 6 }} />
        )}
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Live Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdownContainer}>
          <ScrollView
            style={styles.dropdownScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {suggestions.map((item, idx) => (
              <TouchableOpacity
                key={`${item.displayName}-${idx}`}
                style={styles.dropdownItem}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownIconCircle}>
                  <Text style={styles.dropdownItemIcon}>📍</Text>
                </View>
                <View style={styles.dropdownTextCol}>
                  <View style={styles.dropdownTitleRow}>
                    <Text style={styles.dropdownTitle} numberOfLines={1}>
                      {item.shortName}
                    </Text>
                    {item.distanceKm !== undefined && (
                      <Text style={styles.distanceBadge}>~{item.distanceKm} km</Text>
                    )}
                  </View>
                  <Text style={styles.dropdownSub} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.dropdownFooter}>
            <Text style={styles.dropdownFooterText}>
              Verified with OpenStreetMap Nominatim
            </Text>
          </View>
        </View>
      )}

      {/* Popular Sri Lanka Sightseeing Detours Carousel */}
      <View style={styles.presetsWrapper}>
        <Text style={styles.presetsLabel}>Popular Sri Lanka Sightseeing Stops</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScrollContent}
        >
          {SRI_LANKA_LANDMARKS.slice(0, 10).map((lm, idx) => {
            const isSelected = selectedPlace?.shortName === lm.shortName;
            return (
              <TouchableOpacity
                key={idx}
                onPress={() =>
                  handleSelectSuggestion({
                    displayName: lm.name,
                    shortName: lm.shortName,
                    category: lm.category,
                    lat: lm.lat,
                    lon: lm.lon,
                  })
                }
                style={[
                  styles.presetChip,
                  isSelected && styles.presetChipActive,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    isSelected && styles.presetChipTextActive,
                  ]}
                >
                  {lm.shortName.split(',')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Selected Location Card / Route Overview */}
      <View style={styles.previewCard}>
        {selectedPlace ? (
          <View style={styles.previewHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.confirmedBadgeRow}>
                <Text style={styles.confirmedBadge}>✓ PICKED PLACE</Text>
                <Text style={styles.coordsBadge}>
                  {selectedPlace.lat.toFixed(4)}° N, {selectedPlace.lon.toFixed(4)}° E
                </Text>
              </View>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedPlace.shortName}
              </Text>
              <Text style={styles.previewSub} numberOfLines={2}>
                {selectedPlace.displayName}
              </Text>
            </View>
          </View>
        ) : destinationLocation ? (
          <View style={styles.previewHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.confirmedBadgeRow}>
                <Text style={[styles.confirmedBadge, { backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }]}>
                  🏁 ACTIVE TOUR ROUTE
                </Text>
                <Text style={styles.coordsBadge}>Destination: {destinationLocation.name || 'Drop-off'}</Text>
              </View>
              <Text style={styles.previewSub}>
                Tap anywhere on the map to pin a detour, or search an attraction above.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Real Leaflet.js Interactive Map (Live Tour Navigation + Detour Route) */}
        {renderMapTiles()}

        {/* Relative Route Impact Analysis Banner (Calculated via OSRM) */}
        <View style={styles.roadInfoBanner}>
          {isCalculatingRoute ? (
            <View style={styles.calculatingRow}>
              <ActivityIndicator size="small" color="#10b981" />
              <Text style={styles.calculatingText}>
                Analyzing route deviation via OpenStreetMap OSRM...
              </Text>
            </View>
          ) : relativeRoute ? (
            <View style={styles.relativeAnalysisContainer}>
              <View style={styles.relativeMetricsGrid}>
                {destinationLocation ? (
                  <>
                    <View style={styles.relativeMetricCol}>
                      <Text style={styles.relativeMetricLabel}>Scheduled Route</Text>
                      <Text style={styles.relativeMetricVal}>{relativeRoute.directDistanceKm} km</Text>
                      <Text style={styles.relativeMetricSub}>Direct</Text>
                    </View>
                    <View style={styles.relativeDivider} />
                  </>
                ) : null}

                <View style={styles.relativeMetricCol}>
                  <Text style={styles.relativeMetricLabel}>To Detour Stop</Text>
                  <Text style={styles.relativeMetricVal}>{relativeRoute.distanceToDetourKm} km</Text>
                  <Text style={styles.relativeMetricSub}>~{relativeRoute.durationToDetourText || 'Driving'}</Text>
                </View>

                <View style={styles.relativeDivider} />

                <View style={styles.relativeMetricColHighlight}>
                  <Text style={styles.relativeMetricLabelHighlight}>Net Extra Mileage</Text>
                  <Text style={styles.relativeMetricValHighlight}>+{relativeRoute.relativeExtraKm} KM</Text>
                  <Text style={styles.relativeMetricSubHighlight}>Added to Tour</Text>
                </View>
              </View>

              {/* Map Route Legend */}
              <View style={styles.routeLegendRow}>
                <View style={styles.routeLegendItem}>
                  <View style={[styles.legendBar, { backgroundColor: '#64748b' }]} />
                  <Text style={styles.routeLegendText}>Scheduled ({relativeRoute.directDistanceKm} km)</Text>
                </View>
                <View style={styles.routeLegendItem}>
                  <View style={[styles.legendBar, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.routeLegendText}>Via Detour ({relativeRoute.detourDistanceKm} km)</Text>
                </View>
              </View>
            </View>
          ) : baseTourRoute && destinationLocation ? (
            <View style={styles.baseTourNoticeRow}>
              <Text style={styles.baseTourNoticeText}>
                🏁 Scheduled Tour Route: <Text style={{ fontWeight: '800' }}>{baseTourRoute.distanceKm} KM</Text> ({baseTourRoute.durationText})
              </Text>
            </View>
          ) : (
            <Text style={styles.defaultRouteNotice}>
              ✓ OpenStreetMap active. Select a place or tap on map to calculate detour distance.
            </Text>
          )}
        </View>

        {/* Quick Action Navigation Buttons */}
        {selectedPlace ? (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.openMapsButton}
              onPress={openInExternalMaps}
              activeOpacity={0.8}
            >
              <Text style={styles.openMapsButtonText}>🧭 Turn-by-Turn GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.openOsmButton}
              onPress={openInOsmWeb}
              activeOpacity={0.8}
            >
              <Text style={styles.openOsmButtonText}>🌐 OSM Web View</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  inputSearchIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 6,
  },
  clearButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dropdownContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 220,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  dropdownScroll: {
    maxHeight: 190,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dropdownItemIcon: {
    fontSize: 14,
  },
  dropdownTextCol: {
    flex: 1,
  },
  dropdownTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  distanceBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  dropdownSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  dropdownFooter: {
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
  },
  dropdownFooterText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  presetsWrapper: {
    marginTop: 10,
    marginBottom: 8,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  presetScrollContent: {
    gap: 6,
    paddingVertical: 2,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#065f46',
    fontWeight: '800',
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10b981',
    padding: 12,
    marginTop: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  previewHeader: {
    marginBottom: 8,
  },
  confirmedBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  confirmedBadge: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#065f46',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coordsBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  previewSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  mapContainer: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    marginVertical: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  attributionBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 30,
  },
  attributionText: {
    fontSize: 9.5,
    color: '#0f172a',
    fontWeight: '800',
  },
  roadInfoBanner: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  calculatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  calculatingText: {
    fontSize: 11.5,
    color: '#059669',
    fontWeight: '700',
  },
  routeResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 2,
  },
  routeResultCol: {
    alignItems: 'center',
  },
  routeDistanceText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
  },
  routeDistanceSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  routeDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#cbd5e1',
  },
  routeDurationText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0284c7',
  },
  routeDurationSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  defaultRouteNotice: {
    fontSize: 11,
    color: '#065f46',
    fontWeight: '600',
    textAlign: 'center',
  },
  relativeAnalysisContainer: {
    paddingVertical: 2,
  },
  relativeMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  relativeMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  relativeMetricColHighlight: {
    flex: 1.1,
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  relativeMetricLabel: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  relativeMetricVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 1,
  },
  relativeMetricSub: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
  },
  relativeMetricLabelHighlight: {
    fontSize: 9.5,
    color: '#065f46',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  relativeMetricValHighlight: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
    marginTop: 1,
  },
  relativeMetricSubHighlight: {
    fontSize: 9,
    color: '#047857',
    fontWeight: '700',
  },
  relativeDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },
  routeLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  routeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBar: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  routeLegendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  baseTourNoticeRow: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  baseTourNoticeText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  openMapsButton: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  openMapsButtonText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  openOsmButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  openOsmButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
});
