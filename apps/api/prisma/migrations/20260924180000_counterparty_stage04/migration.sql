ALTER TABLE `Counterparty`
  ADD COLUMN `paymentMethod` VARCHAR(255) NULL,
  ADD COLUMN `settlementMethod` VARCHAR(255) NULL,
  ADD COLUMN `unitTags` JSON NULL,
  ADD COLUMN `openingReceivable` DECIMAL(18, 2) NULL,
  ADD COLUMN `payableReceivable` DECIMAL(18, 2) NULL,
  ADD COLUMN `moldFee` DECIMAL(18, 2) NULL,
  ADD COLUMN `customValues` JSON NULL;

CREATE TABLE `CounterpartyCustomField` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `type` VARCHAR(16) NOT NULL,
  `createdBy` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  INDEX `CounterpartyCustomField_deletedAt_idx`(`deletedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE `RolePermission`
SET `actions` = JSON_ARRAY_APPEND(`actions`, '$', 'counterparty.write')
WHERE JSON_CONTAINS(`actions`, JSON_QUOTE('counterparty.write')) = 0;
