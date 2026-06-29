import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  engine, 
  setIsTripActive, 
  isTripActive,
  startBackgroundTracking, 
  stopBackgroundTracking 
} from '../services/location';
import { outbox } from '../services/outbox';
import { addTripToHistory } from '../services/analytics';

export default function DriveScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [speed, setSpeed] = useState(0);
  const [active, setActive] = useState(isTripActive);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [penalties, setPenalties] = useState(0);
  const [gaugeColor, setGaugeColor] = useState('#4ade80'); // Vivid green
  
  const lastPenaltyRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const metricsRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription;

    (async () => {
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          const currentSpeed = (loc.coords.speed || 0) * 3.6; // m/s to km/h
          setSpeed(currentSpeed);
        }
      );
    })();

    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  // Rolling metrics and penalty flashing effect
  useEffect(() => {
    if (active) {
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      metricsRef.current = setInterval(() => {
        const report = engine.getTelemetryReport();
        setDistance(report.distanceCityKm + report.distanceHighwayKm);
        
        // Detect penalty jump
        if (report.accelerationPenaltyMl > lastPenaltyRef.current) {
          setPenalties(p => p + 1);
          setGaugeColor('#ef4444'); // Flash Red
          setTimeout(() => setGaugeColor('#4ade80'), 1500);
          lastPenaltyRef.current = report.accelerationPenaltyMl;
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (metricsRef.current) clearInterval(metricsRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (metricsRef.current) clearInterval(metricsRef.current);
    };
  }, [active]);

  const handleStartTrip = async () => {
    await startBackgroundTracking();
    setIsTripActive(true);
    setActive(true);
    setDuration(0);
    setDistance(0);
    setPenalties(0);
    engine.reset();
    lastPenaltyRef.current = 0;
  };

  const handleEndTrip = async () => {
    setIsTripActive(false);
    setActive(false);
    await stopBackgroundTracking();

    const report = engine.getTelemetryReport();
    if (report.distanceCityKm === 0 && report.distanceHighwayKm === 0) {
      Alert.alert('Trip Ended', 'No distance recorded.');
      engine.reset();
      return;
    }

    try {
      const profileData = await AsyncStorage.getItem('user_profile');
      let vehicleId = 'local-uuid';
      if (profileData) {
        const profile = JSON.parse(profileData);
        vehicleId = profile.id;
      }

      const tripData = {
        distanceCityKm: report.distanceCityKm,
        distanceHighwayKm: report.distanceHighwayKm,
        accelerationPenaltyMl: report.accelerationPenaltyMl,
      };

      await outbox.enqueue('TRIP_SYNC', { vehicleId, ...tripData });
      await addTripToHistory(tripData);

      engine.reset();
      navigation.navigate('DashboardTab');
    } catch (e) {
      console.error('Failed to save trip:', e);
      Alert.alert('Error', 'Failed to save trip data.');
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Telemetry</Text>
      </View>

      <View style={[styles.gaugeContainer, { borderColor: gaugeColor }]}>
        <Text style={styles.speedText}>{speed.toFixed(0)}</Text>
        <Text style={styles.label}>km/h</Text>
      </View>

      <View style={styles.metricsPanel}>
        <View style={styles.metricBox}>
          <Text style={styles.metricVal}>{distance.toFixed(2)}</Text>
          <Text style={styles.metricLabel}>Distance (km)</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricVal}>{formatTime(duration)}</Text>
          <Text style={styles.metricLabel}>Duration</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricVal, penalties > 0 ? { color: '#ef4444' } : {}]}>{penalties}</Text>
          <Text style={styles.metricLabel}>Penalties</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.actionBtn, active ? styles.btnStop : styles.btnStart]} 
        onPress={active ? handleEndTrip : handleStartTrip}
      >
        <Text style={styles.btnText}>{active ? 'End Trip' : 'Start Trip'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  header: {
    width: '100%',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  gaugeContainer: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  speedText: {
    fontSize: 90,
    fontWeight: '800',
    color: '#fff',
  },
  label: {
    fontSize: 24,
    color: '#9ca3af',
    fontWeight: '600',
    marginTop: -10,
  },
  metricsPanel: {
    flexDirection: 'row',
    width: '90%',
    justifyContent: 'space-between',
    backgroundColor: '#1e1e1e',
    padding: 20,
    borderRadius: 16,
  },
  metricBox: {
    alignItems: 'center',
    flex: 1,
  },
  metricVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  metricLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  actionBtn: {
    width: '85%',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  btnStart: {
    backgroundColor: '#4ade80',
  },
  btnStop: {
    backgroundColor: '#ef4444',
  },
  btnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#121212',
  },
});
