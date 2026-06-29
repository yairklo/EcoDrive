import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export class AudioService {
  private sound: Audio.Sound | null = null;
  private isLoaded = false;
  private lastSpokenTime = 0;

  public async loadSounds() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/alert.mp3')
      );
      this.sound = sound;
      this.isLoaded = true;
    } catch (error) {
      console.warn('Failed to load audio asset:', error);
    }
  }

  public async playAccelerationAlert() {
    if (!this.isLoaded || !this.sound) return;
    try {
      await this.sound.replayAsync();
    } catch (error) {
      console.error('Failed to play alert:', error);
    }
  }

  public speakEfficiencyGuidance(message: string) {
    const now = Date.now();
    // Limit spoken guidance to once every 2 minutes (120000 ms)
    if (now - this.lastSpokenTime > 120000) {
      Speech.speak(message, { rate: 0.9, pitch: 1.0 });
      this.lastSpokenTime = now;
    }
  }

  public async unload() {
    if (this.sound) {
      await this.sound.unloadAsync();
    }
  }
}
