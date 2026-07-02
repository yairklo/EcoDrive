import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Switch, TextInput, Keyboard, ActivityIndicator, DeviceEventEmitter, AppState, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { 
  engine, 
  setIsTripActive, 
  isTripActive,
  startBackgroundTracking, 
  stopBackgroundTracking,
  processSingleLocation,
  setSimActiveFlag
} from '../services/location';
import { outbox } from '../services/outbox';
import { addTripToHistory } from '../services/analytics';
import { TelemetryEngine } from '../services/telemetry';
import { overlayManager } from '../services/overlayManager';

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

export default function DriveScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [speed, setSpeed] = useState(0);
  const [active, setActive] = useState(isTripActive);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [gaugeColor, setGaugeColor] = useState('#4ade80'); 
  const [simActive, setSimActive] = useState(false);
  const [insights, setInsights] = useState<{ savedLitersPer100km: string, moneySavedPerHour: string } | null>(null);
  
  // Maps & Routing State
  const [currentCoords, setCurrentCoords] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [targetCoords, setTargetCoords] = useState<any>(null);
  const [totalEstimatedDist, setTotalEstimatedDist] = useState<number>(0);
  const [remainingDist, setRemainingDist] = useState<number>(0);
  const [predictionMatrix, setPredictionMatrix] = useState<any>(null);
  
  // Urban Behavioral Alert
  const [urbanAlert, setUrbanAlert] = useState<{ active: boolean, timestamp: number } | null>(null);

  const mapRef = useRef<MapView>(null);
  const lastPenaltyRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const metricsRef = useRef<NodeJS.Timeout | null>(null);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);
  const simTickRef = useRef(0);
  const tripStartTimeRef = useRef<number | null>(null);

  // Absolute Timestamp Delta Sync on Foreground
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && active && tripStartTimeRef.current) {
        const realElapsedTimeSeconds = Math.floor((Date.now() - tripStartTimeRef.current) / 1000);
        setDuration(realElapsedTimeSeconds);
      }
    });
    return () => {
      appStateSub.remove();
    };
  }, [active]);

  // Initialize Map Location & Event Listeners
  useEffect(() => {
    // 1. Overlay Init - Fire immediately, completely decoupled from network or location
    (async () => {
      try {
        overlayManager.init();
        const hasOverlayPerm = await overlayManager.checkPermissions();
        if (!hasOverlayPerm && Platform.OS === 'android') {
          await overlayManager.requestPermissions();
        }
      } catch (e) {
        console.warn('Overlay Init Non-Blocking Error', e);
      }
    })();

    // 2. Location Fetch - Allowed to hang/fail without blocking UI
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({});
          setCurrentCoords(location.coords);
        }
      } catch (e) {
        console.warn('Location Fetch Non-Blocking Error', e);
      }
    })();

    const urbanAlertSub = DeviceEventEmitter.addListener('URBAN_ALERT_TRIGGERED', (data) => {
      setUrbanAlert({ active: true, timestamp: data.timestamp });
      setTimeout(() => {
        setUrbanAlert(prev => {
          if (prev && prev.timestamp === data.timestamp) {
            return null;
          }
          return prev;
        });
      }, 4000);
    });

    return () => {
      urbanAlertSub.remove();
    };
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription;
    (async () => {
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          setCurrentCoords(loc.coords);
          if (!simActive) {
            const currentSpeed = (loc.coords.speed || 0) * 3.6; 
            setSpeed(currentSpeed);
          }
        }
      );
    })();
    return () => {
      if (subscription) subscription.remove();
    };
  }, [simActive]);

  useEffect(() => {
    if (active) {
      // 3. Support Multi-Trip Overlay Lifecycle
      overlayManager.updateOverlayData({ state: 'A', colorHex: '#4ade80', isSim: simActive });
      
      metricsRef.current = setInterval(() => {
        if (tripStartTimeRef.current) {
          const realElapsedTimeSeconds = Math.floor((Date.now() - tripStartTimeRef.current) / 1000);
          setDuration(realElapsedTimeSeconds);
        }
        const report = engine.getTelemetryReport();
        const drivenDist = report.distanceCityKm + report.distanceHighwayKm;
        setDistance(drivenDist);
        
        let currentSpeedKmh = 0;
        if (report.speedProfile.length > 0) {
          currentSpeedKmh = report.speedProfile[report.speedProfile.length - 1].speed;
        }

        let targetColor = '#4ade80';
        let targetInsights = null;

        if (currentSpeedKmh <= 90) {
          targetColor = '#4ade80';
        } else if (currentSpeedKmh <= 105) {
          targetColor = '#eab308';
          targetInsights = engine.getAerodynamicPrediction(currentSpeedKmh);
        } else if (currentSpeedKmh <= 120) {
          targetColor = '#f97316';
          targetInsights = engine.getAerodynamicPrediction(currentSpeedKmh);
        } else {
          targetColor = '#ef4444';
          targetInsights = engine.getAerodynamicPrediction(currentSpeedKmh);
        }

        if (report.accelerationPenaltyMl > lastPenaltyRef.current) {
          setGaugeColor('#ef4444'); 
          setTimeout(() => setGaugeColor(targetColor), 1500);
          lastPenaltyRef.current = report.accelerationPenaltyMl;
        } else {
          setGaugeColor(targetColor);
        }
        
        setInsights(targetInsights);

        // Update Remaining Distance
        if (totalEstimatedDist > 0) {
          const newRemaining = Math.max(0, totalEstimatedDist - drivenDist);
          setRemainingDist(newRemaining);
          setPredictionMatrix(engine.calculateTripTradeoff(newRemaining));
        }

      }, 1000);
    } else {
      if (metricsRef.current) clearInterval(metricsRef.current);
    }

    return () => {
      if (metricsRef.current) clearInterval(metricsRef.current);
    };
  }, [active, totalEstimatedDist]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    Keyboard.dismiss();
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results && results.length > 0) {
        const dest = results[0];
        setTargetCoords(dest);
        
        let loc = currentCoords;
        if (!loc) {
          const curr = await Location.getCurrentPositionAsync({});
          loc = curr.coords;
        }
        
        const dist = TelemetryEngine.getDistanceKm(
          loc.latitude, loc.longitude,
          dest.latitude, dest.longitude
        );
        setTotalEstimatedDist(dist);
        setRemainingDist(dist);
        setPredictionMatrix(engine.calculateTripTradeoff(dist));
        
        mapRef.current?.fitToCoordinates([loc, dest], {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      } else {
        Alert.alert('Not Found', 'Could not find that destination.');
      }
    } catch (e) {
      // Offline mock fallback
      const mockDist = 20.0;
      setTargetCoords({ latitude: 32.0853, longitude: 34.7818 }); 
      setTotalEstimatedDist(mockDist);
      setRemainingDist(mockDist);
      setPredictionMatrix(engine.calculateTripTradeoff(mockDist));
    } finally {
      setSearching(false);
    }
  };

  const handleStartTrip = async (app?: 'waze' | 'gmaps') => {
    setSimActiveFlag(simActive);
    await startBackgroundTracking();

    setIsTripActive(true);
    setActive(true);
    tripStartTimeRef.current = Date.now();
    setDuration(0);
    setDistance(0);
    setInsights(null);
    engine.reset();
    lastPenaltyRef.current = 0;

    if (app && searchQuery) {
      const wazeUrl = `waze://?q=${encodeURIComponent(searchQuery)}`;
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
      const url = app === 'waze' ? wazeUrl : gmapsUrl;
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        }
      } catch (e) {
        Alert.alert('App Not Installed', `Could not open ${app}.`);
      }
    }
  };

  const handleEndTrip = async () => {
    setIsTripActive(false);
    setActive(false);
    tripStartTimeRef.current = null;
    
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    
    if (!simActive) {
      await stopBackgroundTracking();
    }
    
    overlayManager.hideOverlay();

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
        id: Date.now().toString(),
        date: new Date().toISOString(),
        distanceCityKm: report.distanceCityKm,
        distanceHighwayKm: report.distanceHighwayKm,
        accelerationPenaltyMl: report.accelerationPenaltyMl,
        speedProfile: report.speedProfile,
      };

      await outbox.enqueue('TRIP_SYNC', { vehicleId, ...tripData });
      await addTripToHistory(tripData);

      engine.reset();
      navigation.navigate('DashboardTab');
    } catch (e) {
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
      {/* URBAN ALERT OVERLAY */}
      {urbanAlert && urbanAlert.active && (
        <View style={styles.urbanAlertOverlay}>
          <Text style={styles.urbanAlertTitle}>⚠️ Urban Speeding Detected</Text>
          <Text style={styles.urbanAlertBody}>Harsh acceleration inside city limits. Ease off the gas.</Text>
        </View>
      )}

      {/* MAP SECTION (Top Half) */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          customMapStyle={darkMapStyle}
          showsUserLocation={true}
          showsMyLocationButton={false}
          initialRegion={{
            latitude: currentCoords?.latitude || 32.0853,
            longitude: currentCoords?.longitude || 34.7818,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {targetCoords && <Marker coordinate={targetCoords} pinColor="#4ade80" />}
        </MapView>
        
        {/* Custom Location Button */}
        <TouchableOpacity 
          style={styles.myLocationBtn}
          onPress={() => {
            if (currentCoords && mapRef.current) {
              mapRef.current.animateCamera({
                center: { latitude: currentCoords.latitude, longitude: currentCoords.longitude },
                zoom: 15
              });
            }
          }}
        >
          <Ionicons name="locate" size={24} color="#1e1e1e" />
        </TouchableOpacity>
        
        {/* Search Overlay */}
        {!active && (
          <View style={styles.searchOverlay}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#888" style={{marginLeft: 10}} />
              <TextInput 
                style={styles.searchInput}
                placeholder="Where to?"
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
              />
              {searching && <ActivityIndicator color="#4ade80" style={{marginRight: 10}}/>}
            </View>
          </View>
        )}
      </View>

      {/* DASHBOARD SECTION (Bottom Half) */}
      <View style={styles.dashboardContainer}>
        {/* Sim Toggle */}
        <View style={styles.simToggleRow}>
          <Text style={styles.simToggleText}>Simulate</Text>
          <Switch 
            value={simActive} 
            onValueChange={setSimActive}
            disabled={active}
            trackColor={{ true: '#4ade80', false: '#333' }}
            thumbColor="#fff"
          />
        </View>

        {/* Prediction Matrix or Progress Card */}
        {predictionMatrix && (
          <View style={styles.matrixCard}>
            <Text style={styles.matrixTitle}>{active ? 'Projected Savings Remaining' : 'Pre-Trip Target Matrix'}</Text>
            {active && (
              <Text style={styles.remainingDist}>Remaining: {remainingDist.toFixed(1)} km</Text>
            )}
            <Text style={styles.matrixText}>
              Capping at 95 km/h will add <Text style={styles.highlight}>{predictionMatrix.timeAddedMins} mins</Text> 
              {' '}but save <Text style={styles.highlight}>${predictionMatrix.savedMoney}</Text> 
              {' '}({predictionMatrix.savedLiters} L) upon arrival.
            </Text>
          </View>
        )}

        {/* Gauge & Main Metrics */}
        <View style={styles.centerMetrics}>
          <View style={[styles.smallGauge, { borderColor: gaugeColor }]}>
            <Text style={styles.speedText}>{speed.toFixed(0)}</Text>
            <Text style={styles.label}>km/h</Text>
          </View>
          
          <View style={styles.metricColumn}>
            <Text style={styles.metricVal}>{distance.toFixed(1)} km</Text>
            <Text style={styles.metricLabel}>Driven</Text>
            
            <Text style={[styles.metricVal, { marginTop: 10 }]}>{formatTime(duration)}</Text>
            <Text style={styles.metricLabel}>Time</Text>
          </View>
        </View>

        {insights && (
          <View style={styles.insightsBox}>
            <Text style={styles.insightsText}>
              Drop to 90 km/h to save {insights.savedLitersPer100km} L/100km and ${insights.moneySavedPerHour}/hour
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {!active ? (
          <>
            <TouchableOpacity style={[styles.actionBtn, styles.btnStart]} onPress={() => handleStartTrip()}>
              <Text style={styles.btnText}>Start Tracking Locally</Text>
            </TouchableOpacity>
            
            {totalEstimatedDist > 0 && (
              <View style={styles.navRow}>
                <TouchableOpacity style={styles.navBtn} onPress={() => handleStartTrip('waze')}>
                  <MaterialCommunityIcons name="waze" size={20} color="#fff" />
                  <Text style={styles.navText}>Waze</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.navBtn} onPress={() => handleStartTrip('gmaps')}>
                  <MaterialCommunityIcons name="google-maps" size={20} color="#fff" />
                  <Text style={styles.navText}>GMaps</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, styles.btnStop]} onPress={handleEndTrip}>
            <Text style={styles.btnText}>End Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  mapContainer: { flex: 1, position: 'relative' },
  myLocationBtn: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: '#fff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  searchOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    height: 50,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  searchInput: { flex: 1, color: '#fff', paddingHorizontal: 15, fontSize: 16 },
  dashboardContainer: {
    flex: 1.2,
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: -5 },
  },
  simToggleRow: {
    position: 'absolute',
    top: -25,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  simToggleText: { color: '#9ca3af', marginRight: 10, fontWeight: '600', fontSize: 12 },
  matrixCard: {
    width: '100%',
    backgroundColor: '#1e1e1e',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80',
  },
  matrixTitle: { color: '#aaa', fontWeight: 'bold', marginBottom: 5, fontSize: 14 },
  remainingDist: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginBottom: 5 },
  matrixText: { color: '#eee', fontSize: 14, lineHeight: 20 },
  highlight: { color: '#4ade80', fontWeight: 'bold' },
  centerMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 15,
  },
  smallGauge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    marginRight: 30,
  },
  speedText: { fontSize: 48, fontWeight: '800', color: '#fff' },
  label: { fontSize: 16, color: '#9ca3af', fontWeight: '600', marginTop: -5 },
  metricColumn: { alignItems: 'flex-start' },
  metricVal: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  metricLabel: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  insightsBox: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  insightsText: { color: '#fff', fontSize: 13, textAlign: 'center' },
  actionBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnStart: { backgroundColor: '#4ade80' },
  btnStop: { backgroundColor: '#ef4444' },
  btnText: { fontSize: 18, fontWeight: 'bold', color: '#121212' },
  navRow: { flexDirection: 'row', gap: 15, width: '100%' },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  navText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  urbanAlertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ef4444',
    padding: 30,
    paddingTop: 60,
    zIndex: 999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 15,
  },
  urbanAlertTitle: { color: '#fff', fontWeight: '900', fontSize: 20, marginBottom: 5 },
  urbanAlertBody: { color: '#fff', fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
