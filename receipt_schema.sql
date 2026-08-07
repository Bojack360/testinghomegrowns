-- ============================================================
-- POS Receipt — one-time schema additions. Run in Supabase SQL editor.
-- Adds the receipt number (and payment/cashier) to POS transactions
-- so receipts can be re-viewed and reprinted from the Reports page.
-- ============================================================

ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS receipt_number text;
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS payment_method  text;
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS cashier         text;
