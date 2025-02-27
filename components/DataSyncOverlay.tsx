import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { isOnline } from '../utils/supabase';
import { processSyncQueue, downloadUpdates } from '../utils/sync';
import { downloadForms, uploadFormResponses } from '../utils/formSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../utils/database';

// Keep track of sync status globally
let isSyncInProgress = false;

export function DataSyncOverlay() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'checking' | 'downloading' | 'uploading' | 'complete' | 'offline'>('checking');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  const [currentTask, setCurrentTask] = useState<string>('');
  const isCancelled = React.useRef(false);

  useEffect(() => {
    checkInitialSync();
    return () => {
      isCancelled.current = true;
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (startTime && status !== 'complete' && status !== 'offline') {
      interval = setInterval(() => {
        const now = new Date();
        const diff = now.getTime() - startTime.getTime();
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [startTime, status]);

  const performSync = async () => {
    if (isSyncInProgress) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    const db = getDatabase();
    isSyncInProgress = true;

    try {
      // Upload pending changes first
      setStatus('uploading');
      setCurrentTask('Uploading pending changes...');
      await processSyncQueue();

      // Upload form responses
      setCurrentTask('Uploading form responses...');
      await uploadFormResponses();

      // Download base data
      setStatus('downloading');
      setCurrentTask('Downloading base data...');
      await downloadUpdates();

      // Download form templates
      setCurrentTask('Downloading form templates...');
      await downloadForms();

      // Verify the sync was successful
      const formsCount = await db.getAllAsync('SELECT COUNT(*) as count FROM forms');
      console.log('Forms count after sync:', formsCount[0].count);

      if (!isCancelled.current) {
        setStatus('complete');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await AsyncStorage.setItem('initialSyncComplete', 'true');
        
        // Force a database refresh
        await db.execAsync('PRAGMA wal_checkpoint(FULL)');
        
        setVisible(false);
      }
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    } finally {
      isSyncInProgress = false;
    }
  };

  const checkInitialSync = async () => {
    try {
      // Check if we're already syncing
      if (isSyncInProgress) {
        console.log('Sync already in progress, skipping initialization...');
        setVisible(false);
        return;
      }

      const hasInitialSync = await AsyncStorage.getItem('initialSyncComplete');
      if (hasInitialSync) {
        console.log('Initial sync already completed, skipping...');
        setVisible(false);
        return;
      }

      // Check online status
      setStatus('checking');
      const online = await isOnline();
      if (!online) {
        setStatus('offline');
        return;
      }

      // Start sync process if not cancelled
      if (!isCancelled.current) {
        setStartTime(new Date());
        await performSync();
      }
    } catch (error) {
      console.error('Sync error:', error);
      setVisible(false);
    }
  };

  const handleCancel = () => {
    isCancelled.current = true;
    setVisible(false);
  };

  const handleRetry = async () => {
    isCancelled.current = false;
    setStartTime(new Date());
    await checkInitialSync();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons 
              name={
                status === 'checking' ? 'sync' :
                status === 'downloading' ? 'cloud-download' :
                status === 'uploading' ? 'cloud-upload' :
                status === 'offline' ? 'cloud-offline' :
                'checkmark-circle'
              } 
              size={32} 
              color={status === 'offline' ? '#F44336' : '#f4511e'} 
            />
            <Text h4 style={styles.title}>
              {status === 'checking' ? 'Checking Data...' :
               status === 'downloading' ? 'Downloading Data...' :
               status === 'uploading' ? 'Uploading Data...' :
               status === 'offline' ? 'No Internet Connection' :
               'Sync Complete'}
            </Text>
          </View>

          {status !== 'complete' && status !== 'offline' && (
            <>
              <ActivityIndicator 
                size="large" 
                color="#f4511e" 
                style={styles.spinner}
              />
              <Text style={styles.taskText}>{currentTask}</Text>
              <Text style={styles.elapsedTime}>Time elapsed: {elapsedTime}</Text>
            </>
          )}

          <Text style={styles.description}>
            {status === 'checking' ? 'Checking for updates...' :
             status === 'downloading' ? 'Downloading data to local database...' :
             status === 'uploading' ? 'Uploading pending changes...' :
             status === 'offline' ? 'Please check your internet connection and try again.' :
             'All data has been synchronized'}
          </Text>

          <View style={styles.buttonContainer}>
            {status === 'offline' ? (
              <>
                <Button
                  title="Retry"
                  onPress={handleRetry}
                  containerStyle={styles.button}
                />
                <Button
                  title="Continue Offline"
                  type="outline"
                  onPress={handleCancel}
                  containerStyle={styles.button}
                />
              </>
            ) : (
              <Button
                title="Cancel"
                type="outline"
                onPress={handleCancel}
                containerStyle={styles.button}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  title: {
    color: '#333',
    marginBottom: 0,
  },
  spinner: {
    marginVertical: 20,
  },
  taskText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  elapsedTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  button: {
    flex: 1,
  },
});