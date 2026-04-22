-- Billing plans: tier assignment + Pro trial on signup.

ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','pro','team'));

ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN plan_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Grant existing users the 14-day Pro trial retroactively so the rollout
-- doesn't break active workflows. New users get the trial in Register().
UPDATE users SET trial_ends_at = NOW() + INTERVAL '14 days' WHERE trial_ends_at IS NULL;
