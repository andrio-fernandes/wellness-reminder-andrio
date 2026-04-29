-- Prevent duplicate dose logs for the same scheduled slot per medicine/user.
-- This guarantees that notifications/log rows can't be created twice for the
-- same (user_id, medicine_id, scheduled_for), even from concurrent clients.

-- Clean up any pre-existing duplicates, keeping the most informative row:
-- prefer non-pending status, then earliest created_at.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, medicine_id, scheduled_for
      ORDER BY
        CASE WHEN status = 'pending' THEN 1 ELSE 0 END,
        created_at ASC
    ) AS rn
  FROM public.dose_logs
)
DELETE FROM public.dose_logs
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Enforce uniqueness at the database level.
ALTER TABLE public.dose_logs
ADD CONSTRAINT dose_logs_user_medicine_slot_unique
UNIQUE (user_id, medicine_id, scheduled_for);