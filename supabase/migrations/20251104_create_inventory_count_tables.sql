-- ============================================================================
-- Migration: Create Inventory Count Tables
-- Date: 2025-11-04
-- Description: Add physical count session tracking and variance management
-- ============================================================================

-- 1. Create inventory_count_sessions table
CREATE TABLE IF NOT EXISTS inventory_count_sessions (
  count_session_id SERIAL PRIMARY KEY,
  session_number VARCHAR(50) UNIQUE NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count_type VARCHAR(20) NOT NULL CHECK (count_type IN ('cycle', 'full', 'custom')),
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  counted_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  items_total INTEGER DEFAULT 0,
  items_counted INTEGER DEFAULT 0,
  items_with_variance INTEGER DEFAULT 0,
  items_pending_approval INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid()
);

-- 2. Create inventory_count_details table
CREATE TABLE IF NOT EXISTS inventory_count_details (
  count_detail_id SERIAL PRIMARY KEY,
  count_session_id INTEGER REFERENCES inventory_count_sessions(count_session_id) ON DELETE CASCADE,
  inventory_item_id INTEGER REFERENCES inventory_items(inventory_item_id),
  expected_quantity INTEGER NOT NULL,
  physical_quantity INTEGER,
  variance INTEGER GENERATED ALWAYS AS (COALESCE(physical_quantity, 0) - expected_quantity) STORED,
  variance_pct NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN expected_quantity = 0 AND COALESCE(physical_quantity, 0) = 0 THEN 0
      WHEN expected_quantity = 0 THEN 100
      ELSE ROUND(ABS((COALESCE(physical_quantity, 0) - expected_quantity)::numeric / expected_quantity) * 100, 2)
    END
  ) STORED,
  notes TEXT,
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'counted', 'approved', 'rejected', 'posted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(count_session_id, inventory_item_id)
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_count_sessions_status ON inventory_count_sessions(status);
CREATE INDEX IF NOT EXISTS idx_count_sessions_date ON inventory_count_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_count_sessions_counted_by ON inventory_count_sessions(counted_by);
CREATE INDEX IF NOT EXISTS idx_count_details_session ON inventory_count_details(count_session_id);
CREATE INDEX IF NOT EXISTS idx_count_details_approval ON inventory_count_details(requires_approval) WHERE requires_approval = TRUE;
CREATE INDEX IF NOT EXISTS idx_count_details_status ON inventory_count_details(status);

-- 4. Update inventory_transactions to support count_session reference
ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_reference_type_check;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_reference_type_check 
  CHECK (reference_type IN ('purchase_order', 'purchase_order_item', 'program_item', 'member_program_item_schedule', 'count_session', 'manual_adjustment', 'return'));

-- 5. Enable RLS on new tables
ALTER TABLE inventory_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_details ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for inventory_count_sessions
CREATE POLICY "authenticated_access_count_sessions" ON inventory_count_sessions
  FOR ALL TO public
  USING (auth.role() = 'authenticated');

CREATE POLICY "service_role_bypass_count_sessions" ON inventory_count_sessions
  FOR ALL TO public
  USING (auth.role() = 'service_role');

-- 7. Create RLS policies for inventory_count_details
CREATE POLICY "authenticated_access_count_details" ON inventory_count_details
  FOR ALL TO public
  USING (auth.role() = 'authenticated');

CREATE POLICY "service_role_bypass_count_details" ON inventory_count_details
  FOR ALL TO public
  USING (auth.role() = 'service_role');

-- 8. Create function to generate session number
CREATE OR REPLACE FUNCTION generate_count_session_number()
RETURNS TEXT AS $$
DECLARE
  session_num TEXT;
  counter INTEGER;
BEGIN
  -- Format: PC-YYYY-MM-DD-###
  SELECT COUNT(*) + 1 INTO counter
  FROM inventory_count_sessions
  WHERE session_date = CURRENT_DATE;
  
  session_num := 'PC-' || TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') || '-' || LPAD(counter::TEXT, 3, '0');
  RETURN session_num;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger to auto-generate session numbers
CREATE OR REPLACE FUNCTION set_count_session_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_number IS NULL OR NEW.session_number = '' THEN
    NEW.session_number := generate_count_session_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_count_session_number
  BEFORE INSERT ON inventory_count_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_count_session_number();

-- 10. Create function to update session stats
CREATE OR REPLACE FUNCTION update_count_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_count_sessions
  SET 
    items_counted = (
      SELECT COUNT(*) 
      FROM inventory_count_details 
      WHERE count_session_id = NEW.count_session_id 
        AND physical_quantity IS NOT NULL
    ),
    items_with_variance = (
      SELECT COUNT(*) 
      FROM inventory_count_details 
      WHERE count_session_id = NEW.count_session_id 
        AND physical_quantity IS NOT NULL
        AND variance != 0
    ),
    items_pending_approval = (
      SELECT COUNT(*) 
      FROM inventory_count_details 
      WHERE count_session_id = NEW.count_session_id 
        AND requires_approval = TRUE
        AND status NOT IN ('approved', 'rejected', 'posted')
    ),
    updated_at = NOW()
  WHERE count_session_id = NEW.count_session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_count_session_stats
  AFTER INSERT OR UPDATE ON inventory_count_details
  FOR EACH ROW
  EXECUTE FUNCTION update_count_session_stats();

-- 11. Create trigger to update timestamps
CREATE TRIGGER update_count_sessions_timestamp
  BEFORE UPDATE ON inventory_count_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_function();

-- Done!

