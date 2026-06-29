import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, Alert, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import { TelemetryEngine } from './telemetry';
import { audioCoach, getSettings } from './audioCoach';
import { OSRMService } from './osrm';
import { fuelEngine } from './fuelEngine';

const LOCATION_TASK_NAME = 'background-location-task';
export const engine = new TelemetryEngine();

export function setVehiclePhysics(massKg: number, efficiency: number) {
  engine.setPhysics(massKg, efficiency);
}

export let isTripActive = false;
let silentUrbanProfile = false;
const rollingBuffer: { timestamp: number; speed: number; acceleration: number }[] = [];

export function setIsTripActive(active: boolean) {
  isTripActive = active;
  if (!active) {
    hasPromptedForTrip = false; 
    continuousHighSpeedStart = 0;
    lastTier = '';
    silentUrbanProfile = false;
    rollingBuffer.length = 0;
    fuelEngine.flush().catch(console.warn);
  }
}

let fastContinuousStartTime = 0;
let hasPromptedForTrip = false;
let continuousHighSpeedStart = 0;
let lastTier = '';

export async function processSingleLocation(loc: any) {
  const speedMs = loc.coords.speed || 0;
  const speedKmh = speedMs * 3.6;
  const now = loc.timestamp;
  
  if (isTripActive) {
    // 1. Fetch OSRM Road Metadata
    const bearing = loc.coords.heading || 0;
    const roadData = await OSRMService.getRoadAttributes({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      bearing
    });

    silentUrbanProfile = roadData.roadClassification === 'Urban';

    // 2. Process Telemetry
    const result = engine.processLocationUpdate(loc);
    
    if (result) {
      rollingBuffer.push({
        timestamp: now,
        speed: speedKmh,
        acceleration: result.currentAcceleration
      });
      
      // Calculate Fuel Engine Tick
      const tickData = fuelEngine.calculateTickConsumption({
        speed_kmh: speedKmh,
        acceleration_mss: result.currentAcceleration,
        road_type: roadData.roadClassification
      });

      // Update Local Physics Weights
      fuelEngine.updateRoadWeights(
        roadData.osmWayId, 
        bearing, 
        tickData.total_ml, 
        tickData.is_accel_waste,
        speedKmh
      );
    }

    // Evict old data (> 10s old)
    while (rollingBuffer.length > 0 && now - rollingBuffer[0].timestamp > 10000) {
      rollingBuffer.shift();
    }

    // 3. Urban Behavioral Check
    if (silentUrbanProfile && speedKmh >= 50 && speedKmh <= 60) {
      // Check if driver has been continuously accelerating (>2.5 m/s2) for at least 4 seconds
      const cutoff = now - 4000;
      let prolongedAcceleration = true;
      let hasDataFor4Seconds = false;
      
      for (let i = rollingBuffer.length - 1; i >= 0; i--) {
        const p = rollingBuffer[i];
        if (p.timestamp >= cutoff) {
          hasDataFor4Seconds = true;
          if (p.acceleration <= 2.5) {
            prolongedAcceleration = false;
            break;
          }
        } else {
          break; // past the 4-second window
        }
      }

      if (hasDataFor4Seconds && prolongedAcceleration) {
        audioCoach.speakUrbanAccelerationAlert();
        DeviceEventEmitter.emit('URBAN_ALERT_TRIGGERED', { timestamp: now, severity: 'high' });
      }
    }

    // Mute standard acceleration alerts if in silent urban profile
    if (result && result.penaltyApplied) {
      audioCoach.speakAccelerationAlert(silentUrbanProfile);
    }

    let currentTier = 'green';
    if (speedKmh > 120) currentTier = 'red';
    else if (speedKmh > 105) currentTier = 'orange';
    else if (speedKmh > 90) currentTier = 'yellow';

    if (speedKmh > 105) {
      if (continuousHighSpeedStart === 0) {
        continuousHighSpeedStart = now;
      } else if ((now - continuousHighSpeedStart) > 5000) {
        if (!silentUrbanProfile) {
          audioCoach.speakHighSpeedAlert();
        }
      }
    } else {
      continuousHighSpeedStart = 0;
    }

    if (currentTier !== lastTier && lastTier !== '') {
      if (AppState.currentState === 'background' && !silentUrbanProfile) {
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
        fastContinuousStartTime = now;
      } else {
        const durationSec = (now - fastContinuousStartTime) / 1000;
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
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    
    // Process locations sequentially to ensure OSRM caches correctly
    for (const loc of locations) {
      await processSingleLocation(loc);
    }

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
      distanceInterval: 10,
      deferredUpdatesInterval: 5000,
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
