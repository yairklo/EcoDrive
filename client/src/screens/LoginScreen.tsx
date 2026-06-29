import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../services/api';
import { setToken } from '../services/auth';
import { AuthSchema } from '../schemas/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  navigation: NativeStackNavigationProp<any, any>;
};

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const result = AuthSchema.safeParse({ email, password });
    if (!result.success) {
      Alert.alert('Validation Error', result.error.errors[0].message);
      return;
    }

    try {
      const response = await api.post('/api/auth/login', { email, password });
      await setToken(response.data.token);
      Alert.alert('Success', 'Logged in successfully!');
      // Navigate to Home/Dashboard (Task 3+)
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.error || 'Unknown error');
    }
  };

  const handleGuestMode = async () => {
    try {
      const guestId = `guest_user_${generateUUID()}`;
      const mockToken = 'mock_guest_jwt_token';
      
      const guestProfile = {
        id: guestId,
        email: 'guest@ecodrive.local',
        name: 'Guest User',
        token: mockToken,
      };

      // Wrap in try-catch to prevent app freeze on storage failure
      await AsyncStorage.setItem('user_profile', JSON.stringify(guestProfile));
      await setToken(mockToken);
      
      Alert.alert('Offline Mode', 'Continuing as Guest offline.');
      navigation.navigate('VehicleSetup');
    } catch (error) {
      console.error('Failed to initialize guest profile in AsyncStorage:', error);
      Alert.alert('Initialization Error', 'Could not create guest session. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EcoDrive Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
      <Button title="Go to Register" onPress={() => navigation.navigate('Register')} />
      <View style={{ marginTop: 20 }}>
        <Button title="Continue Offline (Guest)" color="#4caf50" onPress={handleGuestMode} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});
