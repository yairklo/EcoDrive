import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../services/api';

type Props = {
  navigation: NativeStackNavigationProp<any, any>;
};

export default function VehicleSetupScreen({ navigation }: Props) {
  const [type, setType] = useState('Sedan');
  const [fuelCapacity, setFuelCapacity] = useState('');

  const handleCreateVehicle = async () => {
    const capacity = parseFloat(fuelCapacity);
    if (isNaN(capacity) || capacity <= 0) {
      Alert.alert('Error', 'Fuel capacity must be a positive number.');
      return;
    }

    try {
      await api.post('/api/vehicles', { type, fuelCapacity: capacity });
      Alert.alert('Success', 'Vehicle profile created!');
      navigation.navigate('RefuelLog');
    } catch (error: any) {
      Alert.alert('Failed to create vehicle', error.response?.data?.error || 'Unknown error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vehicle Setup</Text>
      <TextInput
        style={styles.input}
        placeholder="Type (e.g., Sedan, SUV)"
        value={type}
        onChangeText={setType}
      />
      <TextInput
        style={styles.input}
        placeholder="Fuel Capacity (Liters)"
        value={fuelCapacity}
        onChangeText={setFuelCapacity}
        keyboardType="numeric"
      />
      <Button title="Save Vehicle" onPress={handleCreateVehicle} />
      <Button title="Go to Logs" onPress={() => navigation.navigate('RefuelLog')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});
