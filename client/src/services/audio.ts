import { Audio } from 'expo-av';

export class AudioService {
  private sound: Audio.Sound | null = null;
  private isLoaded = false;

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

  public async unload() {
    if (this.sound) {
      await this.sound.unloadAsync();
    }
  }
}
