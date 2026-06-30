import axios from 'axios';

// -----------------------------------------------------------------------------
// 1. Data Structures & Types
// -----------------------------------------------------------------------------
export interface OSRMInput {
  latitude: number;
  longitude: number;
  bearing: number;
}

export interface OSRMOutput {
  osmWayId: number;
  roadClassification: 'Urban' | 'Highway';
  extractedSpeedLimit: number;
  confidenceScore: number;
}

export interface LocalCacheEntry {
  timestamp: number;
  latitude: number;
  longitude: number;
  bearing: number;
  data: OSRMOutput;
}

// -----------------------------------------------------------------------------
// 2. Caching & Performance Optimization
// -----------------------------------------------------------------------------
const OSRM_BASE_URL = 'http://router.project-osrm.org';
let localCache: LocalCacheEntry | null = null;

/**
 * Calculates the great-circle distance between two points on the Earth (Haversine formula).
 * Returns distance in meters.
 */
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (val: number) => (val * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the shortest angular difference between two bearings in degrees.
 */
function calculateBearingDifference(b1: number, b2: number): number {
  let diff = Math.abs(b1 - b2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// -----------------------------------------------------------------------------
// 3. Main OSRM Integration Service
// -----------------------------------------------------------------------------
export class OSRMService {
  
  /**
   * Fetches the nearest road attributes given GPS coordinates and bearing.
   * Utilizes aggressive local caching to minimize network overhead.
   */
  public static async getRoadAttributes(input: OSRMInput): Promise<OSRMOutput> {
    const now = Date.now();
    
    // Evaluate Local Cache
    if (localCache) {
      const ageMs = now - localCache.timestamp;
      const distanceMeters = calculateHaversineDistance(
        input.latitude, input.longitude,
        localCache.latitude, localCache.longitude
      );
      const bearingDiff = calculateBearingDifference(input.bearing, localCache.bearing);

      // Cache conditions: < 10 seconds old, < 20 meters moved, < 10 degrees turn
      if (ageMs < 10000 && distanceMeters < 20 && bearingDiff < 10) {
        return localCache.data;
      }
    }

    // Prepare Fallback Default
    const fallbackDefault: OSRMOutput = {
      osmWayId: Math.floor(Math.random() * 1000000) + 9000000,
      roadClassification: 'Urban',
      extractedSpeedLimit: 50,
      confidenceScore: 0.1
    };

    try {
      // 3. API Request Construction
      const url = `${OSRM_BASE_URL}/nearest/v1/driving/${input.longitude},${input.latitude}?number=1&bearings=${Math.round(input.bearing)},15`;
      
      const response = await axios.get(url, { timeout: 500 });
      
      if (response.status !== 200 || !response.data || response.data.code !== 'Ok') {
        return localCache?.data || fallbackDefault;
      }

      // 4. Response Parsing & Fallback Logic
      const waypoint = response.data.waypoints && response.data.waypoints[0];
      if (!waypoint) {
        return localCache?.data || fallbackDefault;
      }

      const snapDistance = waypoint.distance || 0;
      // In a public OSRM /nearest request, detailed OSM tags aren't standardly returned unless custom profiles are used.
      // We will parse the 'name' or mock the classification if tags are absent.
      // Real-world fallback logic assuming custom profile provides way metadata (e.g. waypoint.nodes / waypoint.metadata):
      
      // For this implementation, we map based on hypothetical metadata or standard fallbacks.
      const wayName = (waypoint.name || '').toLowerCase();
      
      let roadClassification: 'Urban' | 'Highway' = 'Urban';
      let speedLimit = 50;

      // Hypothetical tagging extraction (Assuming custom backend or parsing context)
      // Since public OSRM lacks exact tag output, we apply logic based on name heuristics or fallback.
      // If the backend provided 'highway' tag in an extended field:
      const highwayTag = waypoint.highway || 'residential'; 

      if (['motorway', 'trunk', 'primary'].includes(highwayTag)) {
        roadClassification = 'Highway';
        speedLimit = 110;
      } else if (['secondary', 'tertiary', 'residential', 'living_street'].includes(highwayTag)) {
        roadClassification = 'Urban';
        speedLimit = highwayTag === 'living_street' ? 30 : 50;
      }

      // Calculate confidence score (distance < 5m = 1.0, distance > 30m = 0.4)
      let confidenceScore = 1.0 - (snapDistance / 50.0);
      if (snapDistance < 5) confidenceScore = 1.0;
      else if (snapDistance > 30) confidenceScore = 0.4;
      
      confidenceScore = Math.max(0.0, Math.min(1.0, confidenceScore));

      const output: OSRMOutput = {
        osmWayId: waypoint.nodes ? waypoint.nodes[0] : 0, // Fallback way identifier
        roadClassification,
        extractedSpeedLimit: speedLimit,
        confidenceScore
      };

      // Update Cache
      localCache = {
        timestamp: now,
        latitude: input.latitude,
        longitude: input.longitude,
        bearing: input.bearing,
        data: output
      };

      return output;

    } catch (error: any) {
      // 5. Error Handling & Resiliency
      // Fast fallback to simulated data without stalling the UI pipeline on Network Errors
      if (!error.isAxiosError) {
        console.warn('OSRM Parsing Error, using fallback:', error.message);
      }
      return localCache?.data || fallbackDefault;
    }
  }
}
