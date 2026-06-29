import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { TelemetryEngine } from './telemetry';
import { audioCoach, getSettings } from './audioCoach';

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
    continuousHighSpeedStart = 0;
    lastTier = '';
  }
}

let fastContinuousStartTime = 0;
let hasPromptedForTrip = false;
let continuousHighSpeedStart = 0;
let lastTier = '';

export function processSingleLocation(loc: any) {
  const speedMs = loc.coords.speed || 0;
  const speedKmh = speedMs * 3.6;
  
  if (isTripActive) {
    const result = engine.processLocationUpdate(loc);
    
    if (result && result.penaltyApplied) {
      audioCoach.speakAccelerationAlert();
    }

    let currentTier = 'green';
    if (speedKmh > 120) currentTier = 'red';
    else if (speedKmh > 105) currentTier = 'orange';
    else if (speedKmh > 90) currentTier = 'yellow';

    if (speedKmh > 105) {
      if (continuousHighSpeedStart === 0) {
        continuousHighSpeedStart = loc.timestamp;
      } else if ((loc.timestamp - continuousHighSpeedStart) > 5000) {
        audioCoach.speakHighSpeedAlert();
      }
    } else {
      continuousHighSpeedStart = 0;
    }

    if (currentTier !== lastTier && lastTier !== '') {
      if (AppState.currentState === 'background') {
        getSettings().then(settings => {
          if (settings.headsUpBanners) {
            Notifications.scheduleNotificationAsync({
              content: {
                title: '💡 Eco-Coach',
                body: `Velocity tier changed to ${currentTier.toUpperCase()}. Drop your speed to save on this target journey!`,
              },
              trigger: null,
            }).catch(() => {});
          }
        });
      }
    }
    lastTier = currentTier;

  } else {
    // Not in active trip, monitor for auto-start
    if (speedMs > 5.55) {
      if (fastContinuousStartTime === 0) {
        fastContinuousStartTime = loc.timestamp;
      } else {
        const durationSec = (loc.timestamp - fastContinuousStartTime) / 1000;
        if (durationSec >= 30 && !hasPromptedForTrip) {
          try {
            Notifications.scheduleNotificationAsync({
              content: {
                title: "🚗 EcoDrive Detected a Drive!",
                body: "We noticed you're moving fast. Would you like to start tracking this trip to save fuel?",
                data: { type: 'START_TRIP_PROMPT' },
              },
              trigger: null,
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
      fastContinuousStartTime = 0;
    }
  }
}

// The callback for the background task
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    locations.forEach((loc: any) => processSingleLocation(loc));

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
        notificationTitle: 'EcoDrive Active',
        notificationBody: 'Calculating rolling trip efficiency...',
        notificationColor: '#4ade80',
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
