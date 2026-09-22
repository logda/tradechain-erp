export class ResubmitPurchaseOrderDto {
  hasShipmentBatches!: boolean;
  sourceSalesOrderId!: number;
  supplierId!: number;
  changeReason!: string;
}
