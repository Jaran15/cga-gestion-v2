import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, createTheme } from '@rneui/themed';
import { initDatabase } from '../utils/database';
import { AuthProvider } from '../context/AuthContext';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useAuthStore } from '../store/auth';
import { PendingSyncOverlay } from '../components/PendingSyncOverlay';
import { DataSyncOverlay } from '../components/DataSyncOverlay';

const theme = createTheme({
  lightColors: {
    primary: '#f4511e',
    secondary: '#4CAF50',
  },
  darkColors: {
    primary: '#ff7043',
    secondary: '#66bb6a',
  },
  mode: 'light',
});

function InitialLayout() {
  const { isLoading } = useAuthStore();

  useEffect(() => {
    const prepare = async () => {
      try {
        if (Platform.OS !== 'web') {
          await initDatabase();
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    prepare();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#f4511e" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
      <PendingSyncOverlay />
      <DataSyncOverlay />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <InitialLayout />
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}