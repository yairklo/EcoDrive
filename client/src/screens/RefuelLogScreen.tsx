import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { outbox } from '../services/outbox';
import { addRefuelToHistory } from '../services/analytics';

type Props = {
  route: any;
  navigation: NativeStackNavigationProp<any, any>;
};

export default function RefuelLogScreen({ route, navigation }: Props) {
  const { vehicleId, isOnboarding } = route?.params || { vehicleId: 'local-test-uuid', isOnboarding: false };
  const [odometer, setOdometer] = useState('45000');
  const [liters, setLiters] = useState('40.5');
  const [cost, setCost] = useState('1.50');
  const [loading, setLoading] = useState(false);

  const submitLog = async () => {
    if (!odometer || !liters || !cost) {
      Alert.alert('Missing Info', 'Please fill out all fields.');
      return;
    }

    setLoading(true);
    try {
      await outbox.enqueue('REFUEL_LOG', {
        vehicleId,
        odometer: parseInt(odometer, 10),
        litersPumped: parseFloat(liters),
        costPerLiter: parseFloat(cost),
      });

      await addRefuelToHistory({
        odometer: parseInt(odometer, 10),
        litersPumped: parseFloat(liters),
        costPerLiter: parseFloat(cost),
      });

      if (isOnboarding) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } else {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save log');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        {!isOnboarding && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Log Refuel</Text>
        {!isOnboarding && <View style={{width: 28}} />} 
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Current Odometer (km)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="speedometer-outline" size={20} color="#888" style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 45000"
              placeholderTextColor="#888"
              keyboardType="numeric" 
              value={odometer}
              onChangeText={setOdometer} 
            />
          </View>

          <Text style={styles.label}>Liters Pumped</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="water-outline" size={20} color="#888" style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 40.5"
              placeholderTextColor="#888"
              keyboardType="numeric" 
              value={liters}
              onChangeText={setLiters} 
            />
          </View>

          <Text style={styles.label}>Cost Per Liter ($)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="pricetag-outline" size={20} color="#888" style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 1.50"
              placeholderTextColor="#888"
              keyboardType="numeric" 
              value={cost}
              onChangeText={setCost} 
            />
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={submitLog} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#121212" />
            ) : (
              <Text style={styles.submitText}>Save Entry</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  label: { color: '#aaa', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 15 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 50,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 16 },
  submitBtn: {
    backgroundColor: '#4ade80',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 30,
  },
  submitText: { color: '#121212', fontSize: 18, fontWeight: 'bold' },
});
