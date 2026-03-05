-- Add script_completed_flag to vw_coordinator_task_schedule so the To-Do tab
-- can show when a task's parent script item is redeemed/missed but the task
-- status doesn't match (mismatch indicator).

CREATE OR REPLACE VIEW vw_coordinator_task_schedule AS
SELECT
  ts.member_program_item_task_schedule_id,
  ts.member_program_item_schedule_id,
  ts.member_program_item_task_id,
  s.member_program_item_id,
  s.instance_number,
  i.member_program_id,
  p.lead_id,
  ts.due_date,
  ts.completed_flag,
  ts.created_at,
  ts.created_by,
  ts.updated_at,
  ts.updated_by,
  ts.program_role_id,
  t.task_id,
  t.task_name,
  t.description AS task_description,
  t.task_delay,
  tt.therapy_id,
  th.therapy_name,
  tht.therapy_type_id,
  tht.therapy_type_name,
  pr.role_name,
  pr.display_color AS role_display_color,
  p.program_template_name,
  p.program_status_id,
  ps.status_name AS program_status_name,
  p.start_date AS program_start_date,
  p.active_flag AS program_active_flag,
  l.first_name AS member_first_name,
  l.last_name AS member_last_name,
  (l.first_name || ' '::text) || l.last_name AS member_name,
  s.scheduled_date AS script_scheduled_date,
  s.completed_flag AS script_completed_flag
FROM member_program_items_task_schedule ts
JOIN member_program_item_schedule s ON ts.member_program_item_schedule_id = s.member_program_item_schedule_id
JOIN member_program_items i ON s.member_program_item_id = i.member_program_item_id
JOIN member_programs p ON i.member_program_id = p.member_program_id
LEFT JOIN member_program_item_tasks t ON ts.member_program_item_task_id = t.member_program_item_task_id
LEFT JOIN therapy_tasks tt ON t.task_id = tt.task_id
LEFT JOIN therapies th ON tt.therapy_id = th.therapy_id
LEFT JOIN therapytype tht ON th.therapy_type_id = tht.therapy_type_id
LEFT JOIN program_roles pr ON ts.program_role_id = pr.program_role_id
LEFT JOIN program_status ps ON p.program_status_id = ps.program_status_id
LEFT JOIN leads l ON p.lead_id = l.lead_id;
