-- Feature 7: subtask partial progress (0–100). is_done는 API에서 progress와 함께 갱신.
ALTER TABLE subtasks
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0
  CHECK (progress >= 0 AND progress <= 100);

UPDATE subtasks SET progress = 100 WHERE is_done = true;
UPDATE subtasks SET progress = 0 WHERE is_done = false;
