-- Storage Trigger for Data Imports
-- Single trigger that routes to different Edge Functions based on folder

-- Create trigger function
CREATE OR REPLACE FUNCTION public.handle_data_import_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_role_key text;
  project_url text;
  request_id bigint;
BEGIN
  -- Only process files in data-imports bucket
  IF NEW.bucket_id = 'data-imports' THEN
    
    -- Get environment variables
    service_role_key := current_setting('app.settings.service_role_key', true);
    project_url := current_setting('app.settings.supabase_url', true);
    
    -- If settings not available, use Supabase environment
    IF service_role_key IS NULL THEN
      service_role_key := current_setting('supabase.service_role_key', true);
    END IF;
    
    IF project_url IS NULL THEN
      project_url := current_setting('supabase.api_url', true);
    END IF;
    
    -- Route based on folder and file extension
    
    -- Survey Results: CSV files in survey-results/ folder
    IF NEW.name LIKE 'survey-results/%.csv' THEN
      
      PERFORM net.http_post(
        url := project_url || '/functions/v1/process-survey-import',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'file_path', NEW.name,
          'bucket_name', NEW.bucket_id
        ),
        timeout_milliseconds := 300000 -- 5 minutes
      );
      
      RAISE NOTICE 'Triggered process-survey-import for file: %', NEW.name;
    
    -- Module Progress: XLSX/XLS files in module-progress/ folder
    ELSIF NEW.name LIKE 'module-progress/%.xlsx' OR NEW.name LIKE 'module-progress/%.xls' THEN
      
      PERFORM net.http_post(
        url := project_url || '/functions/v1/process-user-progress-import',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'file_path', NEW.name,
          'bucket_name', NEW.bucket_id
        ),
        timeout_milliseconds := 300000 -- 5 minutes
      );
      
      RAISE NOTICE 'Triggered process-user-progress-import for file: %', NEW.name;
      
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.handle_data_import_trigger() IS 
'Trigger function that routes uploaded files to appropriate Edge Functions based on folder and extension';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_file_upload ON storage.objects;

-- Create trigger on storage.objects
CREATE TRIGGER on_file_upload
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_data_import_trigger();

-- Add comment
COMMENT ON TRIGGER on_file_upload ON storage.objects IS 
'Routes data import files to appropriate processing functions:
- survey-results/*.csv → process-survey-import
- module-progress/*.xlsx|.xls → process-user-progress-import';




