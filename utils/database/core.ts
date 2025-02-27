import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('app.db');
  }
  return db;
};

export const closeDatabase = () => {
  if (db) {
    db.closeAsync();
    db = null;
  }
};

// Initialize database
export const initDatabase = async () => {
  if (Platform.OS === 'web') {
    console.log('Web platform detected, skipping database initialization');
    return;
  }

  try {
    const db = getDatabase();
    
    // Enable foreign key support
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Create sync tables first
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Create main tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER,
        role_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );

      CREATE TABLE IF NOT EXISTS user_companies (
        user_id INTEGER,
        company_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, company_id)
      );

      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        company_id INTEGER,
        role_id INTEGER,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER,
        latitude REAL,
        longitude REAL,
        no_gps_signal INTEGER DEFAULT 0,
        end_latitude REAL,
        end_longitude REAL,
        no_gps_signal_end INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS form_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        type TEXT CHECK(type IN ('text', 'number', 'date', 'boolean')) NOT NULL,
        required INTEGER DEFAULT 0,
        sort_order INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (form_id) REFERENCES forms (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS form_companies (
        form_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (form_id) REFERENCES forms (id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        PRIMARY KEY (form_id, company_id)
      );

      CREATE TABLE IF NOT EXISTS form_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        visit_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (form_id) REFERENCES forms (id) ON DELETE CASCADE,
        FOREIGN KEY (visit_id) REFERENCES visits (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS form_field_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_response_id INTEGER NOT NULL,
        field_id INTEGER NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (form_response_id) REFERENCES form_responses (id) ON DELETE CASCADE,
        FOREIGN KEY (field_id) REFERENCES form_fields (id) ON DELETE CASCADE
      );
    `);

    // Create index for active column
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);');

    // Check if we need to insert initial data
    const hasUsers = await db.getAllAsync('SELECT COUNT(*) as count FROM users');
    if (hasUsers[0].count === 0) {
      // Insert default roles
      const userRoleResult = await db.runAsync(
        'INSERT INTO roles (name) VALUES (?)',
        ['usuario']
      );
      const userRoleId = userRoleResult.lastInsertRowId;

      const controllerRoleResult = await db.runAsync(
        'INSERT INTO roles (name) VALUES (?)',
        ['controlador']
      );
      const controllerRoleId = controllerRoleResult.lastInsertRowId;

      // Insert default admin user
      const adminResult = await db.runAsync(
        'INSERT INTO users (username, password, is_admin, active) VALUES (?, ?, ?, ?)',
        ['admin', 'admin123', 1, 1]
      );
      const adminId = adminResult.lastInsertRowId;

      // Insert usuario1 with user role
      const userResult = await db.runAsync(
        'INSERT INTO users (username, password, is_admin, active) VALUES (?, ?, ?, ?)',
        ['usuario1', 'user123', 0, 1]
      );
      const userId = userResult.lastInsertRowId;

      // Assign user role to usuario1
      await db.runAsync(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [userId, userRoleId]
      );

      // Insert controlador1 with controller role
      const controllerResult = await db.runAsync(
        'INSERT INTO users (username, password, is_admin, active) VALUES (?, ?, ?, ?)',
        ['controlador1', 'ctrl123', 0, 1]
      );
      const controllerId = controllerResult.lastInsertRowId;

      // Assign controller role to controlador1
      await db.runAsync(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [controllerId, controllerRoleId]
      );

      // Insert test companies
      const companies = [
        ['AWS', 'Amazon Web Services Cloud Provider'],
        ['Google Cloud', 'Google Cloud Platform Services'],
        ['Azure', 'Microsoft Azure Cloud Services']
      ];

      for (const [name, description] of companies) {
        const companyResult = await db.runAsync(
          'INSERT INTO companies (name, description) VALUES (?, ?)',
          [name, description]
        );
        
        // Associate company with usuario1
        await db.runAsync(
          'INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)',
          [userId, companyResult.lastInsertRowId]
        );
      }
    }

    console.log('Database initialized successfully');

  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};