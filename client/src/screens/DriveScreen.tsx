import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';

export default function DriveScreen() {
  const [speed, setSpeed] = useState(0);
  const [bgColor, setBgColor] = useState('#4caf50'); // Bright Green default

  useEffect(() => {
    let subscription: Location.LocationSubscription;

    (async () => {
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          const currentSpeed = (loc.coords.speed || 0) * 3.6; // convert m/s to km/h
          setSpeed(currentSpeed);
          
          // Ambient Color Shift Logic
          if (currentSpeed <= 80) {
            setBgColor('#4caf50'); // Bright Green (Optimal)
          } else if (currentSpeed > 80 && currentSpeed <= 100) {
            setBgColor('#ffb300'); // Soft Amber (Over-speeding)
          } else {
            setBgColor('#d32f2f'); // Deep Muted Crimson (Aggressive)
          }
        }
      );
    })();

    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={styles.speedText}>{speed.toFixed(0)}</Text>
      <Text style={styles.label}>km/h</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedText: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#fff',
  },
  label: {
    fontSize: 30,
    color: '#fff',
  },
});
