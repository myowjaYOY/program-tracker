ALTER TABLE metric_definitions
  ADD COLUMN target_direction text NOT NULL DEFAULT 'higher_is_better'
  CHECK (target_direction IN ('higher_is_better', 'lower_is_better'));

UPDATE metric_definitions SET target_direction = 'lower_is_better' WHERE metric_key = 'dropouts';
