import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InquiryService } from '../src/inquiry/inquiry.service';

describe('询价待老板确认阶段', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-stage06-inquiry-'));
    process.env.ERP_DATA_DIR = runtimeDir;
    delete process.env.ERP_STORAGE_MODE;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('锁定已提交的供应商资料，驳回后才能重新询价且重复驳回不推进', async () => {
    const service = new InquiryService();
    const changedQuotes = [
      { supplierSourceMode: 'manual' as const, supplierName: '新供应商甲', purchasePrice: 18 },
      { supplierSourceMode: 'manual' as const, supplierName: '新供应商乙', purchasePrice: 20 },
    ];
    const changed = { inquiryId: 2, items: [{ itemId: 11, supplierQuotes: changedQuotes }] };

    await expect(service.submitForComparison(changed)).rejects.toThrow('只有待询价状态');
    expect((await service.getById(2)).items[0]?.supplierQuotes[0]?.supplierName).not.toBe('新供应商甲');

    await expect(service.rejectByBoss(2, { role: 'boss', user: 'Mia' })).resolves.toMatchObject({
      id: 2,
      status: 'pending_inquiry',
    });
    await expect(service.rejectByBoss(2, { role: 'boss', user: 'Mia' })).rejects.toThrow('只有待老板确认状态');
    expect((await service.list({ status: 'pending_boss_review' })).items.some((item) => item.id === 2)).toBe(false);

    await expect(service.submitForComparison(changed)).resolves.toMatchObject({ status: 'pending_boss_review' });
    expect((await service.getById(2)).items[0]?.supplierQuotes[0]?.supplierName).toBe('新供应商甲');
    await expect(service.submitForComparison(changed)).rejects.toThrow('只有待询价状态');
  });
});
