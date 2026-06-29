import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { computeDashboardMetrics } from '../services/analytics';

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  const loadData = async () => {
    try {
      const data = await computeDashboardMetrics();
      setMetrics(data);
    } catch (e) {
      console.error('Failed to load dashboard metrics', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!metrics) {
    return <View style={styles.container}><Text style={styles.loading}>Loading Analytics...</Text></View>;
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4caf50" />}
    >
      <Text style={styles.headerTitle}>EcoDrive Dashboard</Text>

      {/* Financial Savings Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Savings vs Baseline</Text>
        <View style={styles.row}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>${metrics.moneySaved}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{metrics.litersSaved} L</Text>
            <Text style={styles.statLabel}>Fuel Saved</Text>
          </View>
        </View>
      </View>

      {/* OLS Calibration Status Widget */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>OLS Calibration Status</Text>
        <Text style={[styles.calibrationStatus, metrics.refuelsCount >= 3 ? styles.high : styles.low]}>
          {metrics.calibrationStatus}
        </Text>
        {metrics.refuelsCount >= 3 && (
          <View style={styles.row}>
            <Text style={styles.factor}>k_city: {metrics.kCity}</Text>
            <Text style={styles.factor}>k_hwy: {metrics.kHighway}</Text>
          </View>
        )}
      </View>

      {/* Driving Split Visualizer */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Driving Split</Text>
        <View style={styles.splitBar}>
          <View style={[styles.cityBar, { width: `${metrics.cityRatio}%` }]} />
          <View style={[styles.hwyBar, { width: `${metrics.highwayRatio}%` }]} />
        </View>
        <View style={styles.row}>
          <Text style={styles.cityLabel}>City: {metrics.cityRatio}%</Text>
          <Text style={styles.hwyLabel}>Highway: {metrics.highwayRatio}%</Text>
        </View>
      </View>

      {/* Recent Trips Feed */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Trips</Text>
        {metrics.recentTrips.length === 0 ? (
          <Text style={styles.empty}>No trips recorded yet.</Text>
        ) : (
          metrics.recentTrips.map((trip: any) => (
            <View key={trip.id} style={styles.tripRow}>
              <View>
                <Text style={styles.tripDate}>{new Date(trip.date).toLocaleDateString()}</Text>
                <Text style={styles.tripDist}>{trip.totalDist.toFixed(1)} km</Text>
              </View>
              <View style={[styles.scoreBadge, styles[`score${trip.score}` as keyof typeof styles]]}>
                <Text style={styles.scoreText}>{trip.score}</Text>
              </View>
            </View>
          ))
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  loading: {
    color: '#888',
    textAlign: 'center',
    marginTop: 100,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  statLabel: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  calibrationStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  low: {
    color: '#ffb300',
  },
  high: {
    color: '#4caf50',
  },
  factor: {
    color: '#888',
    fontSize: 14,
  },
  splitBar: {
    height: 12,
    backgroundColor: '#333',
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },
  cityBar: {
    backgroundColor: '#2196f3',
    height: '100%',
  },
  hwyBar: {
    backgroundColor: '#ff9800',
    height: '100%',
  },
  cityLabel: {
    color: '#2196f3',
    fontWeight: '600',
  },
  hwyLabel: {
    color: '#ff9800',
    fontWeight: '600',
  },
  empty: {
    color: '#666',
    fontStyle: 'italic',
  },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tripDate: {
    color: '#eee',
    fontSize: 16,
    fontWeight: '500',
  },
  tripDist: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  scoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  scoreA: { backgroundColor: '#4caf50' },
  scoreB: { backgroundColor: '#8bc34a' },
  scoreC: { backgroundColor: '#ffeb3b' },
  scoreD: { backgroundColor: '#ff9800' },
  scoreF: { backgroundColor: '#f44336' },
});
