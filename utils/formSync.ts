import { Platform } from 'react-native';
import { getDatabase } from './database/core';
import { addToSyncQueue } from './sync';
import { supabase, isOnline } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lock mechanism to prevent concurrent sync operations
let isFormSyncInProgress = false;
let formSyncQueue: (() => Promise<void>)[] = [];

const executeNextInQueue = async () => {
  if (formSyncQueue.length > 0) {
    const nextSync = formSyncQueue.shift();
    if (nextSync) {
      await nextSync();
    }
  }
  isFormSyncInProgress = false;
};

// Add sync operation to queue
const queueFormSync = async (syncOperation: () => Promise<void>) => {
  return new Promise<void>((resolve, reject) => {
    const wrappedOperation = async () => {
      try {
        await syncOperation();
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        // Process next item in queue
        executeNextInQueue();
      }
    };

    if (!isFormSyncInProgress) {
      isFormSyncInProgress = true;
      wrappedOperation();
    } else {
      formSyncQueue.push(wrappedOperation);
    }
  });
};

// Download forms and related data
export const downloadForms = async () => {
  if (Platform.OS === 'web' || !supabase) return;

  const syncOperation = async () => {
    const online = await isOnline();
    if (!online) {
      console.log('Skipping form download - offline');
      return;
    }

    const db = getDatabase();
    const lastSync = await AsyncStorage.getItem('last_forms_sync');
    console.log('Last forms sync:', lastSync);

    try {
      // Fetch data first before starting transaction
      console.log('Fetching forms from Supabase...');
      const { data: forms, error: formsError } = await supabase
        .from('forms')
        .select('*')
        .is('deleted_at', null);

      if (formsError) throw formsError;
      console.log('Downloaded forms:', forms?.length || 0);

      console.log('Fetching form fields from Supabase...');
      const { data: fields, error: fieldsError } = await supabase
        .from('form_fields')
        .select('*')
        .is('deleted_at', null);

      if (fieldsError) throw fieldsError;
      console.log('Downloaded form fields:', fields?.length || 0);

      console.log('Fetching form companies from Supabase...');
      const { data: formCompanies, error: companiesError } = await supabase
        .from('form_companies')
        .select('*')
        .is('deleted_at', null);

      if (companiesError) throw companiesError;
      console.log('Downloaded form companies:', formCompanies?.length || 0);

      // Start transaction only after all data is fetched
      await db.execAsync('BEGIN TRANSACTION');

      // Update forms
      for (const form of forms || []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO forms (
            id, name, description, created_at, updated_at, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            form.id,
            form.name,
            form.description,
            form.created_at,
            form.updated_at,
            form.deleted_at
          ]
        );
      }

      // Update form fields
      for (const field of fields || []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO form_fields (
            id, form_id, name, label, type, required, sort_order,
            created_at, updated_at, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            field.id,
            field.form_id,
            field.name,
            field.label,
            field.type,
            field.required ? 1 : 0,
            field.sort_order,
            field.created_at,
            field.updated_at,
            field.deleted_at
          ]
        );
      }

      // Update form companies
      for (const formCompany of formCompanies || []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO form_companies (
            form_id, company_id, created_at, updated_at, deleted_at
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            formCompany.form_id,
            formCompany.company_id,
            formCompany.created_at,
            formCompany.updated_at,
            formCompany.deleted_at
          ]
        );
      }

      await db.execAsync('COMMIT');

      // Update last sync timestamp
      const now = new Date().toISOString();
      await AsyncStorage.setItem('last_forms_sync', now);
      console.log('Forms sync completed at:', now);

      // Verify local data
      const localForms = await db.getAllAsync('SELECT COUNT(*) as count FROM forms');
      const localFields = await db.getAllAsync('SELECT COUNT(*) as count FROM form_fields');
      const localCompanies = await db.getAllAsync('SELECT COUNT(*) as count FROM form_companies');

      console.log('Local data after sync:', {
        forms: localForms[0].count,
        fields: localFields[0].count,
        companies: localCompanies[0].count
      });

    } catch (error) {
      console.error('Error downloading forms:', error);
      try {
        await db.execAsync('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
      throw error;
    }
  };

  return queueFormSync(syncOperation);
};

// Upload form responses
export const uploadFormResponses = async () => {
  if (Platform.OS === 'web' || !supabase) return;

  const syncOperation = async () => {
    const online = await isOnline();
    if (!online) {
      console.log('Skipping form response upload - offline');
      return;
    }

    const db = getDatabase();

    try {
      // Get pending form responses from sync queue
      console.log('Checking for pending form responses...');
      const pendingResponses = await db.getAllAsync(
        `SELECT * FROM sync_queue 
         WHERE table_name IN ('form_responses', 'form_field_responses')
         AND synced = 0 AND retry_count < 3
         ORDER BY created_at ASC`
      );
      console.log('Found pending responses:', pendingResponses.length);

      for (const response of pendingResponses) {
        try {
          const data = JSON.parse(response.data);
          console.log('Processing response:', {
            table: response.table_name,
            operation: response.operation,
            id: response.record_id
          });

          if (response.table_name === 'form_responses') {
            if (response.operation === 'INSERT' || response.operation === 'UPDATE') {
              const { error } = await supabase
                .from('form_responses')
                .upsert({ ...data, id: parseInt(response.record_id) });

              if (error) throw error;
            }
          } else if (response.table_name === 'form_field_responses') {
            if (response.operation === 'INSERT' || response.operation === 'UPDATE') {
              const { error } = await supabase
                .from('form_field_responses')
                .upsert({ ...data, id: parseInt(response.record_id) });

              if (error) throw error;
            }
          }

          // Mark as synced
          await db.runAsync(
            'UPDATE sync_queue SET synced = 1, error = NULL WHERE id = ?',
            [response.id]
          );
          console.log('Response synced successfully');

        } catch (error) {
          console.error('Error processing form response:', error);
          await db.runAsync(
            'UPDATE sync_queue SET retry_count = retry_count + 1, error = ? WHERE id = ?',
            [error.message || 'Unknown error', response.id]
          );
        }
      }

      // Clean up old synced records
      await db.runAsync(
        "DELETE FROM sync_queue WHERE (synced = 1 OR retry_count >= 3) AND created_at < datetime('now', '-7 days')"
      );

      console.log('Form response sync completed');

    } catch (error) {
      console.error('Error uploading form responses:', error);
      throw error;
    }
  };

  return queueFormSync(syncOperation);
};

// Initialize form sync
export const initializeFormSync = async () => {
  if (Platform.OS === 'web') return;

  try {
    console.log('Initializing form sync...');
    // Clear last sync timestamp to force full sync
    await AsyncStorage.removeItem('last_forms_sync');

    // Perform initial sync
    await downloadForms();
    await uploadFormResponses();
    console.log('Form sync initialization complete');
  } catch (error) {
    console.error('Form sync initialization error:', error);
  }
};