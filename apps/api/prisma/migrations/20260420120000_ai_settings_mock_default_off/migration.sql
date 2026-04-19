-- Default mock off; existing singleton row set to false for consistency with new product default.
ALTER TABLE `ai_settings` MODIFY `mock_enabled` BOOLEAN NOT NULL DEFAULT false;
UPDATE `ai_settings` SET `mock_enabled` = false WHERE `id` = 1;
