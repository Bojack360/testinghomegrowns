-- ============================================================
-- Reservation Status Management — one-time schema setup
-- Run this once in the Supabase SQL editor.
-- ============================================================

-- 1) New columns on the orders (reservations) table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_duration integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_deadline timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_deducted  boolean DEFAULT false;

-- 2) Key/value settings table for the admin-configurable pickup duration
CREATE TABLE IF NOT EXISTS app_settings (
    key   text PRIMARY KEY,
    value text
);

INSERT INTO app_settings (key, value)
VALUES ('reservation_pickup_duration', '2')
ON CONFLICT (key) DO NOTHING;

-- Row Level Security: allow the client (same as orders/products) to read & write.
-- Tighten these later if you add role separation.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_read"  ON app_settings;
DROP POLICY IF EXISTS "app_settings_write" ON app_settings;
CREATE POLICY "app_settings_read"  ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_write" ON app_settings FOR ALL    USING (true) WITH CHECK (true);

-- 3) One-time migration of EXISTING orders to the new status vocabulary.
--    Under the old flow, stock was already deducted when the order was created,
--    so mark existing rows stock_deducted = true to prevent a second deduction
--    if they are later marked Sold.
UPDATE orders SET stock_deducted = true WHERE stock_deducted IS DISTINCT FROM true;
UPDATE orders SET status = 'Reserved'  WHERE status = 'Pending';
UPDATE orders SET status = 'Sold'      WHERE status = 'Approved';
UPDATE orders SET status = 'Cancelled' WHERE status = 'Declined';
