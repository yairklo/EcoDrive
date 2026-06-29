import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { getSettings, saveSettings, EcoSettings, defaultSettings } from '../services/audioCoach';
import { getVehicleProfile, saveVehicleProfile, VehicleProfile } from '../services/vehicleProfile';

const CATEGORIES = [
  { label: 'Mini/Hatchback', mass: 1000, eff: 0.32 },
  { label: 'Sedan/Family', mass: 1400, eff: 0.30 },
  { label: 'SUV/Crossover', mass: 1800, eff: 0.28 },
  { label: 'Heavy/Commercial', mass: 2500, eff: 0.25 },
];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<EcoSettings>(defaultSettings);
  const [profile, setProfile] = useState<VehicleProfile | null>(null);
  const [massStr, setMassStr] = useState('');
  const [effStr, setEffStr] = useState('');

  useEffect(() => {
    getSettings().then(setSettings);
    getVehicleProfile().then(p => {
      if (p) {
        setProfile(p);
        setMassStr(p.massKg.toString());
        setEffStr(p.thermalEfficiency.toString());
      } else {
        // Fallback default
        setProfile({ type: 'Sedan/Family', massKg: 1400, thermalEfficiency: 0.3, fuelCapacity: 50 });
        setMassStr('1400');
        setEffStr('0.3');
      }
    });
  }, []);

  const toggleSetting = (key: keyof EcoSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleCategorySelect = (cat: typeof CATEGORIES[0]) => {
    if (!profile) return;
    setProfile({ ...profile, type: cat.label });
    setMassStr(cat.mass.toString());
    setEffStr(cat.eff.toString());
  };

  const handleSaveProfile = async () => {
    const massKg = parseFloat(massStr);
    const eff = parseFloat(effStr);

    if (isNaN(massKg) || massKg <= 0 || isNaN(eff) || eff <= 0) {
      Alert.alert('Error', 'Invalid numerical values for vehicle profile.');
      return;
    }

    if (profile) {
      const newProfile = { ...profile, massKg, thermalEfficiency: eff };
      setProfile(newProfile);
      await saveVehicleProfile(newProfile);
      Alert.alert('Success', 'Physics profile calibrated.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.sectionTitle}>Audio Coaching</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Master Voice Coaching</Text>
            <Switch value={settings.masterVoice} onValueChange={() => toggleSetting('masterVoice')} trackColor={{true: '#4ade80', false: '#333'}} thumbColor="#fff"/>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, !settings.masterVoice && {color: '#666'}]}>High-Speed Audio Alerts</Text>
            <Switch value={settings.highSpeedAudio} onValueChange={() => toggleSetting('highSpeedAudio')} trackColor={{true: '#4ade80', false: '#333'}} thumbColor="#fff" disabled={!settings.masterVoice}/>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, !settings.masterVoice && {color: '#666'}]}>Acceleration Audio Alerts</Text>
            <Switch value={settings.accelerationAudio} onValueChange={() => toggleSetting('accelerationAudio')} trackColor={{true: '#4ade80', false: '#333'}} thumbColor="#fff" disabled={!settings.masterVoice}/>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Heads-Up Background Banners</Text>
            <Switch value={settings.headsUpBanners} onValueChange={() => toggleSetting('headsUpBanners')} trackColor={{true: '#4ade80', false: '#333'}} thumbColor="#fff"/>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Vehicle Physics Profile</Text>
        <View style={styles.card}>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity 
                key={cat.label} 
                style={[styles.categoryBtn, profile?.type === cat.label && styles.categoryBtnActive]}
                onPress={() => handleCategorySelect(cat)}
              >
                <Text style={[styles.categoryText, profile?.type === cat.label && styles.categoryTextActive]}>
                  {cat.label.split('/')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Mass (kg):</Text>
          <TextInput
            style={styles.input}
            value={massStr}
            onChangeText={setMassStr}
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>Drag / Thermal Efficiency:</Text>
          <TextInput
            style={styles.input}
            value={effStr}
            onChangeText={setEffStr}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
            <Text style={styles.saveBtnText}>Save Calibration</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  contentContainer: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#aaa', marginBottom: 10, marginTop: 10 },
  card: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  label: { color: '#fff', fontSize: 16, flex: 1, marginRight: 10, fontWeight: '500' },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15 },
  categoryBtn: { width: '48%', padding: 10, borderWidth: 1, borderColor: '#333', borderRadius: 8, marginBottom: 10, alignItems: 'center', backgroundColor: '#121212' },
  categoryBtnActive: { borderColor: '#4ade80', backgroundColor: '#1e3a2f' },
  categoryText: { color: '#888', fontWeight: '500', fontSize: 14 },
  categoryTextActive: { color: '#4ade80', fontWeight: 'bold' },
  inputLabel: { color: '#aaa', fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#333', backgroundColor: '#121212', color: '#fff', padding: 12, borderRadius: 8, fontSize: 16 },
  saveBtn: { backgroundColor: '#4ade80', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#121212', fontWeight: 'bold', fontSize: 16 },
});
