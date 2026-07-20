-- Customer token stays valid for the order's lifetime (confirmed decision):
-- no separate timer of its own. NULL means "no expiry" -- only
-- delivered/cancelled (via mark_order_delivered/cancel_order) revokes it.
alter table tracking_tokens alter column expires_at drop not null;
