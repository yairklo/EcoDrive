import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  route: any;
  navigation: NativeStackNavigationProp<any, any>;
};

export default function PostTripSummaryScreen({ route, navigation }: Props) {
  const { penaltyMl, distanceKm } = route.params || { penaltyMl: 0, distanceKm: 0 };
  const [ecoScore, setEcoScore] = useState(100);
  const [co2Prevented, setCo2Prevented] = useState(0);

  useEffect(() => {
    // Basic Eco-Score Calculation
    // Penalty is in mL. Suppose ideal is 0 penalty.
    const score = Math.max(0, 100 - (penaltyMl / 5));
    setEcoScore(Math.round(score));

    // CO2 Prevented (Assume standard trip would waste X amount of fuel without app)
    // 1 Liter of gasoline = ~2.3 kg of CO2.
    // Let's assume the user saved 10% of their total potential fuel burn by following guidance.
    // For MVP, we mock a saving metric based on distance.
    const savingsLiters = (distanceKm * 0.08) * 0.1; 
    setCo2Prevented(savingsLiters * 2.3);
  }, [penaltyMl, distanceKm]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trip Summary</Text>
      
      <View style={styles.scoreCircle}>
        <Text style={styles.scoreText}>{ecoScore}</Text>
        <Text style={styles.scoreLabel}>Eco-Score</Text>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statItem}>Distance: {distanceKm.toFixed(1)} km</Text>
        <Text style={styles.statItem}>Wasted Fuel: {penaltyMl.toFixed(1)} mL</Text>
        <Text style={styles.statItem}>CO₂ Prevented: {co2Prevented.toFixed(2)} kg</Text>
      </View>

      <Button title="Done" onPress={() => navigation.navigate('VehicleSetup')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 20,
  },
  scoreCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoreLabel: {
    fontSize: 16,
    color: '#fff',
  },
  statsContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 30,
  },
  statItem: {
    fontSize: 18,
    marginVertical: 5,
    textAlign: 'center',
  },
});
