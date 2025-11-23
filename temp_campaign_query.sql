-- Query to get campaign "S. 09/09" data
-- Shows: campaign info, all leads, PME dates, programs, program activation dates

SELECT 
  c.campaign_id,
  c.campaign_name,
  c.campaign_date,
  l.lead_id,
  CONCAT(l.first_name, ' ', l.last_name) as lead_name,
  l.pmedate as pme_date_field,
  s.status_name as current_lead_status,
  mp.member_program_id,
  mp.start_date as program_activation_date,
  mp.created_at as program_created_date,
  ps.status_name as program_status,
  mpf.final_total_price as program_revenue
FROM campaigns c
LEFT JOIN leads l ON l.campaign_id = c.campaign_id
LEFT JOIN status s ON s.status_id = l.status_id
LEFT JOIN member_programs mp ON mp.lead_id = l.lead_id
LEFT JOIN program_status ps ON ps.program_status_id = mp.program_status_id
LEFT JOIN member_program_finances mpf ON mpf.member_program_id = mp.member_program_id
WHERE c.campaign_name LIKE 'S. %09%'
  AND c.campaign_date >= '2024-09-01'
  AND c.campaign_date < '2024-10-01'
ORDER BY l.lead_id, mp.member_program_id;

-- Also get audit events for PME scheduled dates
SELECT 
  ae.record_id as lead_id,
  ae.event_at as pme_scheduled_at,
  aec.old_value as old_status_id,
  aec.new_value as new_status_id
FROM audit_events ae
INNER JOIN audit_event_changes aec ON aec.event_id = ae.event_id
WHERE ae.table_name = 'leads'
  AND aec.column_name = 'status_id'
  AND aec.new_value IN (SELECT status_id::text FROM status WHERE status_name = 'PME Scheduled')
  AND ae.record_id IN (
    SELECT l.lead_id 
    FROM campaigns c
    INNER JOIN leads l ON l.campaign_id = c.campaign_id
    WHERE c.campaign_name LIKE 'S. %09%'
      AND c.campaign_date >= '2024-09-01'
      AND c.campaign_date < '2024-10-01'
  )
ORDER BY ae.event_at;

