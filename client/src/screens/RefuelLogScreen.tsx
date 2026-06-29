import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { outbox } from '../services/outbox';

type Props = {
  route: any;
  navigation: NativeStackNavigationProp<any, any>;
};

export default function RefuelLogScreen({ route, navigation }: Props) {
  const { vehicleId, isOnboarding } = route.params || { vehicleId: 'local-test-uuid', isOnboarding: false };
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [cost, setCost] = useState('');

  const submitLog = async () => {
    try {
      await outbox.enqueue('REFUEL_LOG', {
        vehicleId,
        odometer: parseInt(odometer, 10),
        litersPumped: parseFloat(liters),
        costPerLiter: parseFloat(cost),
      });

      Alert.alert('Success', 'Refuel log queued successfully!');
      
      if (isOnboarding) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Drive' }],
        });
      } else {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to queue log');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log Refuel</Text>
      
      <TextInput 
        style={styles.input} 
        placeholder="Odometer (km)" 
        keyboardType="numeric" 
        onChangeText={setOdometer} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Liters Pumped" 
        keyboardType="numeric" 
        onChangeText={setLiters} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Cost Per Liter" 
        keyboardType="numeric" 
        onChangeText={setCost} 
      />

      <Button title="Save Log" onPress={submitLog} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, marginBottom: 15 },
});
