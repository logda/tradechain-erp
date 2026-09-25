import { createHash } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    'mysql://root:password@127.0.0.1:3306/erp'
  );
}

function hashPassword(password: string) {
  return createHash('sha256').update(password).digest('hex');
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(resolveDatabaseUrl()),
});

async function seedUsers() {
  const users = [
    {
      id: 1n,
      username: 'admin',
      realName: '系统管理员',
      passwordHash: hashPassword('Admin123456'),
      roleCode: 'admin',
      fullAccess: true,
      createdBy: 'system',
    },
    {
      id: 2n,
      username: 'mia',
      realName: 'Mia',
      passwordHash: hashPassword('Mia123456'),
      roleCode: 'boss',
      fullAccess: true,
      createdBy: 'system',
    },
    {
      id: 3n,
      username: 'zoe',
      realName: 'Zoe',
      passwordHash: hashPassword('Zoe123456'),
      roleCode: 'sales',
      fullAccess: false,
      createdBy: 'admin',
    },
    {
      id: 4n,
      username: 'leo',
      realName: 'Leo',
      passwordHash: hashPassword('Leo123456'),
      roleCode: 'purchase',
      fullAccess: false,
      createdBy: 'admin',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        realName: user.realName,
        roleCode: user.roleCode,
        status: 'active',
        fullAccess: user.fullAccess,
      },
      create: {
        ...user,
        status: 'active',
      },
    });
  }
}

async function seedRolePermissions() {
  const rolePermissions = [
    {
      roleCode: 'admin',
      modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'admin'],
      dataScope: 'all',
      actions: [
        'admin.user.write',
        'counterparty.write',
        'admin.role.write',
        'master_data.write',
        'product.write',
        'product.custom_field.write',
        'sales.quote.write',
        'sales.inquiry.submit',
        'sales.order.write',
        'sales.sample.submit',
        'sales.sample.approve',
        'sales.sample.execute',
        'purchase.order.create',
        'purchase.order.submit',
        'purchase.order.approve',
        'shipment.update',
        'after_sales.process',
        'boss.confirm',
        'finance.confirm',
      ],
    },
    {
      roleCode: 'boss',
      modules: ['sales', 'purchase', 'operations', 'boss_dashboard'],
      dataScope: 'all',
      actions: [
        'product.write',
        'product.custom_field.write',
        'sales.order.write',
        'counterparty.write',
        'sales.sample.approve',
        'purchase.order.approve',
        'after_sales.process',
        'boss.confirm',
        'finance.confirm',
      ],
    },
    {
      roleCode: 'sales_manager',
      modules: ['sales', 'boss_dashboard'],
      dataScope: 'sales_team',
      actions: [
        'sales.quote.write',
        'counterparty.write',
        'sales.inquiry.submit',
        'sales.order.write',
        'sales.sample.submit',
        'sales.sample.approve',
        'sales.sample.execute',
      ],
    },
    {
      roleCode: 'sales',
      modules: ['sales'],
      dataScope: 'own_sales',
      actions: [
        'sales.quote.write',
        'counterparty.write',
        'sales.inquiry.submit',
        'sales.order.write',
        'sales.sample.submit',
        'sales.sample.execute',
      ],
    },
    {
      roleCode: 'purchase_manager',
      modules: ['purchase', 'operations', 'boss_dashboard'],
      dataScope: 'purchase_team',
      actions: [
        'purchase.order.create',
        'counterparty.write',
        'sales.inquiry.submit',
        'purchase.order.submit',
        'purchase.order.approve',
        'shipment.update',
        'after_sales.process',
      ],
    },
    {
      roleCode: 'purchase',
      modules: ['purchase', 'operations'],
      dataScope: 'own_purchase',
      actions: [
        'purchase.order.create',
        'counterparty.write',
        'sales.inquiry.submit',
        'purchase.order.submit',
        'shipment.update',
        'after_sales.process',
      ],
    },
  ];

  const rolePermissionDelegate = (
    prisma as unknown as {
      rolePermission: {
        upsert: (args: unknown) => Promise<unknown>;
      };
    }
  ).rolePermission;

  for (const permission of rolePermissions) {
    await rolePermissionDelegate.upsert({
      where: { roleCode: permission.roleCode },
      update: {
        modules: permission.modules,
        dataScope: permission.dataScope,
        actions: permission.actions,
        updatedBy: 'system',
      },
      create: {
        ...permission,
        updatedBy: 'system',
      },
    });
  }
}

async function seedCounterparties() {
  const counterparties = [
    {
      id: 1001n,
      type: 'customer',
      code: 'CUS-ACME',
      name: '上海星河贸易有限公司',
      shortName: '星河贸易',
      contactName: '王经理',
      phone: '13800000001',
      email: 'buyer@example.com',
      region: '上海',
      paymentTerms: '30% 预付款，70% 发货前结清',
      ownerName: 'Zoe',
      createdBy: 'admin',
    },
    {
      id: 3001n,
      type: 'supplier',
      code: 'SUP-LIGHT',
      name: '深圳光源制造有限公司',
      shortName: '光源制造',
      contactName: '李工',
      phone: '13800000002',
      email: 'supplier@example.com',
      region: '深圳',
      paymentTerms: '月结 30 天',
      ownerName: 'Leo',
      createdBy: 'admin',
    },
  ];

  for (const counterparty of counterparties) {
    await prisma.counterparty.upsert({
      where: { code: counterparty.code },
      update: {
        type: counterparty.type,
        name: counterparty.name,
        shortName: counterparty.shortName,
        contactName: counterparty.contactName,
        phone: counterparty.phone,
        email: counterparty.email,
        region: counterparty.region,
        paymentTerms: counterparty.paymentTerms,
        ownerName: counterparty.ownerName,
        status: 'active',
        updatedBy: 'admin',
      },
      create: {
        ...counterparty,
        status: 'active',
      },
    });
  }
}

async function seedProducts() {
  const products = [
    {
      id: 501n,
      sku: 'SKU-LED-501',
      salesCode: 'SALE-LED-501',
      purchaseCode: 'PUR-LED-501',
      purchaseCodeMode: 'manual',
      productStage: 'formal',
      pricingMode: 'tiered',
      brand: 'Starlight',
      factoryName: '深圳光源制造有限公司',
      model: 'SL-501',
      spec: '5m / RGB',
      singleWeight: '0.850',
      cartonSpec: '20 pcs / carton',
      cartonQuantity: 20,
      cartonWeight: '18.500',
      defaultSupplierCode: 'SUP-LIGHT',
      nameCn: '智能 LED 灯带',
      nameEn: 'Smart LED Strip',
      category: 'electronics',
      unit: 'pcs',
      currency: 'CNY',
      defaultSalePrice: '128.00',
      defaultPurchasePrice: '86.00',
      ownerName: 'Zoe',
      createdBy: 'admin',
    },
    {
      id: 503n,
      sku: 'SKU-CABLE-503',
      salesCode: 'SALE-CABLE-503',
      purchaseCode: 'PUR-CABLE-503',
      purchaseCodeMode: 'generated',
      productStage: 'quote_candidate',
      pricingMode: 'fixed',
      brand: 'LinkPro',
      factoryName: '深圳连接制造厂',
      model: 'LC-503',
      spec: 'USB-C / 1m',
      singleWeight: '0.120',
      cartonSpec: '100 pcs / carton',
      cartonQuantity: 100,
      cartonWeight: '12.500',
      defaultSupplierCode: 'SUP-LIGHT',
      nameCn: 'USB-C 线缆',
      nameEn: 'USB-C Cable',
      category: 'consumables',
      unit: 'pcs',
      currency: 'CNY',
      defaultSalePrice: '39.00',
      defaultPurchasePrice: '18.00',
      ownerName: 'Zoe',
      createdBy: 'admin',
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        nameCn: product.nameCn,
        nameEn: product.nameEn,
        salesCode: product.salesCode,
        purchaseCode: product.purchaseCode,
        purchaseCodeMode: product.purchaseCodeMode,
        productStage: product.productStage,
        pricingMode: product.pricingMode,
        brand: product.brand,
        factoryName: product.factoryName,
        model: product.model,
        spec: product.spec,
        singleWeight: product.singleWeight,
        cartonSpec: product.cartonSpec,
        cartonQuantity: product.cartonQuantity,
        cartonWeight: product.cartonWeight,
        defaultSupplierCode: product.defaultSupplierCode,
        category: product.category,
        unit: product.unit,
        currency: product.currency,
        defaultSalePrice: product.defaultSalePrice,
        defaultPurchasePrice: product.defaultPurchasePrice,
        ownerName: product.ownerName,
        status: 'active',
        updatedBy: 'admin',
      },
      create: {
        ...product,
        status: 'active',
      },
    });

    await prisma.productSalePriceTier.deleteMany({
      where: { productId: product.id },
    });

    if (product.sku === 'SKU-LED-501') {
      await prisma.productSalePriceTier.createMany({
        data: [
          {
            productId: product.id,
            minQuantity: 1,
            salePrice: '128.00',
            currency: 'CNY',
            status: 'active',
            createdBy: 'admin',
          },
          {
            productId: product.id,
            minQuantity: 100,
            salePrice: '118.00',
            currency: 'CNY',
            status: 'active',
            createdBy: 'admin',
          },
        ],
      });
    }
  }
}

async function seedBusinessDocuments() {
  const documents = [
    {
      bizType: 'quote',
      docNo: 'Q202607130001',
      status: 'pending_boss_confirm',
      ownerUserId: 3n,
      counterpartyId: 1001n,
      payload: {
        id: 130001,
        quoteNo: 'Q202607130001',
        status: 'pending_boss_confirm',
        currentVersionNo: 1,
        customerId: 1001,
        salesUserId: 3,
        sourceCode: 'direct',
        requirements: '正式数据库种子报价，用于落库验收。',
        createdAt: '2026-07-13T09:00:00.000Z',
        items: [
          {
            lineNo: 1,
            productId: 501,
            productName: '智能 LED 灯带',
            quantity: 100,
            unitPrice: 128,
            totalAmount: 12800,
          },
        ],
      },
    },
    {
      bizType: 'sales_order',
      docNo: 'S202607130001',
      status: 'pending_sales_manager_approval',
      ownerUserId: 3n,
      counterpartyId: 1001n,
      payload: {
        id: 130101,
        salesNo: 'S202607130001',
        status: 'pending_sales_manager_approval',
        purchaseAggregateStatus: 'not_started',
        shipmentAggregateStatus: 'not_shipped',
        receiptStatus: 'deposit_received',
        financeStatus: 'pending',
        afterSalesEndStatus: 'none',
        customerId: 1001,
        salesUserId: 3,
        createdByName: 'Zoe',
        versionHistory: [{ versionNo: 1, status: 'submitted' }],
      },
    },
    {
      bizType: 'purchase_order',
      docNo: 'P202607130001',
      status: 'pending_purchase_manager_approval',
      ownerUserId: 4n,
      counterpartyId: 3001n,
      payload: {
        id: 130201,
        purchaseNo: 'P202607130001',
        sourceSalesNo: 'S202607130001',
        status: 'pending_purchase_manager_approval',
        supplierId: 3001,
        purchaseUserId: 4,
      },
    },
    {
      bizType: 'shipment_batch',
      docNo: 'SH202607130001',
      status: 'exception',
      ownerUserId: 4n,
      counterpartyId: 3001n,
      payload: {
        id: 130301,
        batchNo: 'SH202607130001',
        salesOrderId: 130101,
        purchaseOrderId: 130201,
        status: 'exception',
        hasException: true,
        shippedQty: 40,
        accumulatedQty: 40,
        remainingQty: 60,
        receiptSendStatus: 'pending',
      },
    },
    {
      bizType: 'after_sales',
      docNo: 'AS202607130001',
      status: 'finance_reviewing',
      ownerUserId: 4n,
      counterpartyId: 1001n,
      payload: {
        id: 130401,
        afterSalesNo: 'AS202607130001',
        salesOrderId: 130101,
        shipmentBatchId: 130301,
        type: 'refund',
        status: 'finance_reviewing',
        financeReviewStatus: 'pending',
        issueDescription: '正式数据库种子售后，用于财务复核队列验收。',
      },
    },
  ];

  for (const document of documents) {
    await prisma.businessDocument.upsert({
      where: { docNo: document.docNo },
      update: {
        status: document.status,
        ownerUserId: document.ownerUserId,
        counterpartyId: document.counterpartyId,
        payload: document.payload,
        createdBy: 1n,
      },
      create: {
        ...document,
        createdBy: 1n,
      },
    });
  }
}

async function seedAuditLog() {
  const existing = await prisma.operationLog.findFirst({
    where: {
      bizType: 'database',
      operationType: 'seed_formal_database',
    },
  });

  if (existing) {
    return;
  }

  await prisma.operationLog.create({
    data: {
      bizType: 'database',
      bizId: 0n,
      operationType: 'seed_formal_database',
      operatorId: 1n,
      beforeData: undefined,
      afterData: {
        users: 4,
        counterparties: 2,
        products: 2,
        businessDocuments: 5,
      },
    },
  });
}

async function main() {
  await seedUsers();
  await seedRolePermissions();
  await seedCounterparties();
  await seedProducts();
  await seedBusinessDocuments();
  await seedAuditLog();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Formal ERP database seed completed.');
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    console.error('Formal ERP database seed failed.');
    console.error(error);
    process.exit(1);
  });
