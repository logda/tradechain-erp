ALTER TABLE `Product`
    ADD COLUMN `salesCode` VARCHAR(64) NULL,
    ADD COLUMN `purchaseCode` VARCHAR(64) NULL,
    ADD COLUMN `purchaseCodeMode` VARCHAR(16) NOT NULL DEFAULT 'manual',
    ADD COLUMN `productStage` VARCHAR(32) NOT NULL DEFAULT 'formal',
    ADD COLUMN `pricingMode` VARCHAR(16) NOT NULL DEFAULT 'fixed',
    ADD COLUMN `brand` VARCHAR(64) NULL,
    ADD COLUMN `factoryName` VARCHAR(128) NULL,
    ADD COLUMN `model` VARCHAR(128) NULL,
    ADD COLUMN `spec` VARCHAR(255) NULL,
    ADD COLUMN `singleWeight` DECIMAL(18, 3) NULL,
    ADD COLUMN `cartonSpec` VARCHAR(255) NULL,
    ADD COLUMN `cartonQuantity` INTEGER NULL,
    ADD COLUMN `cartonWeight` DECIMAL(18, 3) NULL,
    ADD COLUMN `defaultSupplierCode` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `Product_salesCode_key` ON `Product`(`salesCode`);
CREATE UNIQUE INDEX `Product_purchaseCode_key` ON `Product`(`purchaseCode`);

CREATE TABLE `ProductSalePriceTier` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `productId` BIGINT NOT NULL,
    `minQuantity` INTEGER NOT NULL,
    `salePrice` DECIMAL(18, 2) NOT NULL,
    `currency` VARCHAR(16) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `createdBy` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedBy` VARCHAR(64) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductSalePriceTier_productId_minQuantity_key`(`productId`, `minQuantity`),
    INDEX `ProductSalePriceTier_productId_status_idx`(`productId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductSalePriceTier`
    ADD CONSTRAINT `ProductSalePriceTier_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
