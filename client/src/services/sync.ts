import { api } from './api';
import { TelemetryEngine } from './telemetry';

export class SyncManager {
  private engine: TelemetryEngine;
  private vehicleId: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(engine: TelemetryEngine, vehicleId: string) {
    this.engine = engine;
    this.vehicleId = vehicleId;
  }

  public startSync(intervalMs = 30000) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      await this.syncTelemetry();
    }, intervalMs);
  }

  public stopSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async syncTelemetry() {
    const report = this.engine.getTelemetryReport();

    // If no distance covered, skip sync
    if (report.distanceCityKm === 0 && report.distanceHighwayKm === 0) {
      return;
    }

    try {
      await api.post('/api/trips/sync', {
        vehicleId: this.vehicleId,
        distanceCityKm: report.distanceCityKm,
        distanceHighwayKm: report.distanceHighwayKm,
        accelerationPenaltyMl: report.accelerationPenaltyMl,
      });

      console.log('Successfully synced telemetry:', report);
      
      // Reset after successful sync
      this.engine.reset();
    } catch (error) {
      console.error('Failed to sync telemetry, data will be kept for next cycle:', error);
    }
  }
}
