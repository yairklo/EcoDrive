import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { setIsTripActive } from './location';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  try {
    if (Constants.appOwnership === 'expo') {
      console.log('Running in Expo Go: Bypassing remote push notification permissions to avoid SDK 54 crash.');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      } catch (e) {
        console.log('Skipping remote push permissions (Expo Go limitations).');
      }
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  } catch (error) {
    console.error('Error registering notifications:', error);
  }
}

export function setupNotificationListeners(navigationRef: any) {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data.type === 'START_TRIP_PROMPT') {
      Alert.alert(
        "Start Trip?",
        "We noticed you're moving fast. Would you like to start tracking this trip to save fuel?",
        [
          { text: "Dismiss", style: "cancel" },
          { 
            text: "Start Trip", 
            onPress: () => {
              setIsTripActive(true);
              if (navigationRef.isReady()) {
                navigationRef.navigate('Drive');
              }
            } 
          }
        ]
      );
    }
  });

  return subscription;
}
