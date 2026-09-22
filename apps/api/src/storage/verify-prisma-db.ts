import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    'mysql://root:password@127.0.0.1:3306/erp'
  );
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaMariaDb(resolveDatabaseUrl()),
  });
}

async function countBusinessDocumentsByType(prisma: PrismaClient) {
  const rows = await prisma.businessDocument.groupBy({
    by: ['bizType'],
    _count: { _all: true },
  });

  return Object.fromEntries(
    rows.map((row) => [row.bizType, row._count._all]),
  ) as Record<string, number>;
}

function assertMinimumCount(label: string, actual: number, expected: number) {
  if (actual < expected) {
    throw new Error(`${label} expected >= ${expected}, received ${actual}`);
  }
}

async function assertProductFormalSchemaReady(prisma: PrismaClient) {
  await prisma.product.findFirst({
    select: {
      salesCode: true,
      purchaseCode: true,
      purchaseCodeMode: true,
      productStage: true,
      pricingMode: true,
      brand: true,
      factoryName: true,
      model: true,
      spec: true,
      singleWeight: true,
      cartonSpec: true,
      cartonQuantity: true,
      cartonWeight: true,
      defaultSupplierCode: true,
      salePriceTiers: {
        select: {
          id: true,
          minQuantity: true,
          salePrice: true,
          currency: true,
          status: true,
        },
        take: 1,
      },
    },
  });
}

async function main() {
  const prisma = createPrismaClient();

  try {
    await prisma.$connect();
    await assertProductFormalSchemaReady(prisma);

    const [
      userCount,
      rolePermissionCount,
      counterpartyCount,
      productCount,
      operationLogCount,
      businessDocumentCounts,
    ] = await Promise.all([
      prisma.user.count(),
      (prisma as any).rolePermission.count(),
      prisma.counterparty.count(),
      prisma.product.count(),
      prisma.operationLog.count(),
      countBusinessDocumentsByType(prisma),
    ]);

    assertMinimumCount('users', userCount, 4);
    assertMinimumCount('rolePermissions', rolePermissionCount, 6);
    assertMinimumCount('counterparties', counterpartyCount, 2);
    assertMinimumCount('products', productCount, 2);
    assertMinimumCount('operationLogs', operationLogCount, 1);

    for (const bizType of [
      'quote',
      'sales_order',
      'purchase_order',
      'shipment_batch',
      'after_sales',
    ]) {
      assertMinimumCount(
        `businessDocuments.${bizType}`,
        businessDocumentCounts[bizType] ?? 0,
        1,
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          databaseUrl: resolveDatabaseUrl().replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@'),
          counts: {
            users: userCount,
            rolePermissions: rolePermissionCount,
            counterparties: counterpartyCount,
            products: productCount,
            operationLogs: operationLogCount,
            businessDocuments: businessDocumentCounts,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Formal ERP database verification failed.');
  console.error(error);
  process.exit(1);
});
