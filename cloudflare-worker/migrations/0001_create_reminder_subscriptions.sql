CREATE TABLE IF NOT EXISTS reminder_subscriptions (
    user_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    reminder_time TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_sent_date TEXT,
    PRIMARY KEY (user_id, subscription_id)
);
