import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { isOnline } from '../utils/supabase';
import { processSyncQueue, downloadUpdates } from '../utils/sync';
import * as SQLite from 'expo-sqlite';

export function SyncStatus() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const checkOnlineStatus = async () => {
      const status = await isOnline();
      setOnline(status);
    };

    checkOnlineStatus();
    const onlineInterval = setInterval(checkOnlineStatus, 30000); // Check every 30 seconds

    return () => {
      clearInterval(onlineInterval);
    };
  }, []);

  const handleSync = async () => {
    if (!online) return;
    
    setSyncing(true);
    try {
      await processSyncQueue();
      await downloadUpdates();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View style={[styles.dot, { backgroundColor: online ? '#4CAF50' : '#F44336' }]} />
        <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
      </View>
      
      {syncing && (
        <View style={styles.syncingContainer}>
          <Text style={styles.syncingText}>Syncing...</Text>
        </View>
      )}
      
      <Button
        type="clear"
        icon={
          <Ionicons
            name="sync"
            size={24}
            color={online ? '#f4511e' : '#999'}
          />
        }
        loading={syncing}
        disabled={!online || syncing}
        onPress={handleSync}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  syncingContainer: {
    backgroundColor: '#f4511e20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncingText: {
    fontSize: 12,
    color: '#f4511e',
  },
});