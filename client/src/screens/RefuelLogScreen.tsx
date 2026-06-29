import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../services/api';

type Props = {
  navigation: NativeStackNavigationProp<any, any>;
};

export default function RefuelLogScreen({ navigation }: Props) {
  const [vehicleId, setVehicleId] = useState('');
  const [odometer, setOdometer] = useState('');
  const [litersPumped, setLitersPumped] = useState('');
  const [costPerLiter, setCostPerLiter] = useState('');

  const handleSubmit = async () => {
    try {
      await api.post('/api/refuel', {
        vehicleId,
        odometer: parseInt(odometer, 10),
        litersPumped: parseFloat(litersPumped),
        costPerLiter: parseFloat(costPerLiter),
      });
      Alert.alert('Success', 'Refuel log saved!');
      setOdometer('');
      setLitersPumped('');
      setCostPerLiter('');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Unknown error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log Refueling</Text>
      <TextInput
        style={styles.input}
        placeholder="Vehicle ID (UUID)"
        value={vehicleId}
        onChangeText={setVehicleId}
      />
      <TextInput
        style={styles.input}
        placeholder="Current Odometer (km)"
        value={odometer}
        onChangeText={setOdometer}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Liters Pumped"
        value={litersPumped}
        onChangeText={setLitersPumped}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Cost Per Liter"
        value={costPerLiter}
        onChangeText={setCostPerLiter}
        keyboardType="numeric"
      />
      <Button title="Save Log" onPress={handleSubmit} />
      <Button title="Back to Vehicle" onPress={() => navigation.navigate('VehicleSetup')} />
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
