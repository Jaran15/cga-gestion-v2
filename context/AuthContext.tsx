import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { Alert, Platform } from 'react-native';
import { useSegments, useRouter } from 'expo-router';
import { initializeSync } from '../utils/sync';
import { initDatabase } from '../utils/database';
import { initializeFormSync } from '../utils/formSync';
import { processSyncQueue, downloadUpdates, cleanupSync } from '../utils/sync';
import { downloadForms, uploadFormResponses } from '../utils/formSync';
import { PendingSyncOverlay } from '../components/PendingSyncOverlay';
import { SyncProgressModal } from '../components/SyncProgressModal';
import { isOnline } from '../utils/supabase';

const AuthContext = createContext<ReturnType<typeof useAuthStore> | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function useProtectedRoute(user: any) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!user && inAppGroup) {
      router.replace('/(auth)');
    } else if (user && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [user, segments]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const store = useAuthStore();
  const router = useRouter();
  const syncOverlayRef = useRef<any>(null);
  const initializingRef = useRef(false);
  const syncingRef = useRef(false);
  const [syncStatus, setSyncStatus] = useState<{
    visible: boolean;
    type: 'initializing' | 'downloading' | 'uploading' | 'complete' | 'error';
    message: string;
    progress?: number;
  }>({
    visible: false,
    type: 'initializing',
    message: 'Preparing application...',
  });
  
  useEffect(() => {
    const initialize = async () => {
      if (initializingRef.current) return;
      initializingRef.current = true;

      try {
        await store.initialize();
        
        if (store.user && Platform.OS !== 'web') {
          setSyncStatus({
            visible: true,
            type: 'initializing',
            message: 'Initializing database...',
          });

          await initDatabase();
          await initializeSync();
          await initializeFormSync();
        }
      } catch (error) {
        console.error('Initialization error:', error);
        setSyncStatus({
          visible: true,
          type: 'error',
          message: 'Failed to initialize application. Please try again.',
        });
      } finally {
        initializingRef.current = false;
      }
    };
    
    initialize();
  }, []);

  // Handle sync after login
  useEffect(() => {
    const performSync = async () => {
      if (!store.user || Platform.OS === 'web' || syncingRef.current) return;
      syncingRef.current = true;

      try {
        const online = await isOnline();
        if (!online) {
          setSyncStatus({
            visible: true,
            type: 'error',
            message: 'No internet connection. Please check your connection and try again.',
          });
          return;
        }

        setSyncStatus({
          visible: true,
          type: 'downloading',
          message: 'Downloading latest data...',
        });

        await downloadUpdates();

        setSyncStatus({
          visible: true,
          type: 'downloading',
          message: 'Downloading forms...',
        });

        await downloadForms();

        setSyncStatus({
          visible: true,
          type: 'uploading',
          message: 'Uploading pending changes...',
        });

        await processSyncQueue();
        await uploadFormResponses();

        setSyncStatus({
          visible: true,
          type: 'complete',
          message: 'All data synchronized successfully!',
        });

      } catch (error) {
        console.error('Sync error after login:', error);
        setSyncStatus({
          visible: true,
          type: 'error',
          message: 'Failed to sync data. Some features may be unavailable.',
        });
      } finally {
        syncingRef.current = false;
      }
    };

    if (store.user) {
      performSync();
    }
  }, [store.user]);

  useProtectedRoute(store.user);

  const handleLogout = async () => {
    const confirmLogout = async () => {
      try {
        await store.logout();
        router.replace('/(auth)');
      } catch (error) {
        console.error('Logout error:', error);
        Alert.alert('Error', 'Failed to logout. Please try again.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        await confirmLogout();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: confirmLogout }
        ],
        { cancelable: true }
      );
    }
  };

  const handleCancelSync = () => {
    cleanupSync();
    syncingRef.current = false;
    setSyncStatus(prev => ({ ...prev, visible: false }));
    Alert.alert(
      'Sync Cancelled',
      'Data synchronization was cancelled. Some features may be unavailable.',
      [{ text: 'OK' }]
    );
  };

  const handleCloseSync = () => {
    setSyncStatus(prev => ({ ...prev, visible: false }));
  };

  return (
    <AuthContext.Provider value={{ ...store, logout: handleLogout }}>
      {children}
      <PendingSyncOverlay ref={syncOverlayRef} />
      <SyncProgressModal 
        visible={syncStatus.visible} 
        status={syncStatus}
        onCancel={handleCancelSync}
        onClose={handleCloseSync}
      />
    </AuthContext.Provider>
  );
}