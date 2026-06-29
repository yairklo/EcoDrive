import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_KEY = '@ecodrive_settings';

export interface EcoSettings {
  masterVoice: boolean;
  highSpeedAudio: boolean;
  accelerationAudio: boolean;
  headsUpBanners: boolean;
}

export const defaultSettings: EcoSettings = {
  masterVoice: true,
  highSpeedAudio: true,
  accelerationAudio: true,
  headsUpBanners: true,
};

export async function getSettings(): Promise<EcoSettings> {
  try {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: EcoSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

class AudioCoachService {
  private lastPlayedMap: Record<string, number> = {};
  private readonly THROTTLE_MS = 60000; // 60 seconds

  public async speakHighSpeedAlert() {
    const settings = await getSettings();
    if (!settings.masterVoice || !settings.highSpeedAudio) return;

    this.speakThrottled(
      'high_speed',
      "Slowing down to 95 kilometers per hour will save you money on this trip with a minor time tradeoff."
    );
  }

  public async speakAccelerationAlert(muted: boolean = false) {
    if (muted) return;
    const settings = await getSettings();
    if (!settings.masterVoice || !settings.accelerationAudio) return;

    this.speakThrottled('acceleration', "Gentle on the throttle.");
  }

  public async speakUrbanAccelerationAlert() {
    const settings = await getSettings();
    if (!settings.masterVoice || !settings.accelerationAudio) return;

    // Use a custom throttle for this alert (20 seconds)
    const now = Date.now();
    const lastPlayed = this.lastPlayedMap['urban_accel'] || 0;

    if (now - lastPlayed >= 20000) {
      Speech.speak("האצה חדה מדי לעיר", { language: 'he' });
      this.lastPlayedMap['urban_accel'] = now;
    }
  }

  private speakThrottled(key: string, text: string) {
    const now = Date.now();
    const lastPlayed = this.lastPlayedMap[key] || 0;

    if (now - lastPlayed >= this.THROTTLE_MS) {
      Speech.speak(text, { language: 'en' });
      this.lastPlayedMap[key] = now;
    }
  }
}

export const audioCoach = new AudioCoachService();
