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
  ticks_recorded: number;
  is_high_risk: boolean;
}

class FuelEngineService {
  private readonly VEHICLE_MASS = 1400; // kg
  private readonly IDLE_DRAG_BASE = 0.005; // Base rolling resistance/idle fuel coefficient
  private readonly AERO_COEFF = 0.35; // Aerodynamic drag coeff proxy
  private readonly ENERGY_DENSITY = 34.2e6; // Joules per Liter of Gasoline
  private readonly THERMAL_EFFICIENCY = 0.3; // 30% thermal efficiency of typical ICE

  // Dictionary tracking regional road weights
  private roadWeights: Record<string, RoadWeightProfile> = {};

  /**
   * Converts a 0-360 degree bearing into a cardinal direction suffix.
   */
  private getCardinalDirection(bearing: number): string {
    const b = bearing % 360;
    if (b >= 315 || b < 45) return 'North';
    if (b >= 45 && b < 135) return 'East';
    if (b >= 135 && b < 225) return 'South';
    return 'West';
  }

  /**
   * Calculates the exact fuel consumption (in milliliters) for a single 1-second telemetry tick.
   */
  public calculateTickConsumption(data: TelemetryTick): { total_ml: number, is_accel_waste: boolean } {
    const v_ms = data.speed_kmh / 3.6;
    
    // 1. Aerodynamic Drag Force: F_drag = C * v^2
    const f_drag = this.AERO_COEFF * v_ms * v_ms;
    let p_drag = f_drag * v_ms; // Power = Force * velocity
    
    // 2. Inertial Force (Acceleration): F_inertial = m * a
    let p_inertial = 0;
    let is_accel_waste = false;

    if (data.acceleration_mss > 0) {
      p_inertial = this.VEHICLE_MASS * data.acceleration_mss * v_ms;
      // Mark as aggressive acceleration waste if > 1.5 m/s^2
      if (data.acceleration_mss > 1.5) {
        is_accel_waste = true;
      }
    }

    // 3. Contextual Road Modifier
    // Baseline rolling friction & idle power: F_friction = mu * m * g
    let baseFrictionPower = this.IDLE_DRAG_BASE * this.VEHICLE_MASS * 9.81 * v_ms;
    
    if (data.road_type === 'Urban') {
      // Urban congestion and stop-and-go increases the baseline drag weight by 1.3x
      baseFrictionPower *= 1.3;
    }

    // Total mechanical power required (Watts = Joules / second)
    const total_power_watts = p_drag + p_inertial + baseFrictionPower;
    
    if (total_power_watts <= 0) {
      return { total_ml: 0, is_accel_waste: false };
    }

    // Since this is evaluated per 1-second tick, Energy (Joules) = Power (Watts) * 1s
    const energy_joules = total_power_watts;
    
    // Liters = Energy / (Density * Efficiency)
    const liters = energy_joules / (this.ENERGY_DENSITY * this.THERMAL_EFFICIENCY);
    const total_ml = liters * 1000;

    return { total_ml, is_accel_waste };
  }

  /**
   * Updates the localized Road Weights dictionary to build a map of efficient/inefficient zones.
   */
  public updateRoadWeights(osmWayId: number, bearing: number, consumption_ml: number, is_accel_waste: boolean) {
    if (!osmWayId) return;

    // Use osmWayId combined with Cardinal Direction as a primary key to separate directional profiles
    const direction = this.getCardinalDirection(bearing);
    const key = `${osmWayId}-${direction}`;

    if (!this.roadWeights[key]) {
      this.roadWeights[key] = {
        total_consumption_ml: 0,
        acceleration_waste_ml: 0,
        ticks_recorded: 0,
        is_high_risk: false
      };
    }

    const profile = this.roadWeights[key];
    profile.total_consumption_ml += consumption_ml;
    profile.ticks_recorded += 1;
    
    if (is_accel_waste) {
      profile.acceleration_waste_ml += consumption_ml;
    }

    // Identify "High-Velocity Acceleration Risk Zones"
    // Rule: If > 50ml burned here historically AND >40% of the fuel burned is strictly due to aggressive acceleration
    if (profile.total_consumption_ml > 50 && (profile.acceleration_waste_ml / profile.total_consumption_ml) > 0.4) {
      profile.is_high_risk = true;
    }
  }

  /**
   * Retrieve the aggregated weights dictionary (useful for UI or telemetry syncing)
   */
  public getRoadWeights() {
    return this.roadWeights;
  }
}

export const fuelEngine = new FuelEngineService();
