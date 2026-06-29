import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import VehicleSetupScreen from './src/screens/VehicleSetupScreen';
import RefuelLogScreen from './src/screens/RefuelLogScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import MainTabs from './src/navigation/MainTabs';
import TripDetailScreen from './src/screens/TripDetailScreen';
import { registerForPushNotificationsAsync, setupNotificationListeners } from './src/services/notifications';
import { initVehiclePhysics } from './src/services/vehicleProfile';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const [isBooting, setIsBooting] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    registerForPushNotificationsAsync();
    const subscription = setupNotificationListeners(navigationRef);

    const checkSession = async () => {
      try {
        await initVehiclePhysics(); // Restore physics engine config
        const userProfile = await AsyncStorage.getItem('user_profile');
        if (userProfile) {
          setInitialRoute('MainTabs');
        }
      } catch (e) {
        console.log('Failed to read session:', e);
      } finally {
        setIsBooting(false);
      }
    };

    checkSession();

    return () => {
      subscription.remove();
    };
  }, []);

  if (isBooting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color="#4ade80" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="VehicleSetup" component={VehicleSetupScreen} />
          <Stack.Screen name="RefuelLog" component={RefuelLogScreen} />
          <Stack.Screen name="Analytics" component={AnalyticsScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="TripDetail" component={TripDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
