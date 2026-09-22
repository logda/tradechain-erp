CREATE TABLE `RolePermission` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `roleCode` VARCHAR(32) NOT NULL,
  `modules` JSON NOT NULL,
  `dataScope` VARCHAR(32) NOT NULL,
  `updatedBy` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `RolePermission_roleCode_key`(`roleCode`),
  INDEX `RolePermission_dataScope_idx`(`dataScope`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `RolePermission` (`roleCode`, `modules`, `dataScope`, `updatedBy`)
VALUES
  ('admin', JSON_ARRAY('sales', 'purchase', 'operations', 'boss_dashboard', 'admin'), 'all', 'system'),
  ('boss', JSON_ARRAY('sales', 'purchase', 'operations', 'boss_dashboard'), 'all', 'system'),
  ('sales_manager', JSON_ARRAY('sales', 'boss_dashboard'), 'sales_team', 'system'),
  ('sales', JSON_ARRAY('sales'), 'own_sales', 'system'),
  ('purchase_manager', JSON_ARRAY('purchase', 'operations', 'boss_dashboard'), 'purchase_team', 'system'),
  ('purchase', JSON_ARRAY('purchase', 'operations'), 'own_purchase', 'system')
ON DUPLICATE KEY UPDATE
  `modules` = VALUES(`modules`),
  `dataScope` = VALUES(`dataScope`),
  `updatedBy` = VALUES(`updatedBy`);
