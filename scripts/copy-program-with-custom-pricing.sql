-- =====================================================
-- COPY PROGRAM WITH CUSTOM PRICING - REUSABLE SCRIPT
-- =====================================================
-- This script copies a source program to multiple leads with custom pricing and margins
-- 
-- INSTRUCTIONS:
-- 1. Update the source_member_name in the CTE below
-- 2. Update the target_leads data with your list
-- 3. Run the entire script
-- =====================================================

WITH 
-- Define source program (person to copy FROM)
source_program AS (
  SELECT 
    mp.member_program_id,
    mp.lead_id,
    mp.program_template_name,
    mp.program_status_id,
    mp.description,
    mp.active_flag
  FROM member_programs mp
  JOIN leads l ON mp.lead_id = l.lead_id
  WHERE l.first_name = 'Rick' AND l.last_name = 'Myers'
  ORDER BY mp.created_at DESC
  LIMIT 1
),

-- Define source item
source_item AS (
  SELECT 
    mpi.*
  FROM member_program_items mpi
  WHERE mpi.member_program_id = (SELECT member_program_id FROM source_program)
  LIMIT 1
),

-- Define source finances
source_finances AS (
  SELECT 
    mpf.*
  FROM member_program_finances mpf
  WHERE mpf.member_program_id = (SELECT member_program_id FROM source_program)
  LIMIT 1
),

-- Define target leads and their custom pricing
-- FORMAT: (last_name, first_name, margin_percentage, start_date, program_price)
target_leads_input (last_name, first_name, margin_pct, start_date, program_price) AS (
  VALUES
    ('Enriquez', 'Cynthia', 55, '2024-11-21'::date, 14230.85),
    ('Hanus', 'Donna', 63, '2024-09-30'::date, 16049.22),
    ('Hendrickson', 'Maddison', 67, '2024-11-22'::date, 19612.59),
    ('Hertlein', 'Susan', 47, '2024-09-25'::date, 12971.27),
    ('Phillips-Rolle', 'Kim', 67, '2024-11-08'::date, 19660.17),
    ('Reyhons', 'Andrea', 61, '2024-11-13'::date, 15779.19)
),

-- Match target leads with their lead_ids
target_leads AS (
  SELECT 
    l.lead_id,
    tli.last_name,
    tli.first_name,
    tli.margin_pct,
    tli.start_date,
    ROUND(tli.program_price) AS program_price_rounded,
    -- Calculate finance charges needed to achieve target margin
    -- Margin = (Price - Cost) / Price
    -- Cost = Finance Charges (negative = cost)
    -- Therefore: Finance Charges = -(Price * (1 - Margin/100))
    -ROUND(tli.program_price * (1 - tli.margin_pct / 100.0), 2) AS finance_charges
  FROM target_leads_input tli
  JOIN leads l ON l.last_name = tli.last_name AND l.first_name = tli.first_name
),

-- Get payment method ID for "Other"
payment_method_other AS (
  SELECT payment_method_id
  FROM payment_methods
  WHERE payment_method_name ILIKE 'Other'
  LIMIT 1
),

-- Get payment status ID for "Paid"
payment_status_paid AS (
  SELECT payment_status_id
  FROM payment_status
  WHERE payment_status_name ILIKE 'Paid'
  LIMIT 1
),

-- Get program status ID for "Completed"
program_status_completed AS (
  SELECT program_status_id
  FROM program_status
  WHERE status_name ILIKE 'Completed'
  LIMIT 1
),

-- Insert new programs
new_programs AS (
  INSERT INTO member_programs (
    lead_id,
    program_template_name,
    program_status_id,
    start_date,
    description,
    active_flag,
    total_charge,
    total_cost
  )
  SELECT 
    tl.lead_id,
    sp.program_template_name,
    psc.program_status_id,  -- Use "Completed" status
    tl.start_date,
    sp.description,
    sp.active_flag,
    tl.program_price_rounded,
    -tl.finance_charges  -- Cost equals absolute value of finance charges
  FROM target_leads tl
  CROSS JOIN source_program sp
  CROSS JOIN program_status_completed psc
  RETURNING 
    member_program_id,
    lead_id,
    total_charge AS program_price,
    total_cost
),

-- Calculate quantity needed for each program
-- quantity = program_price / item_charge
program_quantities AS (
  SELECT 
    np.member_program_id,
    np.lead_id,
    np.program_price,
    np.total_cost,
    si.therapy_id,
    si.item_charge,
    CASE 
      WHEN si.item_charge > 0 
      THEN ROUND(np.program_price / si.item_charge)
      ELSE 1
    END AS quantity
  FROM new_programs np
  CROSS JOIN source_item si
),

-- Insert program items
new_items AS (
  INSERT INTO member_program_items (
    member_program_id,
    therapy_id,
    quantity,
    item_cost,
    item_charge
  )
  SELECT 
    pq.member_program_id,
    pq.therapy_id,
    pq.quantity,
    0,  -- Item cost is always 0
    pq.item_charge
  FROM program_quantities pq
  RETURNING member_program_id
),

-- Insert finances with calculated finance charges, program price, and margin
new_finances AS (
  INSERT INTO member_program_finances (
    member_program_id,
    financing_type_id,
    finance_charges,
    discounts,
    taxes,
    final_total_price,
    margin
  )
  SELECT 
    np.member_program_id,
    sf.financing_type_id,
    tl.finance_charges,  -- Negative value to add cost
    COALESCE(sf.discounts, 0),
    COALESCE(sf.taxes, 0),
    -- Program price is simply the total charge (negative finance charges don't add to price)
    np.total_charge AS final_total_price,
    -- Calculate margin: ((total_charge - total_cost) / total_charge) * 100
    CASE 
      WHEN np.total_charge > 0
      THEN ((np.total_charge - np.total_cost) / np.total_charge) * 100
      ELSE 0
    END AS margin
  FROM new_programs np
  JOIN target_leads tl ON np.lead_id = tl.lead_id
  CROSS JOIN source_finances sf
  RETURNING member_program_id
),

-- Insert payments (one full payment)
new_payments AS (
  INSERT INTO member_program_payments (
    member_program_id,
    payment_method_id,
    payment_status_id,
    payment_amount,
    payment_due_date,
    payment_date,
    notes
  )
  SELECT 
    np.member_program_id,
    pm.payment_method_id,
    ps.payment_status_id,
    np.program_price,  -- Full amount
    tl.start_date,
    tl.start_date,  -- Marked as paid on start date
    'Full payment - ' || tl.margin_pct || '% margin'
  FROM new_programs np
  JOIN target_leads tl ON np.lead_id = tl.lead_id
  CROSS JOIN payment_method_other pm
  CROSS JOIN payment_status_paid ps
  RETURNING member_program_id, payment_amount
)

-- Final summary
SELECT 
  l.first_name || ' ' || l.last_name AS member_name,
  tl.margin_pct || '%' AS target_margin,
  tl.start_date,
  '$' || tl.program_price_rounded AS program_price,
  '$' || tl.finance_charges AS finance_charges,
  np.member_program_id,
  'Created successfully' AS status
FROM new_programs np
JOIN target_leads tl ON np.lead_id = tl.lead_id
JOIN leads l ON np.lead_id = l.lead_id
ORDER BY l.last_name, l.first_name;

