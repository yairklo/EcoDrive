import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { outbox } from '../services/outbox';
import { setVehiclePhysics } from '../services/location';

type Props = {
  navigation: NativeStackNavigationProp<any, any>;
};

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const CATEGORIES = [
  { label: 'Mini/Hatchback', mass: 1000, eff: 0.32 },
  { label: 'Sedan/Family', mass: 1400, eff: 0.30 },
  { label: 'SUV/Crossover', mass: 1800, eff: 0.28 },
  { label: 'Heavy/Commercial', mass: 2500, eff: 0.25 },
];

export default function VehicleSetupScreen({ navigation }: Props) {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[1]);
  const [mass, setMass] = useState(CATEGORIES[1].mass.toString());
  const [fuelCapacity, setFuelCapacity] = useState('50');

  const handleCategorySelect = (cat: typeof CATEGORIES[0]) => {
    setSelectedCategory(cat);
    setMass(cat.mass.toString());
  };

  const handleCreateVehicle = async () => {
    const capacity = parseFloat(fuelCapacity);
    const massKg = parseFloat(mass);

    if (isNaN(capacity) || capacity < 20 || capacity > 150) {
      Alert.alert('Error', 'Fuel capacity must be between 20L and 150L.');
      return;
    }

    if (isNaN(massKg) || massKg <= 0) {
      Alert.alert('Error', 'Vehicle mass must be a valid positive number.');
      return;
    }

    try {
      const vehicleId = generateUUID();
      const payload = {
        type: selectedCategory.label,
        fuelCapacity: capacity,
        massKg,
        thermalEfficiency: selectedCategory.eff,
        vehicleId,
      };

      // Set physics for local telemetry calculations
      setVehiclePhysics(massKg, selectedCategory.eff);

      await outbox.enqueue('VEHICLE_SETUP', payload);
      Alert.alert('Success', 'Vehicle profile configured!');
      navigation.navigate('RefuelLog', { vehicleId });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to configure vehicle.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Vehicle Setup</Text>
      
      <Text style={styles.label}>Select Vehicle Category:</Text>
      <View style={styles.categoryContainer}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity 
            key={cat.label} 
            style={[styles.categoryBtn, selectedCategory.label === cat.label && styles.categoryBtnActive]}
            onPress={() => handleCategorySelect(cat)}
          >
            <Text style={[styles.categoryText, selectedCategory.label === cat.label && styles.categoryTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Vehicle Mass (kg):</Text>
      <TextInput
        style={styles.input}
        value={mass}
        onChangeText={setMass}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Fuel Tank Capacity (Liters):</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 50"
        value={fuelCapacity}
        onChangeText={setFuelCapacity}
        keyboardType="numeric"
      />

      <View style={styles.buttonContainer}>
        <Button title="Save Profile & Continue" onPress={handleCreateVehicle} color="#4caf50" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryBtn: {
    width: '48%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  categoryBtnActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  categoryText: {
    color: '#333',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginTop: 30,
  },
});
