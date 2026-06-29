import * as Location from 'expo-location';

export class TelemetryEngine {
  private MASS_KG = 1400; // Baseline standard vehicle mass
  private THERMAL_EFFICIENCY = 0.30; // 30% standard ICE efficiency
  private readonly GASOLINE_ENERGY_DENSITY_J_PER_L = 34.2e6; // 34.2 MJ/L

  private distanceCity = 0; // meters
  private distanceHighway = 0; // meters
  private totalPenaltyML = 0; // milliliters
  private speedProfile: { time: number; speed: number }[] = [];

  public setPhysics(massKg: number, efficiency: number) {
    this.MASS_KG = massKg;
    this.THERMAL_EFFICIENCY = efficiency;
  }

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

    // Log velocity profile for graphing
    this.speedProfile.push({
      time: tFinal,
      speed: vFinal * 3.6
    });

    // Calculate acceleration: a = (v_final - v_initial) / deltaT
    const acceleration = (vFinal - vInitial) / deltaTSeconds;

    let penaltyApplied = false;
    // Apply Kinetic Energy Acceleration Penalty for aggressive acceleration
    if (acceleration > 2.5) {
      const penaltyML = this.calculateAccelerationPenalty(vInitial, vFinal);
      this.totalPenaltyML += penaltyML;
      penaltyApplied = true;
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
    
    return { penaltyApplied };
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

  public getAerodynamicPrediction(currentSpeedKmh: number) {
    if (currentSpeedKmh <= 90) return null;
    
    const baselineLitersPer100km = 6.0; 
    const currentLitersPer100km = baselineLitersPer100km * Math.pow(currentSpeedKmh / 90, 2);
    
    const savedLitersPer100km = currentLitersPer100km - baselineLitersPer100km;
    
    const distanceInOneHour = currentSpeedKmh; 
    const fuelUsedAtCurrentSpeed = currentLitersPer100km * (distanceInOneHour / 100);
    const fuelUsedAt90ForSameDistance = baselineLitersPer100km * (distanceInOneHour / 100);
    
    const fuelSavedInOneHour = fuelUsedAtCurrentSpeed - fuelUsedAt90ForSameDistance;
    const gasPrice = 1.50; // $1.50 per liter
    const moneySavedPerHour = fuelSavedInOneHour * gasPrice;
    
    return {
      savedLitersPer100km: savedLitersPer100km.toFixed(1),
      moneySavedPerHour: moneySavedPerHour.toFixed(2),
    };
  }

  public calculateTripTradeoff(distanceKm: number, baselineSpeed: number = 115, optimizedSpeed: number = 95) {
    if (distanceKm <= 0) return null;

    const timeBaselineHours = distanceKm / baselineSpeed;
    const timeOptimizedHours = distanceKm / optimizedSpeed;
    const timeAddedMins = (timeOptimizedHours - timeBaselineHours) * 60;

    const baseLitersPer100 = 6.0;
    const l100Baseline = baseLitersPer100 * Math.pow(baselineSpeed / 90, 2);
    const l100Optimized = baseLitersPer100 * Math.pow(optimizedSpeed / 90, 2);

    const litersBaseline = l100Baseline * (distanceKm / 100);
    const litersOptimized = l100Optimized * (distanceKm / 100);

    const savedLiters = litersBaseline - litersOptimized;
    const savedMoney = savedLiters * 1.50;

    return {
      timeAddedMins: timeAddedMins.toFixed(1),
      savedLiters: savedLiters.toFixed(2),
      savedMoney: savedMoney.toFixed(2)
    };
  }

  public static getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = TelemetryEngine.deg2rad(lat2 - lat1);
    const dLon = TelemetryEngine.deg2rad(lon2 - lon1); 
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(TelemetryEngine.deg2rad(lat1)) * Math.cos(TelemetryEngine.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  }

  private static deg2rad(deg: number) {
    return deg * (Math.PI/180);
  }

  public getTelemetryReport() {
    return {
      distanceCityKm: this.distanceCity / 1000,
      distanceHighwayKm: this.distanceHighway / 1000,
      accelerationPenaltyMl: this.totalPenaltyML,
      speedProfile: [...this.speedProfile],
    };
  }

  public reset() {
    this.distanceCity = 0;
    this.distanceHighway = 0;
    this.totalPenaltyML = 0;
    this.lastLocation = null;
    this.speedProfile = [];
  }
}
