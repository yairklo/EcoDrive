import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { TelemetryEngine } from './telemetry';

const LOCATION_TASK_NAME = 'background-location-task';
const engine = new TelemetryEngine();

// The callback for the background task
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    locations.forEach((loc: any) => engine.processLocationUpdate(loc));
    console.log('Current Telemetry:', engine.getTelemetryReport());
  }
});

export async function requestLocationPermissions() {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus === 'granted') {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    return backgroundStatus === 'granted';
  }
  return false;
}

export async function startBackgroundTracking() {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) {
    console.warn('Location permissions not granted');
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10, // Update every 10 meters
      deferredUpdatesInterval: 5000, // Batch updates every 5 seconds
      foregroundService: {
        notificationTitle: 'EcoDrive Tracking',
        notificationBody: 'Recording trip to calculate fuel efficiency.',
        notificationColor: '#4caf50',
      },
    });
  }
}

export async function stopBackgroundTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
