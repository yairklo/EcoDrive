import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';

import VehicleSetupScreen from './src/screens/VehicleSetupScreen';
import RefuelLogScreen from './src/screens/RefuelLogScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="VehicleSetup" component={VehicleSetupScreen} />
        <Stack.Screen name="RefuelLog" component={RefuelLogScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
