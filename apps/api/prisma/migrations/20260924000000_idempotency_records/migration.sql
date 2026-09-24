CREATE TABLE `IdempotencyRecord` (
  `id` VARCHAR(64) NOT NULL,
  `scope` VARCHAR(128) NULL,
  `fingerprint` VARCHAR(64) NOT NULL,
  `status` VARCHAR(16) NOT NULL,
  `result` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `IdempotencyRecord_scope_key` (`scope`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
