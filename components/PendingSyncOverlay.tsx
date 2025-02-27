import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet, Modal, Platform, TouchableWithoutFeedback } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { isOnline } from '../utils/supabase';
import { processSyncQueue, downloadUpdates } from '../utils/sync';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PendingSyncOverlay = forwardRef((props, ref) => {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [pendingTables, setPendingTables] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      if (!mountedRef.current) return;

      const status = await isOnline();
      setOnline(status);

      const db = SQLite.openDatabaseSync('app.db');
      const result = await db.getAllAsync(`
        SELECT table_name, COUNT(*) as count 
        FROM sync_queue 
        WHERE synced = 0 
        GROUP BY table_name
      `);

      if (!mountedRef.current) return;

      const tables = result.map(r => ({
        table: r.table_name,
        count: r.count
      }));

      setPendingTables(tables.map(t => `${t.table} (${t.count})`));
      setPendingChanges(tables.reduce((acc, t) => acc + t.count, 0));

      if (tables.length > 0) {
        const lastDismissed = await AsyncStorage.getItem('lastSyncDismissed');
        if (lastDismissed) {
          const lastDismissedTime = new Date(lastDismissed).getTime();
          const now = new Date().getTime();
          const hoursSinceDismiss = (now - lastDismissedTime) / (1000 * 60 * 60);
          setVisible(hoursSinceDismiss > 1);
        } else {
          setVisible(true);
        }
      } else {
        setVisible(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    if (!online || syncingRef.current) return;
    
    syncingRef.current = true;
    setSyncing(true);
    
    try {
      await processSyncQueue();
      await downloadUpdates();
      
      if (mountedRef.current) {
        setLastSync(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      if (mountedRef.current) {
        setSyncing(false);
      }
      syncingRef.current = false;
    }
  };

  useImperativeHandle(ref, () => ({
    handleSync
  }), []);

  const handleDismiss = async () => {
    await AsyncStorage.setItem('lastSyncDismissed', new Date().toISOString());
    setVisible(false);
  };

  if (Platform.OS === 'web' || pendingChanges === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.content}>
              <View style={styles.header}>
                <Ionicons name="warning" size={32} color="#f4511e" />
                <Text h4 style={styles.title}>Pending Changes</Text>
                <TouchableWithoutFeedback onPress={handleDismiss}>
                  <View style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#666" />
                  </View>
                </TouchableWithoutFeedback>
              </View>

              <Text style={styles.description}>
                There are {pendingChanges} changes that need to be synchronized with the server.
                You can continue using the app, but it's recommended to sync your changes when possible.
              </Text>

              {pendingTables.length > 0 && (
                <View style={styles.tableList}>
                  <Text style={styles.tablesTitle}>Pending Changes by Table:</Text>
                  {pendingTables.map((table, index) => (
                    <Text key={index} style={styles.tableItem}>• {table}</Text>
                  ))}
                </View>
              )}

              <View style={styles.statusContainer}>
                <View style={styles.statusIndicator}>
                  <View style={[styles.dot, { backgroundColor: online ? '#4CAF50' : '#F44336' }]} />
                  <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
                </View>
                {lastSync && (
                  <Text style={styles.lastSyncText}>Last sync: {lastSync}</Text>
                )}
                {syncing && (
                  <Text style={styles.syncingText}>Syncing changes...</Text>
                )}
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  title="Continue"
                  type="outline"
                  onPress={handleDismiss}
                  containerStyle={[styles.button, styles.buttonHalf]}
                />
                <Button
                  title="Sync Now"
                  icon={{
                    name: 'sync',
                    type: 'ionicon',
                    size: 20,
                    color: 'white',
                  }}
                  loading={syncing}
                  disabled={!online || syncing}
                  onPress={handleSync}
                  containerStyle={[styles.button, styles.buttonHalf]}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  title: {
    color: '#f4511e',
    marginBottom: 0,
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  tableList: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  tablesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  tableItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  lastSyncText: {
    fontSize: 12,
    color: '#666',
  },
  syncingText: {
    fontSize: 14,
    color: '#f4511e',
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    marginTop: 10,
  },
  buttonHalf: {
    flex: 1,
  },
});