import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TelemetryTick {
  speed_kmh: number;
  acceleration_mss: number;
  road_type: 'Urban' | 'Highway';
}

export interface FuelWeightMetrics {
  total_estimated_liters: number;
  aggressive_burn_ratio: number;
  efficiency_score: number;
}

export interface RoadWeightProfile {
  total_consumption_ml: number;
  acceleration_waste_ml: number;
  moving_consumption_ml: number; // Anti-idle filter basis
  ticks_recorded: number;
  is_high_risk: boolean;
  lastVisited: number; // LRU tracking
}

const STORAGE_KEY = '@ecodrive_road_weights';
const MAX_CACHE_SIZE = 500;
const FLUSH_INTERVAL_TICKS = 30;

class FuelEngineService {
  private readonly VEHICLE_MASS = 1400; // kg
  private readonly IDLE_DRAG_BASE = 0.005; 
  private readonly AERO_COEFF = 0.35; 
  private readonly ENERGY_DENSITY = 34.2e6; 
  private readonly THERMAL_EFFICIENCY = 0.3; 

  private roadWeights: Record<string, RoadWeightProfile> = {};
  
  private isDirty = false;
  private tickCounter = 0;

  constructor() {
    this.loadFromDisk();
  }

  private async loadFromDisk() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        this.roadWeights = JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load fuel road weights from disk', e);
    }
  }

  /**
   * Asynchronously saves the local cache to disk if it contains unsaved updates.
   */
  public async flush() {
    if (!this.isDirty) return;
    try {
      const toSave = JSON.stringify(this.roadWeights);
      await AsyncStorage.setItem(STORAGE_KEY, toSave);
      this.isDirty = false;
    } catch (e) {
      console.warn('Failed to flush fuel road weights to disk', e);
    }
  }

  /**
   * Ensures the dictionary does not bloat and cause OOM crashes.
   * Evicts the Least Recently Used (LRU) entry if the max size is breached.
   */
  private evictLRU() {
    const keys = Object.keys(this.roadWeights);
    if (keys.length <= MAX_CACHE_SIZE) return;

    let oldestKey = keys[0];
    let oldestTime = this.roadWeights[oldestKey].lastVisited;

    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      const time = this.roadWeights[k].lastVisited;
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = k;
      }
    }

    delete this.roadWeights[oldestKey];
    this.isDirty = true;
  }

  private getCardinalDirection(bearing: number): string {
    const b = bearing % 360;
    if (b >= 315 || b < 45) return 'North';
    if (b >= 45 && b < 135) return 'East';
    if (b >= 135 && b < 225) return 'South';
    return 'West';
  }

  public calculateTickConsumption(data: TelemetryTick): { total_ml: number, is_accel_waste: boolean } {
    const v_ms = data.speed_kmh / 3.6;
    
    // CPU/Battery Math Approximation: Avoid Math.pow and temporary objects in 1Hz loop
    const f_drag = this.AERO_COEFF * v_ms * v_ms;
    let p_drag = f_drag * v_ms; 
    
    let p_inertial = 0;
    let is_accel_waste = false;
    const accel = data.acceleration_mss;

    if (accel > 0) {
      p_inertial = this.VEHICLE_MASS * accel * v_ms;
      if (accel > 1.5) {
        is_accel_waste = true;
      }
    }

    let baseFrictionPower = this.IDLE_DRAG_BASE * this.VEHICLE_MASS * 9.81 * v_ms;
    if (data.road_type === 'Urban') {
      baseFrictionPower *= 1.3;
    }

    const total_power_watts = p_drag + p_inertial + baseFrictionPower;
    
    if (total_power_watts <= 0) {
      return { total_ml: 0, is_accel_waste: false };
    }

    const energy_joules = total_power_watts;
    const liters = energy_joules / (this.ENERGY_DENSITY * this.THERMAL_EFFICIENCY);
    
    return { total_ml: liters * 1000, is_accel_waste };
  }

  public updateRoadWeights(osmWayId: number, bearing: number, consumption_ml: number, is_accel_waste: boolean, speed_kmh: number) {
    if (!osmWayId) return;

    const direction = this.getCardinalDirection(bearing);
    const key = `${osmWayId}-${direction}`;

    if (!this.roadWeights[key]) {
      this.roadWeights[key] = {
        total_consumption_ml: 0,
        acceleration_waste_ml: 0,
        moving_consumption_ml: 0,
        ticks_recorded: 0,
        is_high_risk: false,
        lastVisited: Date.now()
      };
      this.evictLRU(); 
    }

    const profile = this.roadWeights[key];
    profile.total_consumption_ml += consumption_ml;
    profile.ticks_recorded += 1;
    profile.lastVisited = Date.now();
    this.isDirty = true;
    
    if (is_accel_waste) {
      profile.acceleration_waste_ml += consumption_ml;
    }
    
    // Data Demodulation: Anti-Idle Filter
    // Only aggregate fuel burn towards the risk ratio if the vehicle is actively moving (>= 5 km/h)
    if (speed_kmh >= 5) {
      profile.moving_consumption_ml += consumption_ml;
    }

    if (profile.moving_consumption_ml > 50 && (profile.acceleration_waste_ml / profile.moving_consumption_ml) > 0.4) {
      profile.is_high_risk = true;
    } else {
      profile.is_high_risk = false;
    }

    // I/O Optimization: Flush-on-Interval (Batching Layer)
    this.tickCounter++;
    if (this.tickCounter >= FLUSH_INTERVAL_TICKS) {
      this.tickCounter = 0;
      // Fire and forget (do not block telemetry thread)
      this.flush().catch(console.warn);
    }
  }

  public getRoadWeights() {
    return this.roadWeights;
  }
}

export const fuelEngine = new FuelEngineService();
