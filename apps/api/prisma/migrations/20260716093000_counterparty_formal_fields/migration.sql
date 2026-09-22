ALTER TABLE `Counterparty`
  ADD COLUMN `address` VARCHAR(255) NULL AFTER `phone`,
  ADD COLUMN `bankName` VARCHAR(128) NULL AFTER `address`,
  ADD COLUMN `bankAccount` VARCHAR(128) NULL AFTER `bankName`,
  ADD COLUMN `remark` VARCHAR(255) NULL AFTER `bankAccount`;
