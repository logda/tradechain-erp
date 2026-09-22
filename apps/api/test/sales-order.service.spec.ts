import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { QuoteService } from '../src/quote/quote.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('SalesOrderService runtime audit logs', () => {
  it('records and lists sales order audit logs in runtime mode', async () => {
    const service = new SalesOrderService();

    await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 夏季补货',
      salesUserId: 2001,
      createdBy: 2001,
    });

    const result = await service.listAuditLogs();

    expect(result.items[0]).toMatchObject({
      bizType: 'sales_order',
      operationType: 'create_sales_order',
    });
  });

  it('keeps the source customer fields when converting a demand quote to a sales order', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'erp-sales-order-'));
    const previousDataDir = process.env.ERP_DATA_DIR;
    process.env.ERP_DATA_DIR = runtimeDir;

    try {
      const quoteService = new QuoteService();
      const salesOrderService = new SalesOrderService();

      const quote = await quoteService.create({
        submitMode: 'submit',
        documentType: 'demand',
        customerEntryMode: 'manual',
        customerName: 'Northwind Trading',
        customerCode: 'NW-001',
        salesUserId: 2001,
        sourceCode: 'expo',
        requirements: 'Need 500 units',
        items: [
          {
            productId: 1,
            sku: 'SKU-LED-001',
            productName: '智能 LED 灯带',
            unit: 'set',
            quantity: 500,
            salePrice: 15.9,
          },
        ],
      });

      const converted = await salesOrderService.convertConfirmedQuote({
        quoteOrderId: quote.id,
        quoteVersionNo: quote.currentVersionNo,
        customerId: quote.customerId,
        customerName: quote.customerName,
        customerCode: quote.customerCode,
        customerEntryMode: quote.customerEntryMode,
        sourceQuoteNo: quote.quoteNo,
        sourceCode: quote.sourceCode,
        inquiryDate: quote.inquiryDate,
        destination: quote.destination,
        requirements: quote.requirements,
        createdBy: quote.salesUserId,
        quoteConfirmed: true,
        items: quote.items?.map((item) => ({
          lineNo: item.lineNo,
          productId: item.productId,
          sku: item.sku,
          productName: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          salePrice: item.salePrice,
          amount: item.amount,
          imageUrls: item.imageUrls,
        })),
        quoteAttachments: quote.quoteAttachments,
      });

      expect(converted).toMatchObject({
        sourceMode: 'from_quote',
        customerName: 'Northwind Trading',
        customerCode: 'NW-001',
        customerEntryMode: 'manual',
        orderingUnit: 'Northwind Trading',
      });
    } finally {
      process.env.ERP_DATA_DIR = previousDataDir;
    }
  });
});
