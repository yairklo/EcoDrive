import AsyncStorage from '@react-native-async-storage/async-storage';
import { setVehiclePhysics } from './location';

export interface VehicleProfile {
  type: string;
  massKg: number;
  thermalEfficiency: number;
  fuelCapacity: number;
}

const PROFILE_KEY = 'vehicle_profile';

export const saveVehicleProfile = async (profile: VehicleProfile) => {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  setVehiclePhysics(profile.massKg, profile.thermalEfficiency);
};

export const getVehicleProfile = async (): Promise<VehicleProfile | null> => {
  const data = await AsyncStorage.getItem(PROFILE_KEY);
  if (data) return JSON.parse(data);
  return null;
};

export const initVehiclePhysics = async () => {
  const profile = await getVehicleProfile();
  if (profile) {
    setVehiclePhysics(profile.massKg, profile.thermalEfficiency);
  }
};
