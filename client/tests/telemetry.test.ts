import { TelemetryEngine } from '../src/services/telemetry';
import * as Location from 'expo-location';

describe('TelemetryEngine Physics Logic', () => {
  let engine: TelemetryEngine;

  beforeEach(() => {
    engine = new TelemetryEngine();
  });

  it('should segment distance into city when average speed < 60 km/h', () => {
    // 10 m/s = 36 km/h
    const loc1: any = { timestamp: 1000, coords: { speed: 10 } };
    const loc2: any = { timestamp: 2000, coords: { speed: 10 } }; // 1 sec later
    
    engine.processLocationUpdate(loc1);
    engine.processLocationUpdate(loc2);
    
    const report = engine.getTelemetryReport();
    // 10 m/s * 1 sec = 10 meters = 0.01 km
    expect(report.distanceCityKm).toBeCloseTo(0.01, 3);
    expect(report.distanceHighwayKm).toBe(0);
  });

  it('should apply kinetic energy penalty on high acceleration', () => {
    // a = (20 - 10) / 1 = 10 m/s^2, which is > 2.5 m/s^2
    const loc1: any = { timestamp: 1000, coords: { speed: 10 } };
    const loc2: any = { timestamp: 2000, coords: { speed: 20 } }; // 1 sec later
    
    engine.processLocationUpdate(loc1);
    engine.processLocationUpdate(loc2);
    
    const report = engine.getTelemetryReport();
    expect(report.accelerationPenaltyMl).toBeGreaterThan(0);
  });
});
