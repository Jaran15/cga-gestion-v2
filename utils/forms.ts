import { Platform } from 'react-native';
import { getDatabase } from './database';
import { addToSyncQueue } from './sync';

export interface FormField {
  id: number;
  form_id: number;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date';
  required: boolean;
  sort_order: number;
}

export interface Form {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  fields?: FormField[];
}

export interface FormCompany {
  form_id: number;
  company_id: number;
}

export interface FormResponse {
  id: number;
  form_id: number;
  visit_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface FormFieldResponse {
  id: number;
  form_response_id: number;
  field_id: number;
  value: string;
}

// Form operations
export const createForm = async (
  name: string,
  description: string,
  fields: Omit<FormField, 'id' | 'form_id'>[],
  companyIds: number[]
): Promise<number> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    // Create form
    const formResult = await db.runAsync(
      'INSERT INTO forms (name, description) VALUES (?, ?)',
      [name, description]
    );
    const formId = formResult.lastInsertRowId;

    // Add fields
    for (const field of fields) {
      await db.runAsync(
        'INSERT INTO form_fields (form_id, name, label, type, required, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [formId, field.name, field.label, field.type, field.required ? 1 : 0, field.sort_order]
      );
    }

    // Associate with companies
    for (const companyId of companyIds) {
      await db.runAsync(
        'INSERT INTO form_companies (form_id, company_id) VALUES (?, ?)',
        [formId, companyId]
      );
    }

    await db.execAsync('COMMIT');

    // Add to sync queue
    if (Platform.OS !== 'web') {
      await addToSyncQueue('forms', formId, 'INSERT', {
        name,
        description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return formId;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const getForms = async (userId: number | null = null): Promise<Form[]> => {
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
  `;

  const params: any[] = [];

  if (userId) {
    // For non-admin users, join with form_companies and user_companies
    query += `
      INNER JOIN form_companies fc ON f.id = fc.form_id
      INNER JOIN user_companies uc ON fc.company_id = uc.company_id
      WHERE uc.user_id = ? AND f.deleted_at IS NULL
    `;
    params.push(userId);
  } else {
    query += ' WHERE f.deleted_at IS NULL';
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
          type: form.fields.split(',')[index + 3] as 'text' | 'number' | 'date',
          required: form.fields.split(',')[index + 4] === '1',
          sort_order: parseInt(form.fields.split(',')[index + 5], 10)
        });
      }
      return acc;
    }, []) : []
  }));
};

export const getFormById = async (formId: number): Promise<Form | null> => {
  const forms = await getForms();
  return forms.find(f => f.id === formId) || null;
};

export const createFormResponse = async (
  form_id: number,
  visit_id: number,
  user_id: number,
  fieldResponses: { field_id: number; value: string; }[]
): Promise<number> => {
  const db = getDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');

    // Create form response
    const responseResult = await db.runAsync(
      'INSERT INTO form_responses (form_id, visit_id, user_id) VALUES (?, ?, ?)',
      [form_id, visit_id, user_id]
    );
    const responseId = responseResult.lastInsertRowId;

    // Add field responses
    for (const response of fieldResponses) {
      await db.runAsync(
        'INSERT INTO form_field_responses (form_response_id, field_id, value) VALUES (?, ?, ?)',
        [responseId, response.field_id, response.value]
      );
    }

    await db.execAsync('COMMIT');

    // Add to sync queue
    if (Platform.OS !== 'web') {
      await addToSyncQueue('form_responses', responseId, 'INSERT', {
        form_id,
        visit_id,
        user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return responseId;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const getFormResponses = async (
  form_id: number | null = null,
  visit_id: number | null = null,
  user_id: number | null = null
): Promise<{
  id: number;
  form_id: number;
  formName: string;
  visit_id: number;
  user_id: number;
  username: string;
  created_at: string;
  updated_at: string;
  responses: { field_id: number; fieldLabel: string; value: string; }[];
}[]> => {
  const db = getDatabase();
  
  let query = `
    SELECT 
      fr.*,
      f.name as formName,
      u.username,
      GROUP_CONCAT(
        ffr.field_id || ',' ||
        ff.label || ',' ||
        ffr.value
      ) as responses
    FROM form_responses fr
    INNER JOIN forms f ON fr.form_id = f.id
    INNER JOIN users u ON fr.user_id = u.id
    INNER JOIN form_field_responses ffr ON fr.id = ffr.form_response_id
    INNER JOIN form_fields ff ON ffr.field_id = ff.id
    WHERE fr.deleted_at IS NULL
  `;

  const params: any[] = [];

  if (form_id) {
    query += ' AND fr.form_id = ?';
    params.push(form_id);
  }

  if (visit_id) {
    query += ' AND fr.visit_id = ?';
    params.push(visit_id);
  }

  if (user_id) {
    query += ' AND fr.user_id = ?';
    params.push(user_id);
  }

  query += ' GROUP BY fr.id ORDER BY fr.created_at DESC';

  const results = await db.getAllAsync(query, params);

  return results.map(response => ({
    id: response.id,
    form_id: response.form_id,
    formName: response.formName,
    visit_id: response.visit_id,
    user_id: response.user_id,
    username: response.username,
    created_at: response.created_at,
    updated_at: response.updated_at,
    responses: response.responses ? response.responses.split(',').reduce((acc: any[], curr: string, index: number) => {
      if (index % 3 === 0) {
        acc.push({
          field_id: parseInt(curr, 10),
          fieldLabel: response.responses.split(',')[index + 1],
          value: response.responses.split(',')[index + 2]
        });
      }
      return acc;
    }, []) : []
  }));
};