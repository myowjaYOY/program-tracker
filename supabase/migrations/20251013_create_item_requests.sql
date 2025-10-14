-- Create item_requests table
CREATE TABLE item_requests (
  item_request_id SERIAL PRIMARY KEY,
  
  -- Request details
  lead_id INTEGER REFERENCES leads(lead_id),
  item_description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  notes TEXT,
  
  -- Workflow tracking: Requested stage
  requested_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Workflow tracking: Ordered stage
  ordered_date TIMESTAMPTZ,
  ordered_by UUID REFERENCES auth.users(id),
  
  -- Workflow tracking: Received stage
  received_date TIMESTAMPTZ,
  received_by UUID REFERENCES auth.users(id),
  
  -- Cancellation tracking
  is_cancelled BOOLEAN DEFAULT FALSE NOT NULL,
  cancelled_date TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  
  -- Constraints
  CONSTRAINT ordered_requires_dates CHECK (
    (ordered_date IS NULL AND ordered_by IS NULL) OR
    (ordered_date IS NOT NULL AND ordered_by IS NOT NULL)
  ),
  CONSTRAINT received_requires_dates CHECK (
    (received_date IS NULL AND received_by IS NULL) OR
    (received_date IS NOT NULL AND received_by IS NOT NULL)
  ),
  CONSTRAINT cancelled_requires_dates CHECK (
    (NOT is_cancelled) OR
    (is_cancelled AND cancelled_date IS NOT NULL AND cancelled_by IS NOT NULL)
  ),
  CONSTRAINT received_after_ordered CHECK (
    received_date IS NULL OR ordered_date IS NOT NULL
  )
);

-- Indexes for performance
CREATE INDEX idx_item_requests_requested_by ON item_requests(requested_by);
CREATE INDEX idx_item_requests_lead_id ON item_requests(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_item_requests_requested_date ON item_requests(requested_date DESC);
CREATE INDEX idx_item_requests_is_cancelled ON item_requests(is_cancelled) WHERE is_cancelled = TRUE;
CREATE INDEX idx_item_requests_status_lookup ON item_requests(is_cancelled, received_date, ordered_date);

-- View for derived status
CREATE VIEW item_requests_with_status AS
SELECT 
  ir.*,
  CASE 
    WHEN ir.is_cancelled = TRUE THEN 'Cancelled'
    WHEN ir.received_date IS NOT NULL THEN 'Received'
    WHEN ir.ordered_date IS NOT NULL THEN 'Ordered'
    ELSE 'Pending'
  END AS status,
  CASE 
    WHEN ir.is_cancelled = TRUE THEN 4
    WHEN ir.received_date IS NOT NULL THEN 3
    WHEN ir.ordered_date IS NOT NULL THEN 2
    ELSE 1
  END AS status_order,
  -- User names (requested by)
  req_user.email AS requested_by_email,
  req_user.raw_user_meta_data->>'full_name' AS requested_by_name,
  -- User names (ordered by)
  ord_user.email AS ordered_by_email,
  ord_user.raw_user_meta_data->>'full_name' AS ordered_by_name,
  -- User names (received by)
  rec_user.email AS received_by_email,
  rec_user.raw_user_meta_data->>'full_name' AS received_by_name,
  -- User names (cancelled by)
  can_user.email AS cancelled_by_email,
  can_user.raw_user_meta_data->>'full_name' AS cancelled_by_name,
  -- Member/Lead info
  leads.first_name AS lead_first_name,
  leads.last_name AS lead_last_name,
  CONCAT(leads.first_name, ' ', leads.last_name) AS member_name
FROM item_requests ir
LEFT JOIN auth.users req_user ON ir.requested_by = req_user.id
LEFT JOIN auth.users ord_user ON ir.ordered_by = ord_user.id
LEFT JOIN auth.users rec_user ON ir.received_by = rec_user.id
LEFT JOIN auth.users can_user ON ir.cancelled_by = can_user.id
LEFT JOIN leads ON ir.lead_id = leads.lead_id;

-- Add comment
COMMENT ON TABLE item_requests IS 'Tracks item requests (supplements, supplies, equipment) with workflow stages: requested → ordered → received';
COMMENT ON VIEW item_requests_with_status IS 'Item requests with derived status and enriched user/member names for easy querying';



