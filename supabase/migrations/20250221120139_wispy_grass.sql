/*
  # Add boolean type to form fields

  1. Changes
    - Update form_fields table type CHECK constraint to include 'boolean'
    - Add validation for boolean values

  2. Notes
    - This is a non-destructive change that maintains existing data
    - Adds support for boolean fields in forms
*/

-- Update the type CHECK constraint in form_fields table
ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS form_fields_type_check;
ALTER TABLE form_fields ADD CONSTRAINT form_fields_type_check 
  CHECK (type IN ('text', 'number', 'date', 'boolean'));

-- Add validation function for boolean values
CREATE OR REPLACE FUNCTION validate_boolean_field_value()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.value IS NOT NULL AND 
     EXISTS (
       SELECT 1 
       FROM form_fields ff 
       WHERE ff.id = NEW.field_id 
       AND ff.type = 'boolean'
     ) THEN
    -- Ensure boolean values are either 'true' or 'false'
    IF NEW.value NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Boolean field values must be either ''true'' or ''false''';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for boolean field validation
DROP TRIGGER IF EXISTS validate_boolean_field_value_trigger ON form_field_responses;
CREATE TRIGGER validate_boolean_field_value_trigger
  BEFORE INSERT OR UPDATE ON form_field_responses
  FOR EACH ROW
  EXECUTE FUNCTION validate_boolean_field_value();