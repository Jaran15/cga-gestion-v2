import { Platform } from 'react-native';
import { supabase, isOnline } from './supabase';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

let db: SQLite.SQLiteDatabase | null = null;
let syncInProgress = false;
let syncTimeout: NodeJS.Timeout | null = null;
let globalTransaction = false;

const getDatabase = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('app.db');
  }
  return db;
};

// Initialize sync queue table
export const initializeSyncQueue = async () => {
  if (Platform.OS === 'web') return;
  
  const db = getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
      data TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
};

// Add change to sync queue
export const addToSyncQueue = async (
  tableName: string,
  recordId: number | string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  data: any
) => {
  if (Platform.OS === 'web') return;
  
  const db = getDatabase();
  await db.runAsync(
    'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)',
    [tableName, recordId.toString(), operation, JSON.stringify(data)]
  );

  // Schedule sync if online and no sync is in progress
  const online = await isOnline();
  if (online && !syncInProgress) {
    // Clear any existing timeout
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    // Schedule new sync with 5 second delay
    syncTimeout = setTimeout(() => {
      processSyncQueue().catch(console.error);
    }, 5000);
  }
};

// Process sync queue
export const processSyncQueue = async () => {
  if (Platform.OS === 'web' || !supabase || syncInProgress) return;
  
  const online = await isOnline();
  if (!online) {
    console.log('No internet connection, skipping sync');
    return;
  }

  if (globalTransaction) {
    console.log('Global transaction in progress, skipping sync');
    return;
  }

  syncInProgress = true;
  const db = getDatabase();

  try {
    const pendingChanges = await db.getAllAsync(
      'SELECT * FROM sync_queue WHERE synced = 0 AND retry_count < 3 ORDER BY created_at ASC'
    );

    for (const change of pendingChanges) {
      try {
        const data = JSON.parse(change.data);
        const { table_name, record_id, operation } = change;

        let success = false;

        // Handle composite key tables differently
        if (table_name === 'user_roles' || table_name === 'user_companies' || table_name === 'form_companies') {
          if (operation === 'INSERT' || operation === 'UPDATE') {
            const { error } = await supabase
              .from(table_name)
              .upsert(data);
            
            if (error) throw error;
            success = true;
          } else if (operation === 'DELETE') {
            // For composite key tables, record_id will be "id1,id2"
            const [id1, id2] = record_id.split(',').map(Number);
            const key1 = table_name === 'user_roles' ? 'user_id' : 'user_id';
            const key2 = table_name === 'user_roles' ? 'role_id' : 'company_id';
            
            const { error } = await supabase
              .from(table_name)
              .delete()
              .eq(key1, id1)
              .eq(key2, id2);
            
            if (error) throw error;
            success = true;
          }
        } else {
          // Handle regular tables with single primary key
          if (operation === 'INSERT' || operation === 'UPDATE') {
            const { error } = await supabase
              .from(table_name)
              .upsert({ ...data, id: parseInt(record_id) });
            
            if (error) throw error;
            success = true;
          } else if (operation === 'DELETE') {
            const { error } = await supabase
              .from(table_name)
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', parseInt(record_id));
            
            if (error) throw error;
            success = true;
          }
        }

        if (success) {
          await db.runAsync(
            'UPDATE sync_queue SET synced = 1, error = NULL WHERE id = ?',
            [change.id]
          );

          // Update last sync time
          await AsyncStorage.setItem(
            `last_sync_${table_name}`,
            new Date().toISOString()
          );
        }
      } catch (error) {
        console.error('Error processing sync item:', error);
        await db.runAsync(
          'UPDATE sync_queue SET retry_count = retry_count + 1, error = ? WHERE id = ?',
          [error.message || 'Unknown error', change.id]
        );
      }
    }

    // Clean up old synced records
    await db.runAsync(
      "DELETE FROM sync_queue WHERE (synced = 1 OR retry_count >= 3) AND created_at < datetime('now', '-7 days')"
    );
  } finally {
    syncInProgress = false;
  }
};

// Download updates from Supabase
export const downloadUpdates = async () => {
  if (Platform.OS === 'web' || !supabase || syncInProgress) return;
  
  const online = await isOnline();
  if (!online) return;

  syncInProgress = true;
  globalTransaction = true;
  const db = getDatabase();

  // Define tables in order of dependencies
  const tables = [
    { name: 'users', clearFirst: true },
    { name: 'companies', clearFirst: true },
    { name: 'roles', clearFirst: true },
    { name: 'user_roles', clearFirst: false },
    { name: 'user_companies', clearFirst: false },
    { name: 'forms', clearFirst: true },
    { name: 'form_fields', clearFirst: false },
    { name: 'form_companies', clearFirst: false },
    { name: 'visits', clearFirst: false },
    { name: 'form_responses', clearFirst: false },
    { name: 'form_field_responses', clearFirst: false }
  ];

  try {
    console.log('Starting global transaction');
    await db.execAsync('BEGIN TRANSACTION');

    // First, fetch all parent tables
    for (const table of tables) {
      try {
        console.log(`Downloading ${table.name}...`);
        const { data, error } = await supabase
          .from(table.name)
          .select('*')
          .is('deleted_at', null);

        if (error) throw error;
        if (!data?.length) continue;

        // Clear the table if needed
        if (table.clearFirst) {
          await db.runAsync(`DELETE FROM ${table.name}`);
        }
        
        for (const record of data) {
          const columns = Object.keys(record).filter(k => record[k] !== null);
          const placeholders = columns.map(() => '?').join(', ');
          const values = columns.map(k => record[k]);

          try {
            await db.runAsync(
              `INSERT OR REPLACE INTO ${table.name} (${columns.join(', ')}) VALUES (${placeholders})`,
              values
            );
          } catch (e) {
            console.log(`Error inserting record in ${table.name}:`, e);
            throw e;
          }
        }

        console.log(`Downloaded ${data.length} records for ${table.name}`);
      } catch (error) {
        console.error(`Error syncing ${table.name}:`, error);
        throw error;
      }
    }

    await db.execAsync('COMMIT');
    console.log('Global transaction committed');

    // Verify local data after sync
    const counts = await Promise.all(tables.map(async table => {
      const result = await db.getAllAsync(`SELECT COUNT(*) as count FROM ${table.name}`);
      return { table: table.name, count: result[0].count };
    }));
    console.log('Local data after sync:', counts);

  } catch (error) {
    try {
      console.log('Rolling back global transaction');
      await db.execAsync('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
    console.error('Error during sync:', error);
    throw error;
  } finally {
    globalTransaction = false;
    syncInProgress = false;
  }
};

// Initialize sync system
export const initializeSync = async () => {
  if (Platform.OS === 'web') return;

  try {
    const hasInitialSync = await AsyncStorage.getItem('initialSyncComplete');
    if (hasInitialSync) {
      console.log('Initial sync already completed, skipping...');
      return;
    }

    console.log('Initializing sync system...');
    // Initialize sync queue first
    await initializeSyncQueue();

    // Clear any existing sync timestamps to force a full sync
    const tables = [
      'users',
      'companies',
      'roles',
      'user_roles',
      'user_companies',
      'forms',
      'form_fields',
      'form_companies',
      'visits',
      'form_responses',
      'form_field_responses'
    ];

    await AsyncStorage.multiRemove(tables.map(table => `last_sync_${table}`));
    console.log('Cleared sync timestamps');

    // Schedule initial sync with a delay
    setTimeout(async () => {
      try {
        await processSyncQueue();
        await downloadUpdates();
        await AsyncStorage.setItem('initialSyncComplete', 'true');
        console.log('Initial sync completed');
      } catch (error) {
        console.error('Delayed sync error:', error);
      }
    }, 5000); // 5 second delay

  } catch (error) {
    console.error('Sync initialization error:', error);
  }
};

// Cleanup function
export const cleanupSync = () => {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
  syncInProgress = false;
  globalTransaction = false;
  db = null;
};