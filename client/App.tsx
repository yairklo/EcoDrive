import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';

import VehicleSetupScreen from './src/screens/VehicleSetupScreen';
import RefuelLogScreen from './src/screens/RefuelLogScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import DriveScreen from './src/screens/DriveScreen';
import { registerForPushNotificationsAsync, setupNotificationListeners } from './src/services/notifications';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    registerForPushNotificationsAsync();
    const subscription = setupNotificationListeners(navigationRef);

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="VehicleSetup" component={VehicleSetupScreen} />
        <Stack.Screen name="RefuelLog" component={RefuelLogScreen} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} />
        <Stack.Screen name="Drive" component={DriveScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
