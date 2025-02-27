import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Icon } from '@rneui/themed';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../../utils/database';
import { processSyncQueue, downloadUpdates } from '../../utils/sync';
import { isOnline } from '../../utils/supabase';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getVisitReports } from '../../utils/database/visits';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);

  useEffect(() => {
    const checkOnlineStatus = async () => {
      const status = await isOnline();
      setOnline(status);
    };

    checkOnlineStatus();
    const interval = setInterval(checkOnlineStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      loadRecentVisits();
    }
  }, [user]);

  const loadRecentVisits = async () => {
    if (!user) return;
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      const reports = await getVisitReports(
        null,
        startDate.toISOString(),
        new Date().toISOString(),
        user.id
      );
      setRecentVisits(reports);
    } catch (error) {
      console.error('Error loading visits:', error);
    }
  };

  const handleSync = async () => {
    if (!online) return;
    
    setSyncing(true);
    try {
      await processSyncQueue();
      await downloadUpdates();
      setLastSync(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleExportDatabase = async () => {
    if (Platform.OS === 'web') {
      alert('Database export is not available on web platform');
      return;
    }

    try {
      const db = getDatabase();
      await db.closeAsync();

      const dbPath = `${FileSystem.documentDirectory}SQLite/app.db`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportPath = `${FileSystem.cacheDirectory}database-export-${timestamp}.db`;

      await FileSystem.copyAsync({
        from: dbPath,
        to: exportPath
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(exportPath, {
          mimeType: 'application/x-sqlite3',
          dialogTitle: 'Export Database',
          UTI: 'public.database'
        });

        await FileSystem.deleteAsync(exportPath, { idempotent: true });
      } else {
        alert('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export database. Please try again.');
    }
  };

  const isController = user?.roles?.some(r => r.name === 'controlador');
  const isRegularUser = user?.roles?.some(r => r.name === 'usuario');

  const userActions = [
    ...(isRegularUser ? [
      {
        title: 'Visits',
        icon: 'time',
        route: '/(app)/visits',
        description: 'Track and manage company visits'
      },
      {
        title: 'Forms',
        icon: 'document-text',
        route: '/(app)/forms',
        description: 'Fill out and submit forms'
      }
    ] : []),
    ...(isController || user?.isAdmin ? [
      {
        title: 'Reports',
        icon: 'bar-chart',
        route: '/(app)/reports',
        description: 'View analytics and generate reports'
      }
    ] : [])
  ];

  const adminActions = [
    {
      title: 'Users',
      icon: 'people',
      route: '/(app)/users',
      description: 'Manage system users and their permissions'
    },
    {
      title: 'Roles',
      icon: 'key',
      route: '/(app)/roles',
      description: 'Configure user roles and access levels'
    },
    {
      title: 'Companies',
      icon: 'business',
      route: '/(app)/companies',
      description: 'Manage company information and settings'
    },
    {
      title: 'Forms',
      icon: 'document-text',
      route: '/(app)/forms',
      description: 'Create and manage data collection forms'
    }
  ];

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome, {user?.username}!</Text>
      </View>
      
      <Card containerStyle={styles.syncCard}>
        <View style={styles.syncHeader}>
          <View style={styles.onlineStatus}>
            <View style={[styles.dot, { backgroundColor: online ? '#4CAF50' : '#F44336' }]} />
            <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
          </View>
          {lastSync && (
            <Text style={styles.lastSyncText}>Last sync: {lastSync}</Text>
          )}
        </View>
        
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
          containerStyle={styles.syncButton}
        />
        
        {syncing && (
          <Text style={styles.syncingText}>Syncing data with server...</Text>
        )}
      </Card>

      {isRegularUser && (
        <Card containerStyle={styles.actionsCard}>
          <Card.Title style={styles.sectionTitle}>Recent Activity</Card.Title>
          <Card.Divider />
          
          {recentVisits.length > 0 ? (
            recentVisits.map((report, index) => (
              <View key={index} style={styles.visitSummary}>
                <View style={styles.visitHeader}>
                  <Text style={styles.companyName}>{report.company_name}</Text>
                  <Text style={styles.totalTime}>
                    Total: {formatDuration(report.total_duration)}
                  </Text>
                </View>
                <Text style={styles.visitCount}>
                  {report.visits.length} visit{report.visits.length !== 1 ? 's' : ''}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.noActivityContainer}>
              <Icon name="time-outline" type="ionicon" size={48} color="#666" />
              <Text style={styles.noActivityText}>No recent visits</Text>
              <Text style={styles.noActivitySubtext}>
                Start tracking your visits by clicking the button below
              </Text>
              <Button
                title="Start a Visit"
                onPress={() => router.push('/(app)/visits')}
                containerStyle={styles.startVisitButton}
              />
            </View>
          )}
          
          <Button
            title="View All Reports"
            type="outline"
            onPress={() => router.push('/(app)/reports')}
            containerStyle={styles.viewAllButton}
          />
        </Card>
      )}

      {userActions.length > 0 && (
        <Card containerStyle={styles.actionsCard}>
          <Card.Title style={styles.sectionTitle}>Quick Actions</Card.Title>
          <Card.Divider />
          
          <View style={styles.actionsGrid}>
            {userActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                onPress={() => router.push(action.route)}
              >
                <Ionicons name={action.icon} size={32} color="#f4511e" />
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {user?.isAdmin && (
        <>
          <Card containerStyle={styles.actionsCard}>
            <Card.Title style={styles.sectionTitle}>Management Actions</Card.Title>
            <Card.Divider />
            
            <View style={styles.actionsGrid}>
              {adminActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.actionCard}
                  onPress={() => router.push(action.route)}
                >
                  <Ionicons name={action.icon} size={32} color="#f4511e" />
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          <Card containerStyle={styles.databaseCard}>
            <Card.Title style={styles.sectionTitle}>Database Management</Card.Title>
            <Card.Divider />
            <Button
              title="Export Database"
              onPress={handleExportDatabase}
              icon={{
                name: 'download-outline',
                type: 'ionicon',
                color: 'white',
                size: 20,
              }}
              buttonStyle={styles.exportButton}
            />
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  syncCard: {
    margin: 20,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  syncHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  onlineStatus: {
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
  syncButton: {
    marginVertical: 10,
  },
  syncingText: {
    textAlign: 'center',
    color: '#f4511e',
    marginTop: 10,
    fontSize: 14,
  },
  actionsCard: {
    margin: 20,
    borderRadius: 10,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#333',
    marginBottom: 5,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 5,
  },
  actionDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  databaseCard: {
    margin: 20,
    borderRadius: 10,
    marginTop: 0,
  },
  exportButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  visitSummary: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalTime: {
    fontSize: 14,
    color: '#f4511e',
    fontWeight: '500',
  },
  visitCount: {
    fontSize: 14,
    color: '#666',
  },
  viewAllButton: {
    marginTop: 10,
  },
  noActivityContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 10,
  },
  noActivityText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 10,
  },
  noActivitySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 15,
  },
  startVisitButton: {
    width: '100%',
    maxWidth: 200,
  },
});