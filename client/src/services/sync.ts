import { TelemetryEngine } from './telemetry';
import { outbox } from './outbox';

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
      await outbox.enqueue('TRIP_SYNC', {
        vehicleId: this.vehicleId,
        distanceCityKm: report.distanceCityKm,
        distanceHighwayKm: report.distanceHighwayKm,
        accelerationPenaltyMl: report.accelerationPenaltyMl,
      });

      console.log('Telemetry sent to outbox queue:', report);
      
      // Reset after successful queue
      this.engine.reset();
    } catch (error) {
      console.error('Failed to queue telemetry:', error);
    }
  }
}
