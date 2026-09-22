-- CreateTable
CREATE TABLE `User` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `realName` VARCHAR(64) NOT NULL,
    `passwordHash` VARCHAR(128) NOT NULL,
    `roleCode` VARCHAR(32) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `fullAccess` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deactivatedAt` DATETIME(3) NULL,
    `deactivatedBy` VARCHAR(64) NULL,
    `deactivatedReason` VARCHAR(255) NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Counterparty` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(16) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `shortName` VARCHAR(64) NULL,
    `contactName` VARCHAR(64) NULL,
    `phone` VARCHAR(64) NULL,
    `email` VARCHAR(128) NULL,
    `region` VARCHAR(64) NULL,
    `paymentTerms` VARCHAR(255) NULL,
    `ownerName` VARCHAR(64) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `createdBy` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedBy` VARCHAR(64) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `deactivatedAt` DATETIME(3) NULL,
    `deactivatedBy` VARCHAR(64) NULL,
    `deactivatedReason` VARCHAR(255) NULL,

    UNIQUE INDEX `Counterparty_code_key`(`code`),
    INDEX `Counterparty_type_status_idx`(`type`, `status`),
    INDEX `Counterparty_ownerName_idx`(`ownerName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(64) NOT NULL,
    `nameCn` VARCHAR(128) NOT NULL,
    `nameEn` VARCHAR(128) NOT NULL,
    `category` VARCHAR(32) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `currency` VARCHAR(16) NOT NULL,
    `defaultSalePrice` DECIMAL(18, 2) NOT NULL,
    `defaultPurchasePrice` DECIMAL(18, 2) NOT NULL,
    `ownerName` VARCHAR(64) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `createdBy` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedBy` VARCHAR(64) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `deactivatedAt` DATETIME(3) NULL,
    `deactivatedBy` VARCHAR(64) NULL,
    `deactivatedReason` VARCHAR(255) NULL,

    UNIQUE INDEX `Product_sku_key`(`sku`),
    INDEX `Product_category_status_idx`(`category`, `status`),
    INDEX `Product_ownerName_idx`(`ownerName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessDocument` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `bizType` VARCHAR(32) NOT NULL,
    `docNo` VARCHAR(64) NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `ownerUserId` BIGINT NULL,
    `counterpartyId` BIGINT NULL,
    `payload` JSON NOT NULL,
    `createdBy` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessDocument_docNo_key`(`docNo`),
    INDEX `BusinessDocument_bizType_status_idx`(`bizType`, `status`),
    INDEX `BusinessDocument_ownerUserId_idx`(`ownerUserId`),
    INDEX `BusinessDocument_counterpartyId_idx`(`counterpartyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteOrder` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `quoteNo` VARCHAR(64) NOT NULL,
    `customerId` BIGINT NOT NULL,
    `salesUserId` BIGINT NOT NULL,
    `currentVersionNo` INTEGER NOT NULL,
    `confirmedVersionNo` INTEGER NULL,
    `status` VARCHAR(32) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuoteOrder_quoteNo_key`(`quoteNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteOrderVersion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `quoteOrderId` BIGINT NOT NULL,
    `versionNo` INTEGER NOT NULL,
    `requirements` TEXT NOT NULL,
    `changeReason` VARCHAR(255) NULL,
    `confirmedFlag` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `QuoteOrderVersion_quoteOrderId_versionNo_key`(`quoteOrderId`, `versionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteInquirySheet` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `inquiryNo` VARCHAR(64) NOT NULL,
    `quoteOrderId` BIGINT NOT NULL,
    `quoteVersionId` BIGINT NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `supplierCount` INTEGER NOT NULL DEFAULT 0,
    `comparisonSummary` TEXT NULL,
    `confirmedBy` BIGINT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `QuoteInquirySheet_inquiryNo_key`(`inquiryNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteInquiryItem` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `inquirySheetId` BIGINT NOT NULL,
    `quoteVersionItemId` BIGINT NOT NULL,
    `lineNo` INTEGER NOT NULL,
    `productId` BIGINT NOT NULL,
    `requiredSupplierCount` INTEGER NOT NULL DEFAULT 2,
    `bossConfirmedSalePrice` DECIMAL(18, 2) NULL,
    `bossSelectedSupplierQuoteId` BIGINT NULL,
    `bossPricingRemark` VARCHAR(255) NULL,
    `bossPricedBy` BIGINT NULL,
    `bossPricedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteInquirySupplierQuote` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `inquiryItemId` BIGINT NOT NULL,
    `supplierId` BIGINT NOT NULL,
    `supplierProductName` VARCHAR(128) NULL,
    `quotePrice` DECIMAL(18, 2) NOT NULL,
    `currencyCode` VARCHAR(16) NOT NULL,
    `quoteDate` DATETIME(3) NOT NULL,
    `attachmentUrl` VARCHAR(255) NULL,
    `remark` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SampleOrder` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sampleNo` VARCHAR(64) NOT NULL,
    `sourceQuoteOrderId` BIGINT NOT NULL,
    `sourceQuoteVersionId` BIGINT NOT NULL,
    `customerId` BIGINT NOT NULL,
    `currentVersionNo` INTEGER NOT NULL,
    `currentStatus` VARCHAR(32) NOT NULL,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SampleOrder_sampleNo_key`(`sampleNo`),
    UNIQUE INDEX `SampleOrder_sourceQuoteVersionId_key`(`sourceQuoteVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SampleOrderVersion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sampleOrderId` BIGINT NOT NULL,
    `versionNo` INTEGER NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `sampleRequirements` TEXT NOT NULL,
    `samplingCost` DECIMAL(18, 2) NULL,
    `changeReason` VARCHAR(255) NULL,
    `cancelReason` VARCHAR(255) NULL,
    `replacedVersionNo` INTEGER NULL,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SampleOrderVersion_sampleOrderId_versionNo_key`(`sampleOrderId`, `versionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesOrder` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `salesNo` VARCHAR(64) NOT NULL,
    `sourceQuoteOrderId` BIGINT NULL,
    `sourceQuoteVersionId` BIGINT NULL,
    `customerId` BIGINT NOT NULL,
    `currentVersionNo` INTEGER NOT NULL,
    `confirmedVersionNo` INTEGER NULL,
    `status` VARCHAR(32) NOT NULL,
    `purchaseAggregateStatus` VARCHAR(32) NOT NULL,
    `shipmentAggregateStatus` VARCHAR(32) NOT NULL,
    `receiptStatus` VARCHAR(32) NOT NULL,
    `afterSalesEndStatus` VARCHAR(32) NOT NULL,
    `financeStatus` VARCHAR(32) NOT NULL,
    `lockedFlag` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalesOrder_salesNo_key`(`salesNo`),
    UNIQUE INDEX `SalesOrder_sourceQuoteVersionId_key`(`sourceQuoteVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesOrderVersion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `salesOrderId` BIGINT NOT NULL,
    `versionNo` INTEGER NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `changeReason` VARCHAR(255) NULL,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SalesOrderVersion_salesOrderId_versionNo_key`(`salesOrderId`, `versionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesOrderItem` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `salesOrderVersionId` BIGINT NOT NULL,
    `lineNo` INTEGER NOT NULL,
    `productId` BIGINT NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(18, 2) NOT NULL,
    `totalAmount` DECIMAL(18, 2) NOT NULL,
    `directEntry` BOOLEAN NOT NULL DEFAULT false,
    `chosenSupplierId` BIGINT NULL,
    `sourceInquiryItemId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SalesOrderItem_salesOrderVersionId_lineNo_key`(`salesOrderVersionId`, `lineNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `purchaseNo` VARCHAR(64) NOT NULL,
    `sourceSalesOrderId` BIGINT NOT NULL,
    `supplierId` BIGINT NOT NULL,
    `currentVersionNo` INTEGER NOT NULL,
    `confirmedVersionNo` INTEGER NULL,
    `status` VARCHAR(32) NOT NULL,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseOrder_purchaseNo_key`(`purchaseNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderVersion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `purchaseOrderId` BIGINT NOT NULL,
    `versionNo` INTEGER NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `changeReason` VARCHAR(255) NULL,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PurchaseOrderVersion_purchaseOrderId_versionNo_key`(`purchaseOrderId`, `versionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderItem` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `purchaseOrderVersionId` BIGINT NOT NULL,
    `lineNo` INTEGER NOT NULL,
    `sourceSalesItemId` BIGINT NOT NULL,
    `productId` BIGINT NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(18, 2) NOT NULL,
    `totalAmount` DECIMAL(18, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PurchaseOrderItem_purchaseOrderVersionId_lineNo_key`(`purchaseOrderVersionId`, `lineNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentBatch` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batchNo` VARCHAR(64) NOT NULL,
    `salesOrderId` BIGINT NOT NULL,
    `purchaseOrderId` BIGINT NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `shippedQty` INTEGER NOT NULL,
    `accumulatedQty` INTEGER NOT NULL,
    `remainingQty` INTEGER NOT NULL,
    `shippedAt` DATETIME(3) NOT NULL,
    `receiptSendStatus` VARCHAR(16) NOT NULL,
    `receiptDocUrl` VARCHAR(255) NULL,
    `receiptSentAt` DATETIME(3) NULL,
    `receiptSentBy` BIGINT NULL,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShipmentBatch_batchNo_key`(`batchNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AfterSalesOrder` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `afterSalesNo` VARCHAR(64) NOT NULL,
    `salesOrderId` BIGINT NOT NULL,
    `purchaseOrderId` BIGINT NULL,
    `shipmentBatchId` BIGINT NULL,
    `type` VARCHAR(32) NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `financeReviewStatus` VARCHAR(32) NOT NULL,
    `issueDescription` TEXT NOT NULL,
    `createdBy` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AfterSalesOrder_afterSalesNo_key`(`afterSalesNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalRecord` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `bizType` VARCHAR(32) NOT NULL,
    `bizId` BIGINT NOT NULL,
    `bizVersionNo` INTEGER NULL,
    `actionType` VARCHAR(32) NOT NULL,
    `approverId` BIGINT NULL,
    `result` VARCHAR(16) NULL,
    `remark` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `bizType` VARCHAR(32) NOT NULL,
    `bizId` BIGINT NOT NULL,
    `operationType` VARCHAR(32) NOT NULL,
    `operatorId` BIGINT NOT NULL,
    `beforeData` JSON NULL,
    `afterData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttachmentMeta` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `bizType` VARCHAR(32) NOT NULL,
    `bizId` BIGINT NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(128) NOT NULL,
    `fileSize` BIGINT NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `visibility` VARCHAR(32) NOT NULL,
    `uploadedBy` BIGINT NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttachmentMeta_bizType_bizId_idx`(`bizType`, `bizId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuoteOrderVersion` ADD CONSTRAINT `QuoteOrderVersion_quoteOrderId_fkey` FOREIGN KEY (`quoteOrderId`) REFERENCES `QuoteOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteInquirySheet` ADD CONSTRAINT `QuoteInquirySheet_quoteOrderId_fkey` FOREIGN KEY (`quoteOrderId`) REFERENCES `QuoteOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SampleOrderVersion` ADD CONSTRAINT `SampleOrderVersion_sampleOrderId_fkey` FOREIGN KEY (`sampleOrderId`) REFERENCES `SampleOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrderVersion` ADD CONSTRAINT `SalesOrderVersion_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `SalesOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrderItem` ADD CONSTRAINT `SalesOrderItem_salesOrderVersionId_fkey` FOREIGN KEY (`salesOrderVersionId`) REFERENCES `SalesOrderVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_sourceSalesOrderId_fkey` FOREIGN KEY (`sourceSalesOrderId`) REFERENCES `SalesOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderVersion` ADD CONSTRAINT `PurchaseOrderVersion_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_purchaseOrderVersionId_fkey` FOREIGN KEY (`purchaseOrderVersionId`) REFERENCES `PurchaseOrderVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
