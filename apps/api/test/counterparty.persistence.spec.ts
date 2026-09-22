import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CounterpartyService } from '../src/counterparty/counterparty.service';

describe('CounterpartyService persistence', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-counterparty-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('persists created counterparties across service instances', async () => {
    const firstService = new CounterpartyService();
    await firstService.create({
      type: 'supplier',
      code: 'SUP-OMEGA',
      name: 'Omega Parts',
      shortName: 'Omega',
      region: 'Shenzhen',
      ownerName: 'Leo',
      contactName: 'Olivia',
      phone: '13800000001',
      address: 'Shenzhen Baoan 100 号',
      bankName: '招商银行深圳分行',
      bankAccount: '6222000000000100',
      remark: '长期合作',
      createdBy: 'Admin',
    });

    const secondService = new CounterpartyService();
    const listed = await secondService.list({ ownerName: 'Leo' });

    expect(listed.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SUP-OMEGA',
          shortName: 'Omega',
          address: 'Shenzhen Baoan 100 号',
          bankName: '招商银行深圳分行',
          bankAccount: '6222000000000100',
          remark: '长期合作',
        }),
      ]),
    );
  });
});
