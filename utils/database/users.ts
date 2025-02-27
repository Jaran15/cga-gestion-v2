import { Platform } from 'react-native';
import { getDatabase } from './core';
import { addToSyncQueue } from '../sync';
import { User, Role, Company } from './types';
import { getRoles } from './roles';
import { getCompanies } from './companies';

// Get all users with their roles and companies
export const getUsers = async (): Promise<User[]> => {
  const db = getDatabase();
  
  try {
    const query = `
      SELECT 
        u.*,
        GROUP_CONCAT(DISTINCT r.id || ',' || r.name) as roles,
        GROUP_CONCAT(DISTINCT c.id || ',' || c.name || ',' || COALESCE(c.description, '')) as companies
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN user_companies uc ON u.id = uc.user_id
      LEFT JOIN companies c ON uc.company_id = c.id
      WHERE u.deleted_at IS NULL
      GROUP BY u.id
      ORDER BY u.username
    `;

    const results = await db.getAllAsync<any>(query);
    
    return results.map(user => ({
      id: user.id,
      username: user.username,
      password: user.password,
      isAdmin: Boolean(user.is_admin),
      active: Boolean(user.active),
      roles: user.roles ? user.roles.split(',').reduce((acc: Role[], curr: string, i: number) => {
        if (i % 2 === 0) {
          acc.push({
            id: parseInt(curr, 10),
            name: user.roles.split(',')[i + 1]
          });
        }
        return acc;
      }, []) : [],
      companies: user.companies ? user.companies.split(',').reduce((acc: Company[], curr: string, i: number) => {
        if (i % 3 === 0) {
          acc.push({
            id: parseInt(curr, 10),
            name: user.companies.split(',')[i + 1],
            description: user.companies.split(',')[i + 2]
          });
        }
        return acc;
      }, []) : []
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

// Get user by username and password
export const getUser = async (username: string, password: string): Promise<User | null> => {
  const db = getDatabase();
  
  try {
    // Get user with roles and companies
    const query = `
      SELECT 
        u.*,
        GROUP_CONCAT(DISTINCT r.id || ',' || r.name) as roles,
        GROUP_CONCAT(DISTINCT c.id || ',' || c.name || ',' || COALESCE(c.description, '')) as companies
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN user_companies uc ON u.id = uc.user_id
      LEFT JOIN companies c ON uc.company_id = c.id
      WHERE u.username = ? AND u.password = ?
      AND u.deleted_at IS NULL
      GROUP BY u.id
    `;

    const results = await db.getAllAsync<any>(query, [username, password]);
    
    if (results.length === 0) {
      return null;
    }

    const user = results[0];

    // If user is admin, assign all roles and companies
    if (user.is_admin) {
      const allRoles = await getRoles();
      const allCompanies = await getCompanies();
      
      return {
        id: user.id,
        username: user.username,
        password: user.password,
        isAdmin: true,
        active: Boolean(user.active),
        roles: allRoles,
        companies: allCompanies
      };
    }
    
    return {
      id: user.id,
      username: user.username,
      password: user.password,
      isAdmin: Boolean(user.is_admin),
      active: Boolean(user.active),
      roles: user.roles ? user.roles.split(',').reduce((acc: Role[], curr: string, i: number) => {
        if (i % 2 === 0) {
          acc.push({
            id: parseInt(curr, 10),
            name: user.roles.split(',')[i + 1]
          });
        }
        return acc;
      }, []) : [],
      companies: user.companies ? user.companies.split(',').reduce((acc: Company[], curr: string, i: number) => {
        if (i % 3 === 0) {
          acc.push({
            id: parseInt(curr, 10),
            name: user.companies.split(',')[i + 1],
            description: user.companies.split(',')[i + 2]
          });
        }
        return acc;
      }, []) : []
    };
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// User management operations
export const createUser = async (
  username: string,
  password: string,
  isAdmin: boolean,
  active: boolean = true
): Promise<number> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    // Create user
    const userResult = await db.runAsync(
      'INSERT INTO users (username, password, is_admin, active) VALUES (?, ?, ?, ?)',
      [username, password, isAdmin ? 1 : 0, active ? 1 : 0]
    );
    const userId = userResult.lastInsertRowId;

    await db.execAsync('COMMIT');

    // Add to sync queue
    await addToSyncQueue('users', userId, 'INSERT', {
      username,
      password,
      is_admin: isAdmin,
      active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return userId;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('Error creating user:', error);
    throw new Error('Failed to create user. Username might already exist.');
  }
};

export const updateUser = async (
  id: number,
  username: string,
  password: string | undefined,
  isAdmin: boolean,
  roleIds: number[],
  companyIds: number[],
  active: boolean = true
): Promise<void> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    // Get current user data for sync
    const currentUser = await db.getAllAsync(
      'SELECT username, password, is_admin, active FROM users WHERE id = ?',
      [id]
    );

    // Update user
    if (password) {
      await db.runAsync(
        'UPDATE users SET username = ?, password = ?, is_admin = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [username, password, isAdmin ? 1 : 0, active ? 1 : 0, id]
      );
    } else {
      await db.runAsync(
        'UPDATE users SET username = ?, is_admin = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [username, isAdmin ? 1 : 0, active ? 1 : 0, id]
      );
    }

    // Get current roles and companies for comparison
    const currentRoles = await db.getAllAsync(
      'SELECT role_id FROM user_roles WHERE user_id = ?',
      [id]
    );
    const currentRoleIds = currentRoles.map(r => r.role_id);

    const currentCompanies = await db.getAllAsync(
      'SELECT company_id FROM user_companies WHERE user_id = ?',
      [id]
    );
    const currentCompanyIds = currentCompanies.map(c => c.company_id);

    // Update roles
    await db.runAsync('DELETE FROM user_roles WHERE user_id = ?', [id]);
    for (const roleId of roleIds) {
      await db.runAsync(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [id, roleId]
      );

      // Add to sync queue if this is a new role assignment
      if (!currentRoleIds.includes(roleId)) {
        const recordId = `${id},${roleId}`;
        await addToSyncQueue('user_roles', recordId, 'INSERT', {
          user_id: id,
          role_id: roleId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    // Update companies
    await db.runAsync('DELETE FROM user_companies WHERE user_id = ?', [id]);
    for (const companyId of companyIds) {
      await db.runAsync(
        'INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)',
        [id, companyId]
      );

      // Add to sync queue if this is a new company assignment
      if (!currentCompanyIds.includes(companyId)) {
        const recordId = `${id},${companyId}`;
        await addToSyncQueue('user_companies', recordId, 'INSERT', {
          user_id: id,
          company_id: companyId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    await db.execAsync('COMMIT');

    // Add user update to sync queue if needed
    const syncData: any = {
      updated_at: new Date().toISOString()
    };

    if (username !== currentUser[0].username) {
      syncData.username = username;
    }
    if (password) {
      syncData.password = password;
    }
    if (isAdmin !== Boolean(currentUser[0].is_admin)) {
      syncData.is_admin = isAdmin;
    }
    if (active !== Boolean(currentUser[0].active)) {
      syncData.active = active;
    }

    // Only sync if there are actual changes
    if (Object.keys(syncData).length > 1) { // > 1 because updated_at is always included
      await addToSyncQueue('users', id, 'UPDATE', syncData);
    }

    // Handle removed roles
    for (const oldRoleId of currentRoleIds) {
      if (!roleIds.includes(oldRoleId)) {
        const recordId = `${id},${oldRoleId}`;
        await addToSyncQueue('user_roles', recordId, 'DELETE', {
          deleted_at: new Date().toISOString()
        });
      }
    }

    // Handle removed companies
    for (const oldCompanyId of currentCompanyIds) {
      if (!companyIds.includes(oldCompanyId)) {
        const recordId = `${id},${oldCompanyId}`;
        await addToSyncQueue('user_companies', recordId, 'DELETE', {
          deleted_at: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const deleteUser = async (id: number): Promise<void> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    // Check if user has any associated visits or form responses
    const hasVisits = await db.getAllAsync(
      'SELECT COUNT(*) as count FROM visits WHERE user_id = ? AND deleted_at IS NULL',
      [id]
    );
    
    const hasFormResponses = await db.getAllAsync(
      'SELECT COUNT(*) as count FROM form_responses WHERE user_id = ? AND deleted_at IS NULL',
      [id]
    );

    if (hasVisits[0].count > 0 || hasFormResponses[0].count > 0) {
      throw new Error('Cannot delete user with associated visits or form responses. Consider deactivating the user instead.');
    }

    // Delete user's role assignments
    await db.runAsync('DELETE FROM user_roles WHERE user_id = ?', [id]);
    
    // Delete user's company assignments
    await db.runAsync('DELETE FROM user_companies WHERE user_id = ?', [id]);
    
    // Soft delete the user
    await db.runAsync(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP, active = 0 WHERE id = ?',
      [id]
    );

    await db.execAsync('COMMIT');

    // Add to sync queue
    await addToSyncQueue('users', id, 'DELETE', {
      deleted_at: new Date().toISOString(),
      active: false
    });
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const assignUserRole = async (userId: number, roleId: number): Promise<void> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    await db.runAsync(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, roleId]
    );

    await db.execAsync('COMMIT');

    const recordId = `${userId},${roleId}`;
    await addToSyncQueue('user_roles', recordId, 'INSERT', {
      user_id: userId,
      role_id: roleId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('Error assigning user role:', error);
    throw error;
  }
};

export const assignUserCompany = async (userId: number, companyId: number): Promise<void> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    await db.runAsync(
      'INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)',
      [userId, companyId]
    );

    await db.execAsync('COMMIT');

    const recordId = `${userId},${companyId}`;
    await addToSyncQueue('user_companies', recordId, 'INSERT', {
      user_id: userId,
      company_id: companyId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('Error assigning user company:', error);
    throw error;
  }
};