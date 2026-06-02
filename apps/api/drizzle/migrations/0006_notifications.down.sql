-- Reverse of 0006_notifications.sql
DROP TABLE IF EXISTS notifications;
ALTER TABLE tenants DROP COLUMN IF EXISTS notification_prefs;
