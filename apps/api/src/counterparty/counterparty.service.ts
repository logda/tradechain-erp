import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { paginateItems } from '../common/pagination';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { resolveCounterpartyStore } from './counterparty.store';

const counterpartyTypes = ['customer', 'supplier', 'both'] as const;
const counterpartyStatuses = ['active', 'inactive'] as const;

type CounterpartyType = (typeof counterpartyTypes)[number];
type CounterpartyStatus = (typeof counterpartyStatuses)[number];

export type CounterpartyRecord = {
  id: number;
  type: CounterpartyType;
  code: string;
  name: string;
  shortName: string;
  region: string;
  ownerName: string;
  contactName: string;
  phone: string;
  address: string;
  bankName: string;
  bankAccount: string;
  remark: string;
  email: string;
  paymentTerms: string;
  status: CounterpartyStatus;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivatedReason?: string;
};

export type ListCounterpartiesQuery = {
  type?: string;
  status?: string;
  keyword?: string;
  ownerName?: string;
  page?: string | number;
  pageSize?: string | number;
};

export type CreateCounterpartyPayload = {
  type: string;
  code: string;
  name: string;
  shortName: string;
  region: string;
  ownerName: string;
  contactName: string;
  phone: string;
  address: string;
  bankName: string;
  bankAccount: string;
  remark: string;
  email?: string;
  paymentTerms?: string;
  createdBy: string;
};

export type UpdateCounterpartyPayload = Partial<
  Pick<
    CounterpartyRecord,
    | 'type'
    | 'code'
    | 'name'
    | 'shortName'
    | 'region'
    | 'ownerName'
    | 'contactName'
    | 'phone'
    | 'address'
    | 'bankName'
    | 'bankAccount'
    | 'remark'
    | 'email'
    | 'paymentTerms'
  >
> & {
  updatedBy: string;
};

type PrismaCounterpartyRecord = {
  id: bigint;
  type: string;
  code: string;
  name: string;
  shortName: string | null;
  region: string | null;
  ownerName: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  bankName: string | null;
  bankAccount: string | null;
  remark: string | null;
  email: string | null;
  paymentTerms: string | null;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date;
  deactivatedAt: Date | null;
  deactivatedBy: string | null;
  deactivatedReason: string | null;
};

type PrismaOperationLogRecord = {
  id: bigint;
  bizType: string;
  bizId: bigint;
  operationType: string;
  operatorId: bigint;
  beforeData: unknown | null;
  afterData: unknown | null;
  createdAt: Date;
};

type PrismaCounterpartyDb = PrismaService & {
  counterparty?: {
    findUnique: (...args: any[]) => Promise<unknown>;
  };
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeText(value: string | undefined) {
  return value?.trim() ?? '';
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = normalizeText(value);
  return normalized || null;
}

const defaultChineseNamesByCode: Record<string, string> = {
  'CP-GLOBAL': '环球伙伴',
  'CUS-ACME': '星河贸易',
  'CUST-ACME': '星河贸易',
  'SUP-BRAVO': '光源制造',
  'SUP-LIGHT': '光源制造',
};

function resolveCounterpartyShortName(code: string, shortName: string | null | undefined) {
  const normalizedShortName = shortName?.trim() ?? '';
  return normalizedShortName || defaultChineseNamesByCode[normalizeCode(code)] || '';
}

function assertCounterpartyType(value: string): asserts value is CounterpartyType {
  if (!counterpartyTypes.includes(value as CounterpartyType)) {
    throw new BadRequestException('往来单位类型不合法');
  }
}

function isCounterpartyType(value: string | undefined): value is CounterpartyType {
  return counterpartyTypes.includes(value as CounterpartyType);
}

function isCounterpartyStatus(value: string | undefined): value is CounterpartyStatus {
  return counterpartyStatuses.includes(value as CounterpartyStatus);
}

const formalCounterpartyFieldLabels = {
  code: '单位编码',
  name: '单位名称',
  ownerName: '所属人员',
} satisfies Record<string, string>;

type FormalCounterpartyFieldKey = keyof typeof formalCounterpartyFieldLabels;

function assertRequiredFormalCounterpartyFields(
  values: Record<FormalCounterpartyFieldKey, string>,
) {
  const missingFields = (Object.keys(formalCounterpartyFieldLabels) as FormalCounterpartyFieldKey[])
    .filter((key) => !values[key])
    .map((key) => formalCounterpartyFieldLabels[key]);

  if (missingFields.length > 0) {
    throw new BadRequestException(
      `请完整填写以下必填项：${missingFields.join('、')}`,
    );
  }
}

function buildRequiredFormalCounterpartyFields(
  values: Record<FormalCounterpartyFieldKey, string | undefined>,
) {
  return {
    code: normalizeCode(values.code ?? ''),
    name: normalizeText(values.name),
    ownerName: normalizeText(values.ownerName),
  } satisfies Record<FormalCounterpartyFieldKey, string>;
}

function toCounterpartyRecord(record: PrismaCounterpartyRecord): CounterpartyRecord {
  return {
    id: Number(record.id),
    type: isCounterpartyType(record.type) ? record.type : 'customer',
    code: record.code,
    name: record.name,
    shortName: resolveCounterpartyShortName(record.code, record.shortName),
    region: record.region ?? '',
    ownerName: record.ownerName,
    contactName: record.contactName ?? '',
    phone: record.phone ?? '',
    address: record.address ?? '',
    bankName: record.bankName ?? '',
    bankAccount: record.bankAccount ?? '',
    remark: record.remark ?? '',
    email: record.email ?? '',
    paymentTerms: record.paymentTerms ?? '',
    status: record.status === 'inactive' ? 'inactive' : 'active',
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    ...(record.updatedAt ? { updatedAt: record.updatedAt.toISOString() } : {}),
    ...(record.updatedBy ? { updatedBy: record.updatedBy } : {}),
    ...(record.deactivatedAt
      ? { deactivatedAt: record.deactivatedAt.toISOString() }
      : {}),
    ...(record.deactivatedBy ? { deactivatedBy: record.deactivatedBy } : {}),
    ...(record.deactivatedReason
      ? { deactivatedReason: record.deactivatedReason }
      : {}),
  };
}

function toAuditLogRecord(record: PrismaOperationLogRecord) {
  return {
    id: Number(record.id),
    bizType: record.bizType,
    bizId: Number(record.bizId),
    operationType: record.operationType,
    operatorId: Number(record.operatorId),
    beforeData: record.beforeData,
    afterData: record.afterData,
    createdAt: record.createdAt.toISOString(),
  };
}

function normalizeCounterpartyRecordDisplay(record: CounterpartyRecord) {
  return {
    ...record,
    shortName: resolveCounterpartyShortName(record.code, record.shortName),
  };
}

@Injectable()
export class CounterpartyService {
  private readonly store = resolveCounterpartyStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  async list(query: ListCounterpartiesQuery = {}) {
    const type = isCounterpartyType(query.type) ? query.type : null;
    const status = isCounterpartyStatus(query.status) ? query.status : null;
    const keyword = normalizeText(query.keyword).toLowerCase();
    const ownerName = normalizeText(query.ownerName).toLowerCase();

    const sourceItems = this.shouldUsePrisma()
      ? ((await this.prisma!.counterparty.findMany({
          orderBy: { code: 'asc' },
        })) as PrismaCounterpartyRecord[]).map(toCounterpartyRecord)
      : this.store.listCounterparties();

    const items = sourceItems
      .map(normalizeCounterpartyRecordDisplay)
      .filter((item) => {
        if (type && item.type !== type && item.type !== 'both') {
          return false;
        }

        if (status && item.status !== status) {
          return false;
        }

        if (
          keyword &&
          ![
            item.code,
            item.name,
            item.shortName,
            item.ownerName,
            item.contactName,
            item.phone,
            item.region,
            item.address,
            item.bankName,
            item.bankAccount,
            item.remark,
            item.email,
            item.paymentTerms,
          ]
            .join(' ')
            .toLowerCase()
            .includes(keyword)
        ) {
          return false;
        }

        if (ownerName && item.ownerName.toLowerCase() !== ownerName) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.code.localeCompare(right.code));

    return paginateItems(items, query.page ?? 1, query.pageSize ?? 20);
  }

  async findById(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }

    const prismaDb = this.prisma as PrismaCounterpartyDb | undefined;

    if (this.shouldUsePrisma() && prismaDb?.counterparty?.findUnique) {
      const record = (await prismaDb.counterparty.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaCounterpartyRecord | null;

      return record ? toCounterpartyRecord(record) : null;
    }

    const record = this.store.getCounterparty(id);
    return record ? normalizeCounterpartyRecordDisplay(record) : null;
  }

  async findByCode(code: string) {
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) {
      return null;
    }

    if (this.shouldUsePrisma()) {
      const record = (await this.prisma!.counterparty.findUnique({
        where: { code: normalizedCode },
      })) as PrismaCounterpartyRecord | null;

      return record ? toCounterpartyRecord(record) : null;
    }

    const record = this.store
      .listCounterparties()
      .find((item) => item.code === normalizedCode);

    return record ? normalizeCounterpartyRecordDisplay(record) : null;
  }

  async create(payload: CreateCounterpartyPayload) {
    const type = normalizeText(payload.type);
    assertCounterpartyType(type);

    const formalFields = buildRequiredFormalCounterpartyFields(payload);
    const optionalFields = {
      shortName: normalizeText(payload.shortName),
      region: normalizeText(payload.region),
      contactName: normalizeText(payload.contactName),
      phone: normalizeText(payload.phone),
      address: normalizeText(payload.address),
      bankName: normalizeText(payload.bankName),
      bankAccount: normalizeText(payload.bankAccount),
      remark: normalizeText(payload.remark),
    };

    assertRequiredFormalCounterpartyFields(formalFields);
    this.assertCodeIsUnique(formalFields.code);

    if (this.shouldUsePrisma()) {
      await this.assertPrismaCodeIsUnique(formalFields.code);
      const record = (await this.prisma!.counterparty.create({
        data: {
          type,
          ...formalFields,
          ...optionalFields,
          email: normalizeOptionalText(payload.email),
          paymentTerms: normalizeOptionalText(payload.paymentTerms),
          status: 'active',
          createdBy: normalizeText(payload.createdBy) || 'system',
        },
      })) as PrismaCounterpartyRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'counterparty',
          bizId: record.id,
          operationType: 'create_counterparty',
          operatorId: 0n,
          beforeData: undefined,
          afterData: {
            type: record.type,
            code: record.code,
            name: record.name,
            shortName: record.shortName,
            region: record.region,
            ownerName: record.ownerName,
            contactName: record.contactName,
            phone: record.phone,
            address: record.address,
            bankName: record.bankName,
            bankAccount: record.bankAccount,
            remark: record.remark,
            status: record.status,
          },
        },
      });

      return toCounterpartyRecord(record);
    }

    const record: CounterpartyRecord = {
      id: this.store.nextCounterpartyId(),
      type,
      ...formalFields,
      ...optionalFields,
      email: normalizeText(payload.email),
      paymentTerms: normalizeText(payload.paymentTerms),
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: normalizeText(payload.createdBy) || 'system',
    };

    this.store.saveCounterparties([...this.store.listCounterparties(), record]);
    this.store.recordAuditLog({
      bizType: 'counterparty',
      bizId: record.id,
      operationType: 'create_counterparty',
      operatorId: 0,
      beforeData: null,
      afterData: {
        type: record.type,
        code: record.code,
        name: record.name,
        shortName: record.shortName,
        region: record.region,
        ownerName: record.ownerName,
        contactName: record.contactName,
        phone: record.phone,
        address: record.address,
        bankName: record.bankName,
        bankAccount: record.bankAccount,
        remark: record.remark,
        status: record.status,
      },
    });
    return record;
  }

  async update(id: number, payload: UpdateCounterpartyPayload) {
    if (this.shouldUsePrisma()) {
      const existing = (await this.prisma!.counterparty.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaCounterpartyRecord | null;

      if (!existing) {
        throw new NotFoundException('往来单位不存在');
      }

      const requiredFormalFields = buildRequiredFormalCounterpartyFields({
        code: payload.code ?? existing.code,
        name: payload.name ?? existing.name,
        ownerName: payload.ownerName ?? existing.ownerName,
      });
      assertRequiredFormalCounterpartyFields(requiredFormalFields);

      const data: Record<string, string> = {
        updatedBy: normalizeText(payload.updatedBy) || 'system',
      };

      if (payload.type !== undefined) {
        const type = normalizeText(payload.type);
        assertCounterpartyType(type);
        data.type = type;
      }

      if (payload.code !== undefined) {
        const code = requiredFormalFields.code;
        await this.assertPrismaCodeIsUnique(code, id);
        data.code = code;
      }

      if (payload.name !== undefined) {
        const name = requiredFormalFields.name;
        data.name = name;
      }

      if (payload.shortName !== undefined) {
        const shortName = normalizeText(payload.shortName);
        data.shortName = shortName;
      }

      if (payload.region !== undefined) {
        const region = normalizeText(payload.region);
        data.region = region;
      }

      if (payload.ownerName !== undefined) {
        const ownerName = requiredFormalFields.ownerName;
        data.ownerName = ownerName;
      }

      for (const field of [
        'contactName',
        'phone',
        'address',
        'bankName',
        'bankAccount',
        'remark',
      ] as const) {
        if (payload[field] !== undefined) {
          const value = normalizeText(payload[field]);
          data[field] = value;
        }
      }

      for (const field of ['email', 'paymentTerms'] as const) {
        if (payload[field] !== undefined) {
          data[field] = normalizeText(payload[field]);
        }
      }

      const updated = (await this.prisma!.counterparty.update({
        where: { id: BigInt(id) },
        data,
      })) as PrismaCounterpartyRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'counterparty',
          bizId: updated.id,
          operationType: 'update_counterparty',
          operatorId: 0n,
          beforeData: toCounterpartyRecord(existing),
          afterData: toCounterpartyRecord(updated),
        },
      });

      return toCounterpartyRecord(updated);
    }

    const record = this.store.getCounterparty(id);

    if (!record) {
      throw new NotFoundException('往来单位不存在');
    }

    const beforeRecord = { ...record };
    const requiredFormalFields = buildRequiredFormalCounterpartyFields({
      code: payload.code ?? record.code,
      name: payload.name ?? record.name,
      ownerName: payload.ownerName ?? record.ownerName,
    });
    assertRequiredFormalCounterpartyFields(requiredFormalFields);

    if (payload.type !== undefined) {
      const type = normalizeText(payload.type);
      assertCounterpartyType(type);
      record.type = type;
    }

    if (payload.code !== undefined) {
      const code = requiredFormalFields.code;
      this.assertCodeIsUnique(code, id);
      record.code = code;
    }

    if (payload.name !== undefined) {
      record.name = requiredFormalFields.name;
    }

    if (payload.shortName !== undefined) {
      record.shortName = normalizeText(payload.shortName);
    }

    if (payload.region !== undefined) {
      record.region = normalizeText(payload.region);
    }

    if (payload.ownerName !== undefined) {
      record.ownerName = requiredFormalFields.ownerName;
    }

    if (payload.contactName !== undefined) {
      record.contactName = normalizeText(payload.contactName);
    }

    if (payload.phone !== undefined) {
      record.phone = normalizeText(payload.phone);
    }

    if (payload.address !== undefined) {
      record.address = normalizeText(payload.address);
    }

    if (payload.bankName !== undefined) {
      record.bankName = normalizeText(payload.bankName);
    }

    if (payload.bankAccount !== undefined) {
      record.bankAccount = normalizeText(payload.bankAccount);
    }

    if (payload.remark !== undefined) {
      record.remark = normalizeText(payload.remark);
    }

    if (payload.email !== undefined) {
      record.email = normalizeText(payload.email);
    }

    if (payload.paymentTerms !== undefined) {
      record.paymentTerms = normalizeText(payload.paymentTerms);
    }

    record.updatedAt = new Date().toISOString();
    record.updatedBy = normalizeText(payload.updatedBy) || 'system';

    const nextCounterparties = this.store
      .listCounterparties()
      .map((item) => (item.id === id ? record : item));
    this.store.saveCounterparties(nextCounterparties);
    this.store.recordAuditLog({
      bizType: 'counterparty',
      bizId: record.id,
      operationType: 'update_counterparty',
      operatorId: 0,
      beforeData: beforeRecord,
      afterData: record,
    });

    return record;
  }

  async deactivate(
    id: number,
    payload: {
      operatedBy: string;
      reason: string;
    },
  ) {
    if (this.shouldUsePrisma()) {
      const record = (await this.prisma!.counterparty.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaCounterpartyRecord | null;

      if (!record) {
        throw new NotFoundException('往来单位不存在');
      }

      if (record.status === 'inactive') {
        return toCounterpartyRecord(record);
      }

      const updated = (await this.prisma!.counterparty.update({
        where: { id: record.id },
        data: {
          status: 'inactive',
          deactivatedAt: new Date(),
          deactivatedBy: normalizeText(payload.operatedBy) || 'system',
          deactivatedReason: normalizeText(payload.reason) || '停用往来单位',
        },
      })) as PrismaCounterpartyRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'counterparty',
          bizId: updated.id,
          operationType: 'deactivate_counterparty',
          operatorId: 0n,
          beforeData: {
            status: record.status,
            deactivatedAt: record.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: record.deactivatedBy,
            deactivatedReason: record.deactivatedReason,
          },
          afterData: {
            status: updated.status,
            deactivatedAt: updated.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: updated.deactivatedBy,
            deactivatedReason: updated.deactivatedReason,
          },
        },
      });

      return toCounterpartyRecord(updated);
    }

    const record = this.store.getCounterparty(id);

    if (!record) {
      throw new NotFoundException('往来单位不存在');
    }

    if (record.status === 'inactive') {
      return record;
    }

    const beforeRecord = { ...record };
    record.status = 'inactive';
    record.deactivatedAt = new Date().toISOString();
    record.deactivatedBy = normalizeText(payload.operatedBy) || 'system';
    record.deactivatedReason = normalizeText(payload.reason) || '停用往来单位';

    this.store.saveCounterparties(
      this.store.listCounterparties().map((item) =>
        item.id === id ? record : item,
      ),
    );
    this.store.recordAuditLog({
      bizType: 'counterparty',
      bizId: record.id,
      operationType: 'deactivate_counterparty',
      operatorId: 0,
      beforeData: beforeRecord,
      afterData: record,
    });

    return record;
  }

  async activate(
    id: number,
    payload: {
      operatedBy: string;
      reason: string;
    },
  ) {
    if (this.shouldUsePrisma()) {
      const record = (await this.prisma!.counterparty.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaCounterpartyRecord | null;

      if (!record) {
        throw new NotFoundException('往来单位不存在');
      }

      if (record.status === 'active') {
        return toCounterpartyRecord(record);
      }

      const updated = (await this.prisma!.counterparty.update({
        where: { id: record.id },
        data: {
          status: 'active',
          deactivatedAt: null,
          deactivatedBy: null,
          deactivatedReason: null,
        },
      })) as PrismaCounterpartyRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'counterparty',
          bizId: updated.id,
          operationType: 'activate_counterparty',
          operatorId: 0n,
          beforeData: {
            status: record.status,
            deactivatedAt: record.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: record.deactivatedBy,
            deactivatedReason: record.deactivatedReason,
          },
          afterData: {
            status: updated.status,
            operatedBy: normalizeText(payload.operatedBy) || 'system',
            reason: normalizeText(payload.reason) || '重新启用往来单位',
          },
        },
      });

      return toCounterpartyRecord(updated);
    }

    const record = this.store.getCounterparty(id);

    if (!record) {
      throw new NotFoundException('往来单位不存在');
    }

    if (record.status === 'active') {
      return record;
    }

    const beforeRecord = { ...record };
    record.status = 'active';
    delete record.deactivatedAt;
    delete record.deactivatedBy;
    delete record.deactivatedReason;

    this.store.saveCounterparties(
      this.store.listCounterparties().map((item) =>
        item.id === id ? record : item,
      ),
    );
    this.store.recordAuditLog({
      bizType: 'counterparty',
      bizId: record.id,
      operationType: 'activate_counterparty',
      operatorId: 0,
      beforeData: beforeRecord,
      afterData: {
        ...record,
        operatedBy: normalizeText(payload.operatedBy) || 'system',
        reason: normalizeText(payload.reason) || '重新启用往来单位',
      },
    });

    return record;
  }

  async listAuditLogs() {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prisma!.operationLog.findMany({
        where: { bizType: 'counterparty' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })) as PrismaOperationLogRecord[];

      return {
        items: logs.map(toAuditLogRecord),
      };
    }

    return {
      items: this.store.listAuditLogs(),
    };
  }

  private assertCodeIsUnique(code: string, currentId?: number) {
    const duplicated = this.store.listCounterparties().some(
      (item) => item.code === code && item.id !== currentId,
    );

    if (duplicated) {
      throw new BadRequestException('往来单位编码已存在');
    }
  }

  private async assertPrismaCodeIsUnique(code: string, currentId?: number) {
    const duplicated = (await this.prisma!.counterparty.findUnique({
      where: { code },
    })) as PrismaCounterpartyRecord | null;

    if (duplicated && Number(duplicated.id) !== currentId) {
      throw new BadRequestException('往来单位编码已存在');
    }
  }
}
