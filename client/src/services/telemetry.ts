import * as Location from 'expo-location';

export class TelemetryEngine {
  private readonly MASS_KG = 1400; // Baseline standard vehicle mass
  private readonly THERMAL_EFFICIENCY = 0.30; // 30% standard ICE efficiency
  private readonly GASOLINE_ENERGY_DENSITY_J_PER_L = 34.2e6; // 34.2 MJ/L

  private distanceCity = 0; // meters
  private distanceHighway = 0; // meters
  private totalPenaltyML = 0; // milliliters

  private lastLocation: Location.LocationObject | null = null;

  public processLocationUpdate(location: Location.LocationObject) {
    if (!this.lastLocation) {
      this.lastLocation = location;
      return;
    }

    const tInitial = this.lastLocation.timestamp;
    const tFinal = location.timestamp;
    const deltaTSeconds = (tFinal - tInitial) / 1000;

    if (deltaTSeconds <= 0) return; // Ignore duplicate timestamps

    // Speed from GPS (if available, otherwise calculate from distance over time)
    const vInitial = this.lastLocation.coords.speed || 0; // m/s
    const vFinal = location.coords.speed || 0; // m/s

    // Calculate acceleration: a = (v_final - v_initial) / deltaT
    const acceleration = (vFinal - vInitial) / deltaTSeconds;

    // Apply Kinetic Energy Acceleration Penalty for aggressive acceleration
    if (acceleration > 2.5) {
      const penaltyML = this.calculateAccelerationPenalty(vInitial, vFinal);
      this.totalPenaltyML += penaltyML;
    }

    // Dynamic Telemetry Segmentation
    // 60 km/h is approximately 16.67 m/s
    const averageSpeedMS = (vInitial + vFinal) / 2;
    const distanceDelta = averageSpeedMS * deltaTSeconds;

    if (averageSpeedMS < 16.67) {
      this.distanceCity += distanceDelta;
    } else {
      this.distanceHighway += distanceDelta;
    }

    this.lastLocation = location;
  }

  /**
   * Delta_E = 0.5 * m * (v_final^2 - v_initial^2)
   */
  private calculateAccelerationPenalty(vInitial: number, vFinal: number): number {
    if (vFinal <= vInitial) return 0;

    const deltaE = 0.5 * this.MASS_KG * (Math.pow(vFinal, 2) - Math.pow(vInitial, 2));

    // Energy needed from fuel considering thermal efficiency
    const energyFromFuel = deltaE / this.THERMAL_EFFICIENCY;

    // Convert Joules to Liters, then to milliliters
    const liters = energyFromFuel / this.GASOLINE_ENERGY_DENSITY_J_PER_L;
    return liters * 1000;
  }

  public getTelemetryReport() {
    return {
      distanceCityKm: this.distanceCity / 1000,
      distanceHighwayKm: this.distanceHighway / 1000,
      accelerationPenaltyMl: this.totalPenaltyML,
    };
  }

  public reset() {
    this.distanceCity = 0;
    this.distanceHighway = 0;
    this.totalPenaltyML = 0;
    this.lastLocation = null;
  }
}
