import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { TelemetryEngine } from './telemetry';

import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

const LOCATION_TASK_NAME = 'background-location-task';
export const engine = new TelemetryEngine();

export function setVehiclePhysics(massKg: number, efficiency: number) {
  engine.setPhysics(massKg, efficiency);
}

export let isTripActive = false;
export function setIsTripActive(active: boolean) {
  isTripActive = active;
  if (!active) {
    hasPromptedForTrip = false; // Reset when trip ends
  }
}

let fastContinuousStartTime = 0;
let hasPromptedForTrip = false;

// The callback for the background task
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    
    locations.forEach((loc: any) => {
      const speedMs = loc.coords.speed || 0;
      
      if (isTripActive) {
        engine.processLocationUpdate(loc);
      } else {
        // Not in active trip, monitor for auto-start
        // 20 km/h is ~5.55 m/s
        if (speedMs > 5.55) {
          if (fastContinuousStartTime === 0) {
            fastContinuousStartTime = loc.timestamp;
          } else {
            const durationSec = (loc.timestamp - fastContinuousStartTime) / 1000;
            if (durationSec >= 30 && !hasPromptedForTrip) {
              // Trigger notification safely
              try {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: "🚗 EcoDrive Detected a Drive!",
                    body: "We noticed you're moving fast. Would you like to start tracking this trip to save fuel?",
                    data: { type: 'START_TRIP_PROMPT' },
                  },
                  trigger: null, // trigger immediately
                }).catch(() => {
                   Alert.alert(
                    "🚗 EcoDrive Detected a Drive!",
                    "We noticed you're moving fast. Would you like to start tracking this trip to save fuel?"
                  );
                });
              } catch (e) {
                console.log('Expo Go notification blocked, using Alert fallback');
                Alert.alert(
                  "🚗 EcoDrive Detected a Drive!",
                  "We noticed you're moving fast. Would you like to start tracking this trip to save fuel?"
                );
              }
              hasPromptedForTrip = true;
            }
          }
        } else {
          // Reset if speed drops below threshold
          fastContinuousStartTime = 0;
        }
      }
    });

    if (isTripActive) {
      console.log('Current Telemetry:', engine.getTelemetryReport());
    }
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
