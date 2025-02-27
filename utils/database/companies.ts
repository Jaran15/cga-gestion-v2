import { Platform } from 'react-native';
import { getDatabase } from './core';
import { addToSyncQueue } from '../sync';
import { Company } from './types';

// Get all companies
export const getCompanies = async (): Promise<Company[]> => {
  const db = getDatabase();
  return await db.getAllAsync<Company>(
    'SELECT * FROM companies WHERE deleted_at IS NULL ORDER BY name'
  );
};

// Get user companies
export const getUserCompanies = async (userId: number): Promise<Company[]> => {
  const db = getDatabase();
  const results = await db.getAllAsync<Company>(
    `SELECT c.* FROM companies c
     INNER JOIN user_companies uc ON c.id = uc.company_id
     WHERE uc.user_id = ? AND c.deleted_at IS NULL
     ORDER BY c.name`,
    [userId]
  );
  return results;
};

// Company management
export const createCompany = async (name: string, description: string): Promise<number> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    const result = await db.runAsync(
      'INSERT INTO companies (name, description) VALUES (?, ?)',
      [name, description]
    );
    const companyId = result.lastInsertRowId;

    await db.execAsync('COMMIT');

    // Add to sync queue
    if (Platform.OS !== 'web') {
      await addToSyncQueue('companies', companyId, 'INSERT', {
        name,
        description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return companyId;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const updateCompany = async (id: number, name: string, description: string): Promise<void> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    await db.runAsync(
      'UPDATE companies SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, id]
    );

    await db.execAsync('COMMIT');

    // Add to sync queue
    if (Platform.OS !== 'web') {
      await addToSyncQueue('companies', id, 'UPDATE', {
        name,
        description,
        updated_at: new Date().toISOString()
      });
    }
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const deleteCompany = async (id: number): Promise<void> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    await db.runAsync(
      'UPDATE companies SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    await db.execAsync('COMMIT');

    // Add to sync queue
    if (Platform.OS !== 'web') {
      await addToSyncQueue('companies', id, 'DELETE', {
        deleted_at: new Date().toISOString()
      });
    }
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};