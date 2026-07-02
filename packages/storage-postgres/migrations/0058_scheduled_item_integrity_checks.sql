ALTER TABLE "space_scheduled_items"
  ADD CONSTRAINT "space_scheduled_items_ends_after_starts_check"
  CHECK ("ends_at" >= "starts_at");

ALTER TABLE "space_scheduled_items"
  ADD CONSTRAINT "space_scheduled_items_reminder_minutes_check"
  CHECK (
    "reminder_minutes_before" IS NULL
    OR "reminder_minutes_before" IN (5, 15, 30, 60, 120, 1440, 10080)
  );
