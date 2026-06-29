import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { getSettings, saveSettings, EcoSettings, defaultSettings } from '../services/audioCoach';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<EcoSettings>(defaultSettings);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const toggleSetting = (key: keyof EcoSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Master Voice Coaching</Text>
          <Switch value={settings.masterVoice} onValueChange={() => toggleSetting('masterVoice')} trackColor={{true: '#4ade80', false: '#333'}} thumbColor="#fff"/>
        </View>
        <View style={styles.row}>
          <Text style={styles.label} style={[styles.label, !settings.masterVoice && {color: '#666'}]}>High-Speed Audio Alerts</Text>
          <Switch value={settings.highSpeedAudio} onValueChange={() => toggleSetting('highSpeedAudio')} trackColor={{true: '#4ade80', false: '#333'}} thumbColor="#fff" disabled={!settings.masterVoice}/>
        </View>
        <View style={styles.row}>
          <Text style={styles.label} style={[styles.label, !settings.masterVoice && {color: '#666'}]}>Acceleration Audio Alerts</Text>
          <Switch value={settings.accelerationAudio} onValueChange={() => toggleSetting('accelerationAudio')} trackColor={{true: '#4ade80', false: '#333'}} thumbColor="#fff" disabled={!settings.masterVoice}/>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Heads-Up Background Banners</Text>
          <Switch value={settings.headsUpBanners} onValueChange={() => toggleSetting('headsUpBanners')} trackColor={{true: '#4ade80', false: '#333'}} thumbColor="#fff"/>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  card: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  label: { color: '#fff', fontSize: 16, flex: 1, marginRight: 10, fontWeight: '500' },
});
