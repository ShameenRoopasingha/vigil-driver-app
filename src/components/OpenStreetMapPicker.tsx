import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import {
  searchLandmarksOffline,
  searchNominatimOnline,
  mergeSearchResults,
  calculateRoadDistanceOSRM,
  latLonToTile,
  getOsmTileUrl,
  SRI_LANKA_LANDMARKS,
  type PlaceSuggestion,
  type OSRMRouteInfo,
} from '../services/osmService';

interface OpenStreetMapPickerProps {
  onSelectPlace: (place: {
    name: string;
    displayName: string;
    shortName: string;
    lat: number;
    lon: number;
    roadDistanceKm?: number;
    durationText?: string;
  }) => void;
  currentLocation?: { lat: number; lon: number } | null;
  initialLocationName?: string;
  initialCoords?: { lat: number; lon: number } | null;
  placeholder?: string;
}

export default function OpenStreetMapPicker({
  onSelectPlace,
  currentLocation,
  initialLocationName = '',
  initialCoords = null,
  placeholder = 'Search attraction, city, hotel or address in Sri Lanka...',
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

  // Routing calculation info (from current location or tour start)
  const [routeInfo, setRouteInfo] = useState<OSRMRouteInfo | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Interactive OpenStreetMap preview zoom level
  const [zoom, setZoom] = useState(15);

  // Measured container width for accurate tile centering
  const [mapWidth, setMapWidth] = useState(Dimensions.get('window').width - 56);
  const MAP_HEIGHT = 200;

  const debounceTimerRef = useRef<any>(null);
  const searchCacheRef = useRef<Map<string, PlaceSuggestion[]>>(new Map());

  const onMapLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setMapWidth(width);
  }, []);

  // Live Instant (Offline First) + Debounced Online OpenStreetMap Search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    // Do not trigger dropdown if query matches the already selected place
    if (selectedPlace && (trimmed === selectedPlace.shortName || trimmed === selectedPlace.displayName)) {
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

  // When a place is selected, compute OSRM driving distance
  const handleSelectSuggestion = async (place: PlaceSuggestion) => {
    setShowDropdown(false);
    setQuery(place.shortName);
    setSelectedPlace({
      displayName: place.displayName,
      shortName: place.shortName,
      lat: place.lat,
      lon: place.lon,
    });

    let extraKm: number | undefined = undefined;
    let duration: string | undefined = undefined;

    if (currentLocation) {
      setIsCalculatingRoute(true);
      try {
        const info = await calculateRoadDistanceOSRM(currentLocation, {
          lat: place.lat,
          lon: place.lon,
        });
        if (info) {
          setRouteInfo(info);
          extraKm = info.distanceKm;
          duration = info.durationText;
        }
      } catch (err) {
        console.warn('Error calculating road route:', err);
      } finally {
        setIsCalculatingRoute(false);
      }
    }

    onSelectPlace({
      name: place.displayName,
      displayName: place.displayName,
      shortName: place.shortName,
      lat: place.lat,
      lon: place.lon,
      roadDistanceKm: extraKm,
      durationText: duration,
    });
  };

  const handleClear = () => {
    setQuery('');
    setSelectedPlace(null);
    setRouteInfo(null);
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

  // Calculate tile grid for OpenStreetMap (dynamically measured container)
  const renderMapTiles = () => {
    if (!selectedPlace) return null;

    const { xtile, ytile, offsetX, offsetY } = latLonToTile(
      selectedPlace.lat,
      selectedPlace.lon,
      zoom
    );

    const containerWidth = mapWidth;
    const containerHeight = MAP_HEIGHT;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    // Use a 5x5 grid to guarantee full coverage on all screen sizes
    const tileOffsets = [-2, -1, 0, 1, 2];

    return (
      <View
        style={[styles.mapContainer, { width: '100%', height: containerHeight }]}
        onLayout={onMapLayout}
      >
        {tileOffsets.map((dx) =>
          tileOffsets.map((dy) => {
            const tileX = xtile + dx;
            const tileY = ytile + dy;
            const tileLeft = centerX - offsetX + dx * 256;
            const tileTop = centerY - offsetY + dy * 256;
            const tileUrl = getOsmTileUrl(zoom, tileX, tileY);

            // Only render tiles that are at least partially visible
            if (
              tileLeft + 256 < 0 ||
              tileLeft > containerWidth ||
              tileTop + 256 < 0 ||
              tileTop > containerHeight
            ) {
              return null;
            }

            return (
              <Image
                key={`${tileX}-${tileY}-${zoom}`}
                source={{ uri: tileUrl }}
                style={[
                  styles.mapTile,
                  {
                    left: tileLeft,
                    top: tileTop,
                  },
                ]}
                resizeMode="cover"
              />
            );
          })
        )}

        {/* Focal Pin placed exactly at center coordinates */}
        <View pointerEvents="none" style={styles.pinWrapper}>
          <View style={styles.pinShadow} />
          <Text style={styles.pinEmoji}>📍</Text>
        </View>

        {/* Zoom Controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom((prev) => Math.min(prev + 1, 17))}
            activeOpacity={0.7}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom((prev) => Math.max(prev - 1, 8))}
            activeOpacity={0.7}
          >
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>
        </View>

        {/* OpenStreetMap Attribution & Level Badge */}
        <View style={styles.attributionBadge}>
          <Text style={styles.attributionText}>© OpenStreetMap contributors • Z{zoom}</Text>
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

      {/* Selected Location Card & OpenStreetMap Preview */}
      {selectedPlace && (
        <View style={styles.previewCard}>
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

          {/* OpenStreetMap Interactive Tile View */}
          {renderMapTiles()}

          {/* OSRM Road Distance Calculation Banner */}
          <View style={styles.roadInfoBanner}>
            {isCalculatingRoute ? (
              <View style={styles.calculatingRow}>
                <ActivityIndicator size="small" color="#10b981" />
                <Text style={styles.calculatingText}>
                  Calculating exact road route via OSRM...
                </Text>
              </View>
            ) : routeInfo ? (
              <View style={styles.routeResultRow}>
                <View style={styles.routeResultCol}>
                  <Text style={styles.routeDistanceText}>
                    +{routeInfo.distanceKm} KM
                  </Text>
                  <Text style={styles.routeDistanceSub}>Estimated road detour</Text>
                </View>
                <View style={styles.routeDivider} />
                <View style={styles.routeResultCol}>
                  <Text style={styles.routeDurationText}>
                    {routeInfo.durationText}
                  </Text>
                  <Text style={styles.routeDurationSub}>Driving time via OSRM</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.defaultRouteNotice}>
                ✓ Coordinates locked. Ready to append to tour itinerary.
              </Text>
            )}
          </View>

          {/* Quick Action Navigation Buttons */}
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
        </View>
      )}
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
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginVertical: 8,
  },
  mapTile: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
  pinWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -14,
    marginTop: -30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  pinShadow: {
    position: 'absolute',
    bottom: 0,
    width: 12,
    height: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  pinEmoji: {
    fontSize: 28,
  },
  zoomControls: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    zIndex: 30,
    elevation: 4,
  },
  zoomButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  attributionBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 30,
  },
  attributionText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
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
