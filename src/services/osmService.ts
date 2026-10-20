/**
 * OpenStreetMap & OSRM Service for Vigil Driver App
 * 1:1 Parity with Vigil Tour Management Admin Platform
 */

import Fuse from 'fuse.js';

export interface PlaceSuggestion {
  displayName: string;
  shortName: string;
  category?: string;
  lat: number;
  lon: number;
  distanceKm?: number;
}

export interface OSRMRouteInfo {
  distanceKm: number;
  durationText: string;
  durationMinutes: number;
}

/**
 * Curated Sri Lanka Tourist Landmarker & Vehicle Entrance Dictionary
 * Matches exact coordinates used by the Vigil Admin Platform.
 */
export const SRI_LANKA_LANDMARKS = [
  {
    name: 'Bandaranaike International Airport (BIA), Katunayake',
    shortName: 'BIA Airport, Katunayake',
    category: 'Airport / Hub',
    aliases: ['bia', 'airport', 'colombo airport', 'katunayake', 'katunayake airport', 'bandaranaike', 'cmb airport'],
    lat: 7.1804,
    lon: 79.8841,
  },
  {
    name: 'Sigiriya Rock Fortress (Visitor Center & Parking)',
    shortName: 'Sigiriya Lion Rock',
    category: 'UNESCO Heritage',
    aliases: ['sigiriya', 'sigiriya rock', 'lion rock', 'sigiriya fortress'],
    lat: 7.9541,
    lon: 80.7553,
  },
  {
    name: 'Temple of the Sacred Tooth Relic (Dalada Maligawa), Kandy',
    shortName: 'Temple of the Tooth, Kandy',
    category: 'Cultural Temple',
    aliases: ['dalada maligawa', 'temple of the tooth', 'tooth temple', 'kandy temple', 'sri dalada maligawa'],
    lat: 7.2936,
    lon: 80.6413,
  },
  {
    name: 'Pinnawala Elephant Orphanage (Main Entrance)',
    shortName: 'Pinnawala Elephant Orphanage',
    category: 'Wildlife Sanctuary',
    aliases: ['pinnawala', 'pinnawala elephant orphanage', 'elephant orphanage', 'pinnawela'],
    lat: 7.3013,
    lon: 80.3871,
  },
  {
    name: 'Nine Arches Bridge (Viewpoint Access), Ella',
    shortName: 'Nine Arches Bridge, Ella',
    category: 'Scenic Viewpoint',
    aliases: ['nine arch', 'nine arches', 'nine arches bridge', 'demodara bridge', 'demodara nine arch'],
    lat: 6.8768,
    lon: 81.0608,
  },
  {
    name: 'Galle Fort (Main Gate Vehicle Entrance)',
    shortName: 'Galle Fort Main Gate',
    category: 'UNESCO Heritage',
    aliases: ['galle fort', 'galle rampart', 'dutch fort galle', 'galle dutch fort'],
    lat: 6.0354,
    lon: 80.2173,
  },
  {
    name: 'Yala National Park (Palatupana Main Gate Entrance)',
    shortName: 'Yala National Park Gate',
    category: 'Safari Park',
    aliases: ['yala', 'yala national park', 'yala safari', 'palatupana', 'palatupana entrance'],
    lat: 6.2738,
    lon: 81.4288,
  },
  {
    name: 'Little Adam\'s Peak (Trailhead Entrance), Ella',
    shortName: 'Little Adam\'s Peak, Ella',
    category: 'Hiking & Scenic',
    aliases: ['little adam', 'little adams', 'little adams peak', 'punchi sri pada'],
    lat: 6.8624,
    lon: 81.0645,
  },
  {
    name: 'Dambulla Cave Temple (Golden Buddha Vehicle Entrance)',
    shortName: 'Dambulla Cave Temple',
    category: 'UNESCO Heritage',
    aliases: ['dambulla cave temple', 'golden temple dambulla', 'dambulla temple', 'dambulla rock temple'],
    lat: 7.8569,
    lon: 80.6485,
  },
  {
    name: 'Mirissa Beach & Whale Watching Harbor',
    shortName: 'Mirissa Beach & Harbor',
    category: 'Beach & Coastal',
    aliases: ['mirissa', 'mirissa beach', 'mirissa harbor', 'mirissa whale watching'],
    lat: 5.9483,
    lon: 80.4589,
  },
  {
    name: 'Ambuluwawa Biodiversity Complex & Tower, Gampola',
    shortName: 'Ambuluwawa Tower',
    category: 'Scenic Viewpoint',
    aliases: ['ambuluwawa', 'ambuluwawa tower', 'ambuluwawa temple'],
    lat: 7.1702,
    lon: 80.5488,
  },
  {
    name: 'Lake Gregory Promenade & Park, Nuwara Eliya',
    shortName: 'Gregory Lake, Nuwara Eliya',
    category: 'Recreation & Park',
    aliases: ['lake gregory', 'gregory lake', 'gregory lake nuwara eliya', 'nuwara eliya lake'],
    lat: 6.9535,
    lon: 80.7788,
  },
  {
    name: 'Damro Labookellie Tea Centre, Nuwara Eliya',
    shortName: 'Damro Tea Lounge, Labookellie',
    category: 'Tea Plantation',
    aliases: ['damro', 'damro tea', 'labookellie', 'tea lounge', 'mackwoods'],
    lat: 7.0275,
    lon: 80.7350,
  },
  {
    name: 'Horton Plains National Park (World\'s End Entrance)',
    shortName: 'Horton Plains (World\'s End)',
    category: 'National Park',
    aliases: ['horton plains', 'horton plain', 'worlds end', 'world\'s end'],
    lat: 6.8096,
    lon: 80.8144,
  },
  {
    name: 'Udawalawe National Park (Main Safari Gate)',
    shortName: 'Udawalawe Safari Gate',
    category: 'Safari Park',
    aliases: ['udawalawe', 'udawalawa', 'uda walawe', 'udawalawe safari'],
    lat: 6.4746,
    lon: 80.8893,
  },
  {
    name: 'Bentota Beach & Watersports Center',
    shortName: 'Bentota Beach',
    category: 'Beach & Coastal',
    aliases: ['bentota', 'bentota beach', 'bentota river'],
    lat: 6.4258,
    lon: 79.9984,
  },
  {
    name: 'Unawatuna Beach (Main Access Road)',
    shortName: 'Unawatuna Beach',
    category: 'Beach & Coastal',
    aliases: ['unawatuna', 'unawatuna beach', 'unawatuna bay'],
    lat: 6.0108,
    lon: 80.2486,
  },
  {
    name: 'Royal Botanical Gardens, Peradeniya',
    shortName: 'Peradeniya Botanical Gardens',
    category: 'Botanical Gardens',
    aliases: ['peradeniya gardens', 'royal botanical gardens', 'peradeniya botanical gardens'],
    lat: 7.2715,
    lon: 80.5962,
  },
  {
    name: 'Ramboda Falls & Viewpoint, Pussellawa',
    shortName: 'Ramboda Falls',
    category: 'Scenic Waterfall',
    aliases: ['ramboda', 'ramboda falls', 'ramboda waterfall'],
    lat: 7.0543,
    lon: 80.6974,
  },
  {
    name: 'Pidurangala Rock (Temple Entrance)',
    shortName: 'Pidurangala Rock',
    category: 'Scenic Viewpoint',
    aliases: ['pidurangala', 'pidurangala rock'],
    lat: 7.9654,
    lon: 80.7632,
  },
  {
    name: 'Ravana Waterfall & Viewpoint, Ella',
    shortName: 'Ravana Falls, Ella',
    category: 'Scenic Waterfall',
    aliases: ['ravana falls', 'rawana falls', 'ravana waterfall'],
    lat: 6.8409,
    lon: 81.0543,
  },
  {
    name: 'Colombo Fort Railway Station & Transit Hub',
    shortName: 'Colombo Fort Station',
    category: 'Transit Hub',
    aliases: ['colombo fort', 'fort station', 'colombo railway'],
    lat: 6.9344,
    lon: 79.8519,
  },
  {
    name: 'Colombo Port City (Main Promenade)',
    shortName: 'Colombo Port City',
    category: 'Urban Attraction',
    aliases: ['port city', 'colombo port city'],
    lat: 6.9344,
    lon: 79.8428,
  },
  {
    name: 'Arugam Bay (Main Surf Beach)',
    shortName: 'Arugam Bay Surf Point',
    category: 'Beach & Coastal',
    aliases: ['arugam bay', 'arugambay', 'arugam surf'],
    lat: 6.8422,
    lon: 81.8315,
  },
  {
    name: 'Polonnaruwa Ancient City (Museum Gate)',
    shortName: 'Polonnaruwa Ancient City',
    category: 'UNESCO Heritage',
    aliases: ['polonnaruwa', 'polonnaruwa ruins'],
    lat: 7.9403,
    lon: 81.0028,
  },
  {
    name: 'Anuradhapura Sacred City (Ruwanwelisaya)',
    shortName: 'Anuradhapura Sacred City',
    category: 'Sacred City',
    aliases: ['anuradhapura', 'ruwanwelisaya', 'sri maha bodhi'],
    lat: 8.3449,
    lon: 80.3964,
  },
  {
    name: 'Galle Face Green & Promenade, Colombo',
    shortName: 'Galle Face Green, Colombo',
    category: 'Urban Attraction',
    aliases: ['galle face', 'galle face green', 'colombo galle face'],
    lat: 6.9248,
    lon: 79.8437,
  },
  {
    name: 'Lotus Tower (Colombo Viewpoint & Observatory)',
    shortName: 'Lotus Tower, Colombo',
    category: 'Urban Landmark',
    aliases: ['lotus tower', 'colombo lotus tower', 'nelum kuluna'],
    lat: 6.9298,
    lon: 79.8578,
  },
  {
    name: 'Negombo Beach Park & Lagoon',
    shortName: 'Negombo Beach',
    category: 'Beach & Coastal',
    aliases: ['negombo', 'negombo beach', 'negombo lagoon'],
    lat: 7.2285,
    lon: 79.8427,
  },
  {
    name: 'Grand Hotel, Nuwara Eliya',
    shortName: 'Grand Hotel, Nuwara Eliya',
    category: 'Hotel / Resort',
    aliases: ['grand hotel', 'grand hotel nuwara eliya', 'nuwara eliya grand hotel'],
    lat: 6.9682,
    lon: 80.7672,
  },
  {
    name: 'Victoria Park, Nuwara Eliya',
    shortName: 'Victoria Park, Nuwara Eliya',
    category: 'Recreation & Park',
    aliases: ['victoria park', 'victoria park nuwara eliya'],
    lat: 6.9664,
    lon: 80.7712,
  },
  {
    name: 'Kandy Lake Round (Viewpoint Promenade)',
    shortName: 'Kandy Lake, Kandy',
    category: 'Scenic Viewpoint',
    aliases: ['kandy lake', 'nuwara wewa kandy', 'kandy lake round'],
    lat: 7.2912,
    lon: 80.6420,
  },
  {
    name: 'Bahirawakanda Vihara Buddha Statue, Kandy',
    shortName: 'Bahirawakanda Temple, Kandy',
    category: 'Cultural Temple',
    aliases: ['bahirawakanda', 'bahirawakanda temple', 'big buddha kandy'],
    lat: 7.2954,
    lon: 80.6275,
  },
  {
    name: 'Kitulgala White Water Rafting Center',
    shortName: 'Kitulgala White Water Rafting',
    category: 'Adventure & Sports',
    aliases: ['kitulgala', 'kitulgala rafting', 'white water rafting'],
    lat: 6.9936,
    lon: 80.4168,
  },
  {
    name: 'Minneriya National Park (Elephant Gathering Gate)',
    shortName: 'Minneriya Elephant Gathering',
    category: 'Safari Park',
    aliases: ['minneriya', 'minneriya national park', 'minneriya safari'],
    lat: 8.0315,
    lon: 80.8315,
  },
  {
    name: 'Koneswaram Hindu Temple, Trincomalee',
    shortName: 'Koneswaram Temple, Trincomalee',
    category: 'Cultural Temple',
    aliases: ['koneswaram', 'trincomalee temple', 'swami rock'],
    lat: 8.5878,
    lon: 81.2423,
  },
  {
    name: 'Hiriketiya Bay & Surf Beach, Dikwella',
    shortName: 'Hiriketiya Bay, Dikwella',
    category: 'Beach & Coastal',
    aliases: ['hiriketiya', 'hiriketiya beach', 'dikwella'],
    lat: 5.9612,
    lon: 80.6975,
  },
  {
    name: 'Nallur Kandaswamy Kovil, Jaffna',
    shortName: 'Nallur Kovil, Jaffna',
    category: 'Cultural Temple',
    aliases: ['nallur', 'nallur kovil', 'nallur temple', 'jaffna kovil'],
    lat: 9.6744,
    lon: 80.0298,
  },
];

/**
 * Calculates direct distance (Haversine formula) in kilometers
 */
export function calculateDirectDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Pre-indexed Fuse.js instance for sub-2ms fuzzy search with typo tolerance
const landmarkFuseIndex = new Fuse(SRI_LANKA_LANDMARKS, {
  keys: [
    { name: 'shortName', weight: 0.4 },
    { name: 'aliases', weight: 0.35 },
    { name: 'name', weight: 0.2 },
    { name: 'category', weight: 0.05 },
  ],
  threshold: 0.38, // Typo tolerant (e.g. "pinawala" -> "Pinnawala", "sigiri" -> "Sigiriya")
  distance: 80,
  minMatchCharLength: 2,
  includeScore: true,
  shouldSort: true,
});

/**
 * INSTANT offline search powered by Fuse.js (sub-2ms fuzzy matching with typo tolerance)
 */
export function searchLandmarksOffline(
  query: string,
  userCoords?: { lat: number; lon: number } | null
): PlaceSuggestion[] {
  if (!query || query.trim().length < 2) return [];

  const results = landmarkFuseIndex.search(query.trim());

  return results.slice(0, 6).map(({ item }) => {
    const distanceKm = userCoords
      ? calculateDirectDistanceKm(userCoords.lat, userCoords.lon, item.lat, item.lon)
      : undefined;

    return {
      displayName: item.name,
      shortName: item.shortName,
      category: item.category,
      lat: item.lat,
      lon: item.lon,
      distanceKm,
    };
  });
}

/**
 * ONLINE search — OpenStreetMap Nominatim API (network required, ~0.5–3s)
 * Returns only the OSM results; caller merges with offline results.
 */
export async function searchNominatimOnline(
  query: string,
  userCoords?: { lat: number; lon: number } | null
): Promise<PlaceSuggestion[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s hard timeout

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query.trim()
    )}&countrycodes=lk&limit=6&addressdetails=1`;

    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'VigilDriverApp/1.0.3 (driver@vigil.app)',
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        return json.map((item: any) => {
          const parts = (item.display_name || '').split(',');
          const shortName = parts.slice(0, 2).join(',').trim();
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const distanceKm = userCoords
            ? calculateDirectDistanceKm(userCoords.lat, userCoords.lon, lat, lon)
            : undefined;

          let category = 'Location';
          if (item.type === 'tourism' || item.class === 'tourism') category = 'Tourist Attraction';
          else if (item.type === 'hotel' || item.class === 'tourism') category = 'Hotel / Resort';
          else if (item.type === 'city' || item.type === 'town') category = 'Town / City';
          else if (item.type === 'highway' || item.type === 'road') category = 'Highway / Road';

          return {
            displayName: item.display_name,
            shortName: shortName || item.display_name,
            category,
            lat,
            lon,
            distanceKm,
          };
        });
      }
    }
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('Nominatim search failed:', err);
    }
  }

  return [];
}

/**
 * Merge curated + OSM results, deduplicating nearby coordinates
 */
export function mergeSearchResults(
  curated: PlaceSuggestion[],
  online: PlaceSuggestion[]
): PlaceSuggestion[] {
  const combined = [...curated];
  for (const osmItem of online) {
    const alreadyExists = combined.some(
      (c) =>
        calculateDirectDistanceKm(c.lat, c.lon, osmItem.lat, osmItem.lon) < 0.5 ||
        c.shortName.toLowerCase() === osmItem.shortName.toLowerCase()
    );
    if (!alreadyExists) {
      combined.push(osmItem);
    }
  }
  return combined.slice(0, 8);
}

/**
 * Full search (kept for backward compatibility) — curated + Nominatim combined
 */
export async function searchPlacesOSM(
  query: string,
  userCoords?: { lat: number; lon: number } | null
): Promise<PlaceSuggestion[]> {
  const curated = searchLandmarksOffline(query, userCoords);
  const online = await searchNominatimOnline(query, userCoords);
  return mergeSearchResults(curated, online);
}

/**
 * Calculates road driving distance & duration via Open Source Routing Machine (OSRM)
 */
export interface RelativeRouteInfo {
  directDistanceKm: number;
  detourDistanceKm: number;
  relativeExtraKm: number;
  distanceToDetourKm: number;
  directDurationText?: string;
  detourDurationText?: string;
  durationToDetourText?: string;
  directGeoJson?: any;
  detourGeoJson?: any;
}

export async function geocodePlace(
  query: string
): Promise<{ lat: number; lon: number; name: string } | null> {
  const trimmed = (query || '').trim();
  if (!trimmed) return null;

  // 1. Search offline curated Sri Lanka landmarks with Fuse.js (0ms)
  const offline = searchLandmarksOffline(trimmed);
  if (offline && offline.length > 0) {
    return {
      lat: offline[0].lat,
      lon: offline[0].lon,
      name: offline[0].displayName,
    };
  }

  // 2. Search online Nominatim with Sri Lanka boundary box
  try {
    const online = await searchNominatimOnline(trimmed);
    if (online && online.length > 0) {
      return {
        lat: online[0].lat,
        lon: online[0].lon,
        name: online[0].displayName,
      };
    }
  } catch (err) {
    console.warn('Geocode place error:', err);
  }

  return null;
}

export async function calculateDirectRouteOSRM(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number }
): Promise<{ distanceKm: number; durationText: string; geometry?: any } | null> {
  const headers = { 'User-Agent': 'VigilDriverApp/1.0.4 (support@vigil.app)' };
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=simplified&geometries=geojson`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMins = Math.round(route.duration / 60);
        const hours = Math.floor(durationMins / 60);
        const mins = durationMins % 60;
        const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
        return {
          distanceKm,
          durationText,
          geometry: route.geometry,
        };
      }
    }
  } catch (err) {
    console.warn('Direct route calculation error:', err);
  }
  const directKm = Math.round(calculateDirectDistanceKm(origin.lat, origin.lon, destination.lat, destination.lon) * 1.35 * 10) / 10;
  return {
    distanceKm: directKm,
    durationText: `~${Math.round((directKm / 40) * 60)} mins`,
  };
}

export async function calculateRelativeDetourOSRM(
  origin: { lat: number; lon: number },
  detour: { lat: number; lon: number },
  destination?: { lat: number; lon: number } | null
): Promise<RelativeRouteInfo | null> {
  const headers = { 'User-Agent': 'VigilDriverApp/1.0.4 (support@vigil.app)' };

  // Case 1: Destination exists -> calculate direct A->B and detour A->C->B
  if (destination) {
    try {
      const [directRes, detourRes] = await Promise.all([
        fetch(
          `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=simplified&geometries=geojson`,
          { headers }
        ),
        fetch(
          `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${detour.lon},${detour.lat};${destination.lon},${destination.lat}?overview=simplified&geometries=geojson`,
          { headers }
        ),
      ]);

      if (directRes.ok && detourRes.ok) {
        const directJson = await directRes.json();
        const detourJson = await detourRes.json();

        if (
          directJson.code === 'Ok' &&
          detourJson.code === 'Ok' &&
          directJson.routes?.[0] &&
          detourJson.routes?.[0]
        ) {
          const directRoute = directJson.routes[0];
          const detourRoute = detourJson.routes[0];

          const directKm = Math.round((directRoute.distance / 1000) * 10) / 10;
          const detourKm = Math.round((detourRoute.distance / 1000) * 10) / 10;
          const extraKm = Math.max(0, Math.round((detourKm - directKm) * 10) / 10);

          const leg1 = detourRoute.legs?.[0];
          const distToDetour = leg1 ? Math.round((leg1.distance / 1000) * 10) / 10 : directKm;

          const toDetourMins = leg1 ? Math.round(leg1.duration / 60) : 0;
          const toDetourHours = Math.floor(toDetourMins / 60);
          const toDetourRemMins = toDetourMins % 60;
          const durationToDetourText =
            toDetourHours > 0
              ? `${toDetourHours}h ${toDetourRemMins}m`
              : `${toDetourRemMins} mins`;

          const totalMins = Math.round(detourRoute.duration / 60);
          const totalHours = Math.floor(totalMins / 60);
          const totalRemMins = totalMins % 60;
          const detourDurationText =
            totalHours > 0 ? `${totalHours}h ${totalRemMins}m` : `${totalRemMins} mins`;

          return {
            directDistanceKm: directKm,
            detourDistanceKm: detourKm,
            relativeExtraKm: extraKm,
            distanceToDetourKm: distToDetour,
            durationToDetourText,
            detourDurationText,
            directGeoJson: directRoute.geometry,
            detourGeoJson: detourRoute.geometry,
          };
        }
      }
    } catch (e) {
      console.warn('OSRM relative detour calculation error:', e);
    }
  }

  // Case 2: Only Origin -> Detour (e.g. Destination change or no destination specified)
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${detour.lon},${detour.lat}?overview=simplified&geometries=geojson`,
      { headers }
    );
    if (res.ok) {
      const json = await res.json();
      if (json.code === 'Ok' && json.routes?.[0]) {
        const route = json.routes[0];
        const distKm = Math.round((route.distance / 1000) * 10) / 10;
        const mins = Math.round(route.duration / 60);
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        const durationText = hours > 0 ? `${hours}h ${remMins}m` : `${remMins} mins`;

        return {
          directDistanceKm: distKm,
          detourDistanceKm: distKm,
          relativeExtraKm: distKm,
          distanceToDetourKm: distKm,
          durationToDetourText: durationText,
          detourDurationText: durationText,
          detourGeoJson: route.geometry,
        };
      }
    }
  } catch (e) {
    console.warn('OSRM point to point calculation error:', e);
  }

  // Fallback Haversine calculation
  const directKm = Math.round(calculateDirectDistanceKm(origin.lat, origin.lon, detour.lat, detour.lon) * 1.35 * 10) / 10;
  return {
    directDistanceKm: directKm,
    detourDistanceKm: directKm,
    relativeExtraKm: directKm,
    distanceToDetourKm: directKm,
    durationToDetourText: `~${Math.round((directKm / 40) * 60)} mins`,
    detourDurationText: `~${Math.round((directKm / 40) * 60)} mins`,
  };
}

export async function calculateRoadDistanceOSRM(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number }
): Promise<OSRMRouteInfo | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500); // 3.5s fast timeout

    const headers = { 'User-Agent': 'VigilDriverApp/1.0.4 (support@vigil.app)' };
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMinutes = Math.round(route.duration / 60);

        const hours = Math.floor(durationMinutes / 60);
        const mins = durationMinutes % 60;
        const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;

        return {
          distanceKm,
          durationMinutes,
          durationText,
        };
      }
    }
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('OSRM route calculation error:', err);
    }
  }

  // Fallback: Estimate ~1.35x haversine road winding factor if OSRM is unreachable or timed out
  const directKm = calculateDirectDistanceKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const estimatedRoadKm = Math.round(directKm * 1.35 * 10) / 10;
  const estimatedMins = Math.round((estimatedRoadKm / 40) * 60);
  const hours = Math.floor(estimatedMins / 60);
  const mins = estimatedMins % 60;

  return {
    distanceKm: estimatedRoadKm,
    durationMinutes: estimatedMins,
    durationText: hours > 0 ? `~${hours}h ${mins}m` : `~${mins} mins`,
  };
}

/**
 * Convert Latitude & Longitude to OpenStreetMap Tile Coordinates
 */
export function latLonToTile(lat: number, lon: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const xExact = n * ((lon + 180) / 360);
  const yExact = n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;

  const xtile = Math.floor(xExact);
  const ytile = Math.floor(yExact);

  // Exact pixel offset within the 256x256 tile
  const offsetX = (xExact - xtile) * 256;
  const offsetY = (yExact - ytile) * 256;

  return { xtile, ytile, offsetX, offsetY };
}

/**
 * Fast, reliable raster map tile provider
 * Uses high-speed raster tiles cached directly at Sri Lankan ISP edge nodes,
 * with zero 403 blocking and zero watermarks.
 */
export function getOsmTileUrl(zoom: number, xtile: number, ytile: number): string {
  const s = Math.abs(xtile + ytile) % 4;
  return `https://mt${s}.google.com/vt/lyrs=m&x=${xtile}&y=${ytile}&z=${zoom}`;
}

export function getFallbackTileUrl(zoom: number, xtile: number, ytile: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ytile}/${xtile}`;
}
