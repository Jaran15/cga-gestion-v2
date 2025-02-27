import { Platform } from 'react-native';
import { getDatabase } from './core';
import { addToSyncQueue } from '../sync';
import { Form, FormField } from './types';
import { supabase } from '../supabase';

// Create form response
export const createFormResponse = async (params: {
  formId: number;
  visitId: number;
  userId: number;
  responses: { field_id: number; value: string; }[];
}): Promise<number> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    // Create form response
    const responseResult = await db.runAsync(
      'INSERT INTO form_responses (form_id, visit_id, user_id) VALUES (?, ?, ?)',
      [params.formId, params.visitId, params.userId]
    );
    const responseId = responseResult.lastInsertRowId;

    // Add field responses
    for (const response of params.responses) {
      await db.runAsync(
        'INSERT INTO form_field_responses (form_response_id, field_id, value) VALUES (?, ?, ?)',
        [responseId, response.field_id, response.value]
      );
    }

    await db.execAsync('COMMIT');

    // Add to sync queue
    if (Platform.OS !== 'web') {
      // Add form response to sync queue
      await addToSyncQueue('form_responses', responseId, 'INSERT', {
        form_id: params.formId,
        visit_id: params.visitId,
        user_id: params.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Add each field response to sync queue
      for (const response of params.responses) {
        const fieldResponseId = `${responseId}_${response.field_id}`;
        await addToSyncQueue('form_field_responses', fieldResponseId, 'INSERT', {
          form_response_id: responseId,
          field_id: response.field_id,
          value: response.value,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Try to sync immediately if online
      try {
        if (supabase) {
          // Upload form response
          const { error: responseError } = await supabase
            .from('form_responses')
            .insert({
              id: responseId,
              form_id: params.formId,
              visit_id: params.visitId,
              user_id: params.userId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (!responseError) {
            // Upload field responses
            for (const response of params.responses) {
              await supabase
                .from('form_field_responses')
                .insert({
                  form_response_id: responseId,
                  field_id: response.field_id,
                  value: response.value,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
            }

            // Mark as synced in queue
            await db.runAsync(
              'UPDATE sync_queue SET synced = 1 WHERE table_name IN (?, ?) AND record_id LIKE ?',
              ['form_responses', 'form_field_responses', `${responseId}%`]
            );
          }
        }
      } catch (error) {
        console.log('Immediate sync failed, will retry later:', error);
      }
    }

    return responseId;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

// Get form responses
export const getFormResponses = async (
  formId: number | null = null,
  visitId: number | null = null,
  userId: number | null = null
): Promise<{
  id: number;
  formName: string;
  username: string;
  created_at: string;
  responses: {
    fieldLabel: string;
    value: string;
  }[];
}[]> => {
  const db = getDatabase();
  
  try {
    // First, check if the visit exists
    if (visitId) {
      console.log('Checking visit:', visitId);
      const visitExists = await db.getAllAsync(
        'SELECT id FROM visits WHERE id = ? AND deleted_at IS NULL',
        [visitId]
      );
      
      if (visitExists.length === 0) {
        console.log('Visit not found');
        return [];
      }
      console.log('Visit found');
    }

    // Base query to get form responses with proper JOINs
    let query = `
      SELECT 
        fr.id,
        fr.created_at,
        f.name as formName,
        u.username,
        GROUP_CONCAT(
          json_object(
            'fieldLabel', ff.label,
            'value', ffr.value
          )
        ) as responses
      FROM form_responses fr
      INNER JOIN forms f ON fr.form_id = f.id
      INNER JOIN users u ON fr.user_id = u.id
      LEFT JOIN form_field_responses ffr ON fr.id = ffr.form_response_id
      LEFT JOIN form_fields ff ON ffr.field_id = ff.id
      WHERE fr.deleted_at IS NULL
    `;

    const params: any[] = [];

    if (formId) {
      query += ' AND fr.form_id = ?';
      params.push(formId);
    }

    if (visitId) {
      query += ' AND fr.visit_id = ?';
      params.push(visitId);
      console.log('Filtering by visit ID:', visitId);
    }

    if (userId) {
      query += ' AND fr.user_id = ?';
      params.push(userId);
    }

    query += ' GROUP BY fr.id ORDER BY fr.created_at DESC';

    console.log('Executing form responses query:', { query, params });

    const results = await db.getAllAsync(query, params);
    console.log('Form responses query results:', results);

    return results.map(row => ({
      id: row.id,
      formName: row.formName,
      username: row.username,
      created_at: row.created_at,
      responses: row.responses ? JSON.parse(`[${row.responses}]`) : []
    }));
  } catch (error) {
    console.error('Error getting form responses:', error);
    throw error;
  }
};

// Get form by ID
export const getFormById = async (formId: number): Promise<Form | null> => {
  const db = getDatabase();
  
  const query = `
    SELECT 
      f.*,
      GROUP_CONCAT(
        ff.id || ',' ||
        ff.name || ',' ||
        ff.label || ',' ||
        ff.type || ',' ||
        ff.required || ',' ||
        ff.sort_order
      ) as fields
    FROM forms f
    LEFT JOIN form_fields ff ON f.id = ff.form_id
    WHERE f.id = ? AND f.deleted_at IS NULL
    GROUP BY f.id
  `;

  const results = await db.getAllAsync(query, [formId]);
  
  if (results.length === 0) return null;

  const form = results[0];
  return {
    id: form.id,
    name: form.name,
    description: form.description,
    created_at: form.created_at,
    updated_at: form.updated_at,
    fields: form.fields ? form.fields.split(',').reduce((acc: FormField[], curr: string, index: number) => {
      if (index % 6 === 0) {
        acc.push({
          id: parseInt(curr, 10),
          form_id: form.id,
          name: form.fields.split(',')[index + 1],
          label: form.fields.split(',')[index + 2],
          type: form.fields.split(',')[index + 3] as 'text' | 'number' | 'date' | 'boolean',
          required: form.fields.split(',')[index + 4] === '1',
          sort_order: parseInt(form.fields.split(',')[index + 5], 10)
        });
      }
      return acc;
    }, []) : []
  };
};

// Get forms for user/company
export const getForms = async (userId: number | null = null, companyId: number | null = null): Promise<Form[]> => {
  const db = getDatabase();
  
  let query = `
    SELECT DISTINCT
      f.*,
      GROUP_CONCAT(
        ff.id || ',' ||
        ff.name || ',' ||
        ff.label || ',' ||
        ff.type || ',' ||
        ff.required || ',' ||
        ff.sort_order
      ) as fields
    FROM forms f
    LEFT JOIN form_fields ff ON f.id = ff.form_id
    INNER JOIN form_companies fc ON f.id = fc.form_id
    WHERE f.deleted_at IS NULL
  `;

  const params: any[] = [];

  if (companyId) {
    query += ' AND fc.company_id = ?';
    params.push(companyId);
  } else if (userId) {
    // For non-admin users, join with user_companies
    query += `
      AND fc.company_id IN (
        SELECT company_id 
        FROM user_companies 
        WHERE user_id = ?
      )
    `;
    params.push(userId);
  }

  query += ' GROUP BY f.id ORDER BY f.name';

  const results = await db.getAllAsync(query, params);

  return results.map(form => ({
    id: form.id,
    name: form.name,
    description: form.description,
    created_at: form.created_at,
    updated_at: form.updated_at,
    fields: form.fields ? form.fields.split(',').reduce((acc: FormField[], curr: string, index: number) => {
      if (index % 6 === 0) {
        acc.push({
          id: parseInt(curr, 10),
          form_id: form.id,
          name: form.fields.split(',')[index + 1],
          label: form.fields.split(',')[index + 2],
          type: form.fields.split(',')[index + 3] as 'text' | 'number' | 'date' | 'boolean',
          required: form.fields.split(',')[index + 4] === '1',
          sort_order: parseInt(form.fields.split(',')[index + 5], 10)
        });
      }
      return acc;
    }, []) : []
  }));
};