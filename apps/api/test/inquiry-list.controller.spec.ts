import { Test } from '@nestjs/testing';
import { InquiryController } from '../src/inquiry/inquiry.controller';
import { InquiryService } from '../src/inquiry/inquiry.service';

describe('InquiryController list', () => {
  it('delegates inquiry detail loading to InquiryService', async () => {
    const getById = jest.fn().mockResolvedValue({
      id: 13,
      inquiryNo: 'IQ202607080013',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [InquiryController],
      providers: [{ provide: InquiryService, useValue: { getById } }],
    }).compile();

    const controller = moduleRef.get(InquiryController);
    const result = await controller.getById(13, 'admin', 'Admin');

    expect(getById).toHaveBeenCalledWith(13, {
      role: 'admin',
      user: 'Admin',
    });
    expect(result).toEqual({
      id: 13,
      inquiryNo: 'IQ202607080013',
    });
  });

  it('normalizes list query params before forwarding them', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [InquiryController],
      providers: [{ provide: InquiryService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(InquiryController);
    const result = await controller.list({
      keyword: 'Acme',
      status: 'pending_inquiry',
      page: '2',
      pageSize: '5',
    });

    expect(list).toHaveBeenCalledWith({
      keyword: 'Acme',
      status: 'pending_inquiry',
      page: 2,
      pageSize: 5,
    }, undefined);
    expect(result.page).toBe(2);
  });

  it('falls back to safe defaults for invalid status and pagination params', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [InquiryController],
      providers: [{ provide: InquiryService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(InquiryController);
    await controller.list({
      status: 'bogus' as 'all',
      page: 'NaN',
      pageSize: '0',
    });

    expect(list).toHaveBeenCalledWith({
      status: 'all',
      page: 1,
      pageSize: 20,
    }, undefined);
  });

  it('delegates audit log loading to InquiryService', async () => {
    const listAuditLogs = jest.fn().mockResolvedValue({ items: [] });
    const moduleRef = await Test.createTestingModule({
      controllers: [InquiryController],
      providers: [{ provide: InquiryService, useValue: { listAuditLogs } }],
    }).compile();

    const controller = moduleRef.get(InquiryController);
    const result = await controller.listAuditLogs('purchase', 'Leo');

    expect(listAuditLogs).toHaveBeenCalledWith({
      role: 'purchase',
      user: 'Leo',
    });
    expect(result).toEqual({ items: [] });
  });
});
