import { Platform } from 'react-native';
import { getDatabase } from './core';
import { addToSyncQueue } from '../sync';
import { Role } from './types';

// Get all roles
export const getRoles = async (): Promise<Role[]> => {
  const db = getDatabase();
  return await db.getAllAsync<Role>(
    'SELECT * FROM roles WHERE deleted_at IS NULL ORDER BY name'
  );
};

// Role management
export const createRole = async (name: string): Promise<number> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    const result = await db.runAsync(
      'INSERT INTO roles (name) VALUES (?)',
      [name]
    );
    const roleId = result.lastInsertRowId;

    await db.execAsync('COMMIT');

    // Add to sync queue
    if (Platform.OS !== 'web') {
      await addToSyncQueue('roles', roleId, 'INSERT', {
        name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return roleId;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const updateRole = async (id: number, name: string): Promise<void> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    await db.runAsync(
      'UPDATE roles SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, id]
    );

    await db.execAsync('COMMIT');

    // Add to sync queue
    if (Platform.OS !== 'web') {
      await addToSyncQueue('roles', id, 'UPDATE', {
        name,
        updated_at: new Date().toISOString()
      });
    }
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const deleteRole = async (id: number): Promise<void> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    await db.runAsync(
      'UPDATE roles SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    await db.execAsync('COMMIT');

    // Add to sync queue
    if (Platform.OS !== 'web') {
      await addToSyncQueue('roles', id, 'DELETE', {
        deleted_at: new Date().toISOString()
      });
    }
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};