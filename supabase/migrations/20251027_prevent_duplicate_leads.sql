-- Prevent duplicate leads based on first_name + last_name + email
-- Case-insensitive comparison to handle "John" vs "john"

-- Step 1: Create a unique index to prevent duplicates
-- NULL emails are allowed (multiple leads with same name but no email)
-- Only enforces uniqueness when email is NOT NULL
CREATE UNIQUE INDEX idx_leads_unique_name_email 
ON public.leads (LOWER(first_name), LOWER(last_name), LOWER(email))
WHERE email IS NOT NULL AND email != '';

-- Step 2: Add comment explaining the constraint
COMMENT ON INDEX idx_leads_unique_name_email IS 
'Prevents duplicate leads with same first name, last name, and email (case-insensitive). 
Allows multiple leads with same name if email is NULL or empty string.';

