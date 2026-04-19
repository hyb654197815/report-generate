-- CreateTable
CREATE TABLE `ai_settings` (
    `id` INTEGER NOT NULL,
    `base_url` VARCHAR(512) NOT NULL DEFAULT 'https://api.openai.com/v1',
    `api_key` VARCHAR(1024) NULL,
    `chat_model` VARCHAR(128) NOT NULL DEFAULT 'gpt-4o-mini',
    `image_model` VARCHAR(128) NOT NULL DEFAULT 'gpt-image-1',
    `mock_enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ai_settings` (`id`, `base_url`, `api_key`, `chat_model`, `image_model`, `mock_enabled`, `updated_at`)
VALUES (1, 'https://api.openai.com/v1', NULL, 'gpt-4o-mini', 'gpt-image-1', true, CURRENT_TIMESTAMP(3));
