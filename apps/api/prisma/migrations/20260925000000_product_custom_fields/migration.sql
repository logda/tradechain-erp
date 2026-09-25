ALTER TABLE `Product`
  ADD COLUMN `customValues` JSON NULL;

CREATE TABLE `ProductCustomField` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `type` VARCHAR(16) NOT NULL,
  `createdBy` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  INDEX `ProductCustomField_deletedAt_idx`(`deletedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE `RolePermission`
SET `actions` = JSON_ARRAY_APPEND(`actions`, '$', 'product.custom_field.write')
WHERE `roleCode` IN ('admin', 'boss')
  AND JSON_CONTAINS(`actions`, JSON_QUOTE('product.custom_field.write')) = 0;
