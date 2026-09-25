import { ParseIntPipe } from '@nestjs/common';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { FormalRoleGuard } from '../src/auth/formal-role.guard';
import { FORMAL_ACTIONS_KEY, FORMAL_ROLES_KEY } from '../src/auth/formal-role.decorator';
import { ProductController } from '../src/product/product.controller';
import { ProductService, type CreateProductPayload } from '../src/product/product.service';

describe('ProductController', () => {
  it('allows sales to read products while restricting mutations to admin', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProductController)).toEqual(
      expect.arrayContaining([FormalRoleGuard]),
    );
    expect(Reflect.getMetadata(FORMAL_ROLES_KEY, ProductController)).toContain('sales');
    expect(Reflect.getMetadata(FORMAL_ROLES_KEY, ProductController.prototype.create)).toEqual(['admin']);
    expect(Reflect.getMetadata(FORMAL_ROLES_KEY, ProductController.prototype.createCustomField)).toEqual(['admin', 'boss']);
    expect(
      Reflect.getMetadata(FORMAL_ACTIONS_KEY, ProductController.prototype.create),
    ).toEqual(['master_data.write']);
    expect(
      Reflect.getMetadata(FORMAL_ACTIONS_KEY, ProductController.prototype.update),
    ).toEqual(['master_data.write']);
    expect(
      Reflect.getMetadata(
        FORMAL_ACTIONS_KEY,
        ProductController.prototype.deactivate,
      ),
    ).toEqual(['master_data.write']);
    expect(
      Reflect.getMetadata(
        FORMAL_ACTIONS_KEY,
        ProductController.prototype.activate,
      ),
    ).toEqual(['master_data.write']);
    expect(
      Reflect.getMetadata(
        FORMAL_ACTIONS_KEY,
        ProductController.prototype.deleteProduct,
      ),
    ).toEqual(['master_data.write']);
    expect(
      Reflect.getMetadata(
        FORMAL_ACTIONS_KEY,
        ProductController.prototype.convertToFormal,
      ),
    ).toEqual(['master_data.write']);
    expect(
      Reflect.getMetadata(
        FORMAL_ACTIONS_KEY,
        ProductController.prototype.updateCodeRule,
      ),
    ).toEqual(['master_data.write']);
  });

  it('passes normalized list query parameters to the service', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 5 });
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(ProductController);
    await controller.list({
      keyword: 'LED',
      category: 'electronics',
      status: 'active',
      page: '2',
      pageSize: '5',
    });

    expect(list).toHaveBeenCalledWith({
      keyword: 'LED',
      category: 'electronics',
      status: 'active',
      page: 2,
      pageSize: 5,
    }, 'full');
  });

  it('falls back to safe list pagination defaults', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(ProductController);
    await controller.list({
      page: 'NaN',
      pageSize: '-1',
    });

    expect(list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    }, 'full');
  });

  it('passes the sales audience to the service from the signed role', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    const controller = new ProductController({ list } as unknown as ProductService);
    await controller.list({}, { headers: { 'x-erp-role': 'sales' } });
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, 'sales');
  });

  it('creates a product from admin input', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 9,
      sku: 'SKU-CAM-009',
      status: 'active',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(ProductController);
    const result = await controller.create({
      sku: 'SKU-CAM-009',
      nameCn: '户外摄像头',
      nameEn: 'Outdoor Camera',
      category: 'electronics',
      productStage: 'formal',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 39.9,
      defaultPurchasePrice: 21.5,
      ownerName: 'Zoe',
      createdBy: 'Admin',
    });

    expect(create).toHaveBeenCalledWith({
      sku: 'SKU-CAM-009',
      nameCn: '户外摄像头',
      nameEn: 'Outdoor Camera',
      category: 'electronics',
      productStage: 'formal',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 39.9,
      defaultPurchasePrice: 21.5,
      ownerName: 'Zoe',
      createdBy: 'Admin',
    });
    expect(result.status).toBe('active');
  });

  it('rejects API product creation without an explicit product stage', async () => {
    const create = jest.fn();
    const controller = new ProductController({ create } as unknown as ProductService);
    expect(() => controller.create({ nameCn: '未选阶段产品' } as CreateProductPayload)).toThrow('请选择产品阶段');
    expect(create).not.toHaveBeenCalled();
  });

  it('reads and updates the product code rule', async () => {
    const getCodeRule = jest.fn().mockResolvedValue({
      strategy: 'composed_segments',
      serialLength: 3,
      serialScope: 'per_supplier_total',
      segments: [
        { key: 'supplier_code', enabled: true, order: 1 },
        { key: 'serial', enabled: true, order: 2 },
      ],
      updatedBy: 'system',
    });
    const updateCodeRule = jest.fn().mockResolvedValue({
      strategy: 'composed_segments',
      serialLength: 4,
      serialScope: 'per_supplier_month',
      segments: [
        { key: 'prefix', enabled: true, order: 1, value: 'PD' },
        { key: 'supplier_code', enabled: true, order: 2 },
        { key: 'year', enabled: true, order: 3 },
        { key: 'month', enabled: true, order: 4 },
        { key: 'serial', enabled: true, order: 5 },
      ],
      updatedBy: 'Admin',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: { getCodeRule, updateCodeRule } }],
    }).compile();

    const controller = moduleRef.get(ProductController);

    await expect(controller.getCodeRule()).resolves.toMatchObject({
      serialLength: 3,
    });
    await expect(
      controller.updateCodeRule({
        strategy: 'composed_segments',
        serialLength: 4,
        serialScope: 'per_supplier_month',
        segments: [
          { key: 'prefix', enabled: true, order: 1, value: 'PD' },
          { key: 'supplier_code', enabled: true, order: 2 },
          { key: 'year', enabled: true, order: 3 },
          { key: 'month', enabled: true, order: 4 },
          { key: 'serial', enabled: true, order: 5 },
        ],
        updatedBy: 'Admin',
      } as any),
    ).resolves.toMatchObject({
      serialLength: 4,
      updatedBy: 'Admin',
    });

    expect(getCodeRule).toHaveBeenCalled();
    expect(updateCodeRule).toHaveBeenCalledWith({
      strategy: 'composed_segments',
      serialLength: 4,
      serialScope: 'per_supplier_month',
      segments: [
        { key: 'prefix', enabled: true, order: 1, value: 'PD' },
        { key: 'supplier_code', enabled: true, order: 2 },
        { key: 'year', enabled: true, order: 3 },
        { key: 'month', enabled: true, order: 4 },
        { key: 'serial', enabled: true, order: 5 },
      ],
      updatedBy: 'Admin',
    });
  });

  it('updates and deactivates a product by id', async () => {
    const update = jest.fn().mockResolvedValue({ id: 9, nameCn: '升级版' });
    const deactivate = jest.fn().mockResolvedValue({ id: 9, status: 'inactive' });
    const activate = jest.fn().mockResolvedValue({ id: 9, status: 'active' });
    const deleteProduct = jest.fn().mockResolvedValue({ id: 9, status: 'deleted' });
    const convertToFormal = jest.fn().mockResolvedValue({ id: 9, productStage: 'formal' });
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: {
            update,
            deactivate,
            activate,
            deleteProduct,
            convertToFormal,
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(ProductController);

    await expect(
      controller.update(9, {
        nameCn: '升级版',
        updatedBy: 'Admin',
      }),
    ).resolves.toMatchObject({ nameCn: '升级版' });
    await expect(
      controller.deactivate(9, {
        operatedBy: 'Admin',
        reason: '停产',
      }),
    ).resolves.toMatchObject({ status: 'inactive' });
    await expect(
      controller.activate(9, {
        operatedBy: 'Admin',
        reason: '恢复销售',
      }),
    ).resolves.toMatchObject({ status: 'active' });
    await expect(
      controller.deleteProduct(9, {
        operatedBy: 'Admin',
        reason: '重复建档',
      }),
    ).resolves.toMatchObject({ status: 'deleted' });
    await expect(
      controller.convertToFormal(9, {
        operatedBy: 'Admin',
      }),
    ).resolves.toMatchObject({ productStage: 'formal' });

    expect(update).toHaveBeenCalledWith(9, {
      nameCn: '升级版',
      updatedBy: 'Admin',
    });
    expect(deactivate).toHaveBeenCalledWith(9, {
      operatedBy: 'Admin',
      reason: '停产',
    });
    expect(activate).toHaveBeenCalledWith(9, {
      operatedBy: 'Admin',
      reason: '恢复销售',
    });
    expect(deleteProduct).toHaveBeenCalledWith(9, {
      operatedBy: 'Admin',
      reason: '重复建档',
    });
    expect(convertToFormal).toHaveBeenCalledWith(9, {
      operatedBy: 'Admin',
    });
  });

  it('lists product audit logs from the controller', async () => {
    const listAuditLogs = jest.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          bizType: 'product',
          bizId: 11,
          operationType: 'create_product',
        },
      ],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: { listAuditLogs } }],
    }).compile();

    const controller = moduleRef.get(ProductController);
    const result = await controller.listAuditLogs();

    expect(listAuditLogs).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });

  it('uses ParseIntPipe for id params', () => {
    const updateMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ProductController,
      'update',
    ) as Record<string, { pipes: unknown[] }>;
    const deactivateMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ProductController,
      'deactivate',
    ) as Record<string, { pipes: unknown[] }>;
    const activateMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ProductController,
      'activate',
    ) as Record<string, { pipes: unknown[] }>;
    const convertMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ProductController,
      'convertToFormal',
    ) as Record<string, { pipes: unknown[] }>;

    expect(updateMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
    expect(deactivateMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
    expect(activateMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
    expect(convertMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
