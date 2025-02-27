import { Platform } from 'react-native';
import { getDatabase } from './core';
import { addToSyncQueue } from '../sync';
import { Visit, VisitReport } from './types';

// Get active visit
export const getActiveVisit = async (userId: number): Promise<Visit | null> => {
  const db = getDatabase();
  const result = await db.getAllAsync<Visit & { company_name?: string }>(
    `SELECT v.*, c.name as company_name 
     FROM visits v 
     LEFT JOIN companies c ON v.company_id = c.id 
     WHERE v.user_id = ? AND v.end_time IS NULL AND v.deleted_at IS NULL`,
    [userId]
  );
  return result[0] || null;
};

// Get visit reports
export const getVisitReports = async (
  companyId: number | null,
  startDate: string,
  endDate: string,
  userId: number | null = null
): Promise<VisitReport[]> => {
  const db = getDatabase();
  const params: any[] = [startDate, endDate];
  let filters = '';
  
  if (companyId) {
    filters += ' AND v.company_id = ?';
    params.push(companyId);
  }

  if (userId) {
    filters += ' AND v.user_id = ?';
    params.push(userId);
  }

  const query = `
    WITH VisitDetails AS (
      SELECT 
        v.id as visit_id,
        v.user_id,
        u.username,
        v.company_id,
        c.name as company_name,
        v.start_time,
        v.end_time,
        CAST(ROUND((julianday(v.end_time) - julianday(v.start_time)) * 24 * 60 * 60) AS INTEGER) as duration,
        v.latitude as start_latitude,
        v.longitude as start_longitude,
        v.no_gps_signal as no_gps_signal_start,
        v.end_latitude,
        v.end_longitude,
        v.no_gps_signal_end
      FROM visits v
      JOIN users u ON v.user_id = u.id
      JOIN companies c ON v.company_id = c.id
      WHERE 
        v.start_time >= ? 
        AND v.start_time <= ?
        ${filters}
        AND v.end_time IS NOT NULL
        AND v.deleted_at IS NULL
    )
    SELECT 
      user_id,
      username,
      company_id,
      company_name,
      SUM(duration) as total_duration,
      GROUP_CONCAT(
        visit_id || ',' ||
        start_time || ',' || 
        end_time || ',' || 
        duration || ',' || 
        COALESCE(start_latitude, 'null') || ',' || 
        COALESCE(start_longitude, 'null') || ',' || 
        no_gps_signal_start || ',' ||
        COALESCE(end_latitude, 'null') || ',' || 
        COALESCE(end_longitude, 'null') || ',' || 
        no_gps_signal_end
      ) as visit_details
    FROM VisitDetails
    GROUP BY user_id, company_id
    ORDER BY username, company_name
  `;

  const results = await db.getAllAsync(query, params);
  
  return results.map(row => ({
    user_id: row.user_id,
    username: row.username,
    company_id: row.company_id,
    company_name: row.company_name,
    total_duration: parseInt(row.total_duration, 10) || 0,
    visits: row.visit_details.split(',').reduce((acc: any[], curr: string, i: number) => {
      if (i % 10 === 0) {
        acc.push({
          id: parseInt(curr, 10),
          start_time: row.visit_details.split(',')[i + 1],
          end_time: row.visit_details.split(',')[i + 2],
          duration: parseInt(row.visit_details.split(',')[i + 3], 10) || 0,
          start_latitude: row.visit_details.split(',')[i + 4] === 'null' ? null : parseFloat(row.visit_details.split(',')[i + 4]),
          start_longitude: row.visit_details.split(',')[i + 5] === 'null' ? null : parseFloat(row.visit_details.split(',')[i + 5]),
          no_gps_signal_start: row.visit_details.split(',')[i + 6] === '1',
          end_latitude: row.visit_details.split(',')[i + 7] === 'null' ? null : parseFloat(row.visit_details.split(',')[i + 7]),
          end_longitude: row.visit_details.split(',')[i + 8] === 'null' ? null : parseFloat(row.visit_details.split(',')[i + 8]),
          no_gps_signal_end: row.visit_details.split(',')[i + 9] === '1'
        });
      }
      return acc;
    }, [])
  }));
};

// Visit management
export const startVisit = async (
  userId: number,
  companyId: number,
  roleId: number,
  latitude: number | null,
  longitude: number | null,
  noGpsSignal: boolean
): Promise<number> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    const result = await db.runAsync(
      'INSERT INTO visits (user_id, company_id, role_id, start_time, latitude, longitude, no_gps_signal) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)',
      [userId, companyId, roleId, latitude, longitude, noGpsSignal ? 1 : 0]
    );
    const visitId = result.lastInsertRowId;

    await db.execAsync('COMMIT');

    await addToSyncQueue('visits', visitId, 'INSERT', {
      user_id: userId,
      company_id: companyId,
      role_id: roleId,
      start_time: new Date().toISOString(),
      latitude,
      longitude,
      no_gps_signal: noGpsSignal,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return visitId;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const endVisit = async (
  visitId: number,
  endLatitude: number | null,
  endLongitude: number | null,
  noGpsSignalEnd: boolean
): Promise<void> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    // Get visit start time
    const visit = await db.getAllAsync<Visit>(
      'SELECT start_time FROM visits WHERE id = ?',
      [visitId]
    );

    if (!visit.length) {
      throw new Error('Visit not found');
    }

    const startTime = new Date(visit[0].start_time);
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000); // Duration in seconds

    await db.runAsync(
      `UPDATE visits SET
        end_time = CURRENT_TIMESTAMP,
        duration = ?,
        end_latitude = ?,
        end_longitude = ?,
        no_gps_signal_end = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [duration, endLatitude, endLongitude, noGpsSignalEnd ? 1 : 0, visitId]
    );

    await db.execAsync('COMMIT');

    await addToSyncQueue('visits', visitId, 'UPDATE', {
      end_time: endTime.toISOString(),
      duration,
      end_latitude: endLatitude,
      end_longitude: endLongitude,
      no_gps_signal_end: noGpsSignalEnd,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};