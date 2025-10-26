# Trigger Dashboard Backfill for All Members

## Current Status
- **Batch 38** is ready (cleaned up above)
- **58 members** need dashboard calculations
- **1,011 survey sessions** exist

## Method: Use cURL or PowerShell

### PowerShell (Windows):
```powershell
$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14a3RsYmhpa25wZGF1em9pdG5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODY2MzUzNSwiZXhwIjoyMDQ0MjM5NTM1fQ.ITRG-TN1yiPXKXpx0Yj8IHqFpDNvVIMpg4V8fX_Yxto"
    "Content-Type" = "application/json"
}

# First, re-assign sessions to batch 38
Invoke-RestMethod -Uri "https://mxktlbhiknpdauzoitnm.supabase.co/rest/v1/rpc/assign_sessions_to_batch" -Method POST -Headers $headers -Body (@{batch_id=38} | ConvertTo-Json)

# Then invoke edge function (this may not work without proper setup)
```

### Better: Upload CSV to Storage
This is the **designed workflow** and will work reliably.

