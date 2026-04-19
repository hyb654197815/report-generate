-- CreateTable
CREATE TABLE `report_template` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `type` INTEGER NOT NULL,
    `background_pdf_url` VARCHAR(191) NULL,
    `draft_html_url` VARCHAR(191) NULL,
    `width` DOUBLE NOT NULL DEFAULT 595,
    `height` DOUBLE NOT NULL DEFAULT 842,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_component` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `default_script` TEXT NULL,
    `default_config` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `template_element` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `template_id` INTEGER NOT NULL,
    `component_id` INTEGER NULL,
    `element_type` VARCHAR(191) NOT NULL,
    `position_json` TEXT NOT NULL,
    `script_code` TEXT NULL,
    `static_content` TEXT NULL,
    `style_config` TEXT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `template_element_template_id_idx` ON `template_element`(`template_id`);

-- AddForeignKey
ALTER TABLE `template_element` ADD CONSTRAINT `template_element_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `report_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `template_element` ADD CONSTRAINT `template_element_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `sys_component`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
