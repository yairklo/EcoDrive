export default ({ config }) => {
  return {
    ...config,
    plugins: [
      'expo-secure-store',
      [
        'expo-location',
        {
          isAndroidBackgroundLocationEnabled: true
        }
      ],
      './plugins/withSystemOverlay.js',
      'expo-localization'
    ],
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "API_KEY_MISSING"
        }
      }
    }
  };
};
