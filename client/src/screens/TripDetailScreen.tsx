import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

export default function TripDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { trip } = route.params;

  const totalDist = trip.distanceCityKm + trip.distanceHighwayKm;
  const speedProfile = trip.speedProfile || [];
  
  // Calculate Time vs Money Trade-off
  let potentialSavings = 0;
  let timeAddedMins = 0;
  let wastedLiters = 0;

  if (speedProfile.length > 0) {
    const avgHwySpeed = speedProfile
      .filter((p: any) => p.speed > 90)
      .reduce((sum: number, p: any, _, arr: any) => sum + p.speed / arr.length, 0);

    if (avgHwySpeed > 95 && trip.distanceHighwayKm > 0) {
      const baselineLitersPer100km = 6.0;
      const currentLitersPer100km = baselineLitersPer100km * Math.pow(avgHwySpeed / 90, 2);
      const cappedLitersPer100km = baselineLitersPer100km * Math.pow(95 / 90, 2);

      const litersUsed = currentLitersPer100km * (trip.distanceHighwayKm / 100);
      const litersCapped = cappedLitersPer100km * (trip.distanceHighwayKm / 100);
      wastedLiters = litersUsed - litersCapped;
      potentialSavings = wastedLiters * 1.50; // $1.50 per L

      const actualHours = trip.distanceHighwayKm / avgHwySpeed;
      const cappedHours = trip.distanceHighwayKm / 95;
      timeAddedMins = (cappedHours - actualHours) * 60;
    }
  }

  // Chart Data Preparation
  // Subsample to max 40 points to avoid chart crashing
  const sampleRate = Math.ceil(speedProfile.length / 40) || 1;
  const chartData = speedProfile.filter((_: any, i: number) => i % sampleRate === 0).map((p: any) => p.speed);
  
  // Provide fallback if data is completely empty
  const finalChartData = chartData.length > 1 ? chartData : [0, 0];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Insights</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Scorecard */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Efficiency Audit</Text>
        {potentialSavings > 0 ? (
          <>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Potential Savings (capped at 95 km/h):</Text>
              <Text style={styles.auditValue}>${potentialSavings.toFixed(2)}</Text>
            </View>
            <Text style={styles.auditSub}>({wastedLiters.toFixed(2)} Liters)</Text>
            
            <View style={styles.dilemmaBox}>
              <Text style={styles.dilemmaText}>
                By capping your speed at 95 km/h on the highway, you would have added only <Text style={styles.highlight}>{timeAddedMins.toFixed(1)} minutes</Text> to your journey, but saved <Text style={styles.highlight}>${potentialSavings.toFixed(2)}</Text> in fuel.
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.perfectScore}>Great job! You drove highly efficiently with no excessive aerodynamic waste.</Text>
        )}
      </View>

      {/* Velocity Chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Velocity Profile</Text>
        <LineChart
          data={{
            labels: [],
            datasets: [{ data: finalChartData }]
          }}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#1e1e1e',
            backgroundGradientFrom: '#1e1e1e',
            backgroundGradientTo: '#1e1e1e',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(74, 222, 128, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: '#1e1e1e'
            }
          }}
          getDotColor={(dataPoint: number) => {
            if (dataPoint > 120) return '#ef4444'; // Red
            if (dataPoint > 105) return '#f97316'; // Orange
            if (dataPoint > 90) return '#eab308'; // Yellow
            return '#4ade80'; // Green
          }}
          bezier
          style={{ marginVertical: 8, borderRadius: 16, marginLeft: -20 }}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#aaa', marginBottom: 15 },
  auditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  auditLabel: { color: '#eee', fontSize: 16, flex: 1 },
  auditValue: { color: '#ef4444', fontSize: 24, fontWeight: 'bold' },
  auditSub: { color: '#888', textAlign: 'right', marginTop: 4 },
  dilemmaBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80'
  },
  dilemmaText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  highlight: { color: '#4ade80', fontWeight: 'bold' },
  perfectScore: { color: '#4ade80', fontSize: 16, textAlign: 'center', marginVertical: 20 },
});
