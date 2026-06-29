import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../services/api';

type Props = {
  route: any;
  navigation: NativeStackNavigationProp<any, any>;
};

export default function AnalyticsScreen({ route }: Props) {
  const { vehicleId } = route.params || { vehicleId: '' };
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) {
      setLoading(false);
      return;
    }

    api.get(`/api/trips/vehicle/${vehicleId}/analytics`)
      .then(response => {
        setAnalytics(response.data.analytics);
      })
      .catch(error => {
        console.error('Failed to load analytics', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [vehicleId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.container}>
        <Text>No analytics data available.</Text>
      </View>
    );
  }

  const { _sum, _count } = analytics;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Post-Trip Analytics</Text>
      <View style={styles.card}>
        <Text style={styles.stat}>Total Syncs: {_count?.id || 0}</Text>
        <Text style={styles.stat}>City Distance: {(_sum?.distanceCityKm || 0).toFixed(2)} km</Text>
        <Text style={styles.stat}>Highway Distance: {(_sum?.distanceHighwayKm || 0).toFixed(2)} km</Text>
        <Text style={styles.stat}>Acceleration Penalty (Fuel Wasted): {(_sum?.accelerationPenaltyMl || 0).toFixed(2)} mL</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  stat: {
    fontSize: 18,
    marginVertical: 5,
    color: '#555',
  },
});
