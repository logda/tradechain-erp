import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { paginateItems } from '../common/pagination';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { resolveCounterpartyStore, type CounterpartyCustomFieldRecord } from './counterparty.store';

const counterpartyTypes = ['customer', 'supplier', 'both'] as const;
const counterpartyStatuses = ['active', 'inactive'] as const;
const cooperationStatuses = ['uncooperated', 'cooperated'] as const;

type CounterpartyType = (typeof counterpartyTypes)[number];
type CounterpartyStatus = (typeof counterpartyStatuses)[number];
type CooperationStatus = (typeof cooperationStatuses)[number];

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
  paymentMethod?: string;
  settlementMethod?: string;
  unitTags?: string[];
  openingReceivable?: string | null;
  payableReceivable?: string | null;
  moldFee?: string | null;
  customValues?: Record<string, string>;
  status: CounterpartyStatus;
  cooperationStatus?: CooperationStatus;
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
  cooperationStatus?: CooperationStatus;
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
  paymentMethod?: string;
  settlementMethod?: string;
  unitTags?: string[];
  openingReceivable?: string | null;
  payableReceivable?: string | null;
  moldFee?: string | null;
  customValues?: Record<string, string>;
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
    | 'paymentMethod'
    | 'settlementMethod'
    | 'unitTags'
    | 'openingReceivable'
    | 'payableReceivable'
    | 'moldFee'
    | 'customValues'
    | 'cooperationStatus'
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
  paymentMethod?: string | null;
  settlementMethod?: string | null;
  unitTags?: unknown;
  openingReceivable?: { toString(): string } | null;
  payableReceivable?: { toString(): string } | null;
  moldFee?: { toString(): string } | null;
  customValues?: unknown;
  status: string;
  cooperationStatus?: string;
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

function normalizeAmount(value: string | null | undefined, label: string) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^-?\d{1,16}(?:\.\d{1,2})?$/.test(text)) {
    throw new BadRequestException(`${label}必须是最多两位小数的数字`);
  }
  return text;
}

function normalizeTags(value: string[] | undefined) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new BadRequestException('单位标签格式不正确');
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function normalizeCustomValues(value: Record<string, string> | undefined, fields: CounterpartyCustomFieldRecord[]) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('自定义字段格式不正确');
  const byId = new Map(fields.map((field) => [String(field.id), field]));
  const result: Record<string, string> = {};
  for (const [id, raw] of Object.entries(value)) {
    const field = byId.get(id);
    if (!field) throw new BadRequestException('自定义字段已删除或不存在');
    if (typeof raw !== 'string') throw new BadRequestException(`${field.name}格式不正确`);
    const text = raw.trim();
    if (field.type === 'number' && text && !/^-?\d+(?:\.\d+)?$/.test(text)) throw new BadRequestException(`${field.name}必须填写数字`);
    if (field.type === 'date' && text && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`)) || new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text)) throw new BadRequestException(`${field.name}必须填写日期`);
    result[id] = text;
  }
  return result;
}

function readCustomValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function publicRecord(record: CounterpartyRecord, fields: CounterpartyCustomFieldRecord[]) {
  const ids = new Set(fields.map((field) => String(field.id)));
  return { ...record, cooperationStatus: record.cooperationStatus ?? 'uncooperated', customValues: Object.fromEntries(Object.entries(record.customValues ?? {}).filter(([id]) => ids.has(id))) };
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
  name: '单位简称',
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
    paymentMethod: record.paymentMethod ?? '',
    settlementMethod: record.settlementMethod ?? '',
    unitTags: Array.isArray(record.unitTags) ? record.unitTags.filter((item): item is string => typeof item === 'string') : [],
    openingReceivable: record.openingReceivable?.toString() ?? null,
    payableReceivable: record.payableReceivable?.toString() ?? null,
    moldFee: record.moldFee?.toString() ?? null,
    customValues: readCustomValues(record.customValues),
    status: record.status === 'inactive' ? 'inactive' : 'active',
    cooperationStatus: record.cooperationStatus === 'cooperated' ? 'cooperated' : 'uncooperated',
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

  async listCustomFields(): Promise<CounterpartyCustomFieldRecord[]> {
    if (this.shouldUsePrisma()) {
      const rows = await this.prisma!.counterpartyCustomField.findMany({
        where: { deletedAt: null }, orderBy: { id: 'asc' },
      });
      return rows.map((row) => ({ id: Number(row.id), name: row.name, type: row.type as CounterpartyCustomFieldRecord['type'], createdBy: row.createdBy, createdAt: row.createdAt.toISOString() }));
    }
    return this.store.listCustomFields().filter((item) => !item.deletedAt);
  }

  async createCustomField(payload: { name: string; type: string; createdBy: string }) {
    const name = normalizeText(payload.name);
    if (!name || name.length > 64) throw new BadRequestException('字段名称不能为空且不能超过 64 字');
    if (payload.type !== 'text' && payload.type !== 'number' && payload.type !== 'date') throw new BadRequestException('字段类型不合法');
    if (this.shouldUsePrisma()) {
      const row = await this.prisma!.$transaction(async (tx) => {
        const active = await tx.counterpartyCustomField.findMany({ where: { deletedAt: null } });
        if (active.length >= 10) throw new BadRequestException('自定义字段数量已达上限（10 个）');
        if (active.some((field) => field.name === name)) throw new ConflictException('自定义字段名称已存在');
        return tx.counterpartyCustomField.create({ data: { name, type: payload.type, createdBy: payload.createdBy } });
      }, { isolationLevel: 'Serializable' });
      await this.prisma!.operationLog.create({ data: { bizType: 'counterparty', bizId: row.id, operationType: 'create_counterparty_custom_field', operatorId: 0n, afterData: { name, type: payload.type } } });
      return { id: Number(row.id), name: row.name, type: row.type, createdBy: row.createdBy, createdAt: row.createdAt.toISOString() };
    }
    const active = this.store.listCustomFields().filter((field) => !field.deletedAt);
    if (active.length >= 10) throw new BadRequestException('自定义字段数量已达上限（10 个）');
    if (active.some((field) => field.name === name)) throw new ConflictException('自定义字段名称已存在');
    const field: CounterpartyCustomFieldRecord = { id: this.store.nextCustomFieldId(), name, type: payload.type, createdBy: payload.createdBy, createdAt: new Date().toISOString() };
    this.store.saveCustomFields([...this.store.listCustomFields(), field]);
    this.store.recordAuditLog({ bizType: 'counterparty', bizId: field.id, operationType: 'create_counterparty_custom_field', operatorId: 0, beforeData: null, afterData: { name, type: payload.type } });
    return field;
  }

  async deleteCustomField(id: number) {
    if (this.shouldUsePrisma()) {
      const existing = await this.prisma!.counterpartyCustomField.findUnique({ where: { id: BigInt(id) } });
      if (!existing) throw new NotFoundException('自定义字段不存在');
      if (!existing.deletedAt) {
        await this.prisma!.counterpartyCustomField.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date() } });
        await this.prisma!.operationLog.create({ data: { bizType: 'counterparty', bizId: BigInt(id), operationType: 'delete_counterparty_custom_field', operatorId: 0n, beforeData: { name: existing.name, type: existing.type }, afterData: { deleted: true } } });
      }
      return { id, deleted: true };
    }
    const fields = this.store.listCustomFields();
    const existing = fields.find((field) => field.id === id);
    if (!existing) throw new NotFoundException('自定义字段不存在');
    if (!existing.deletedAt) {
      existing.deletedAt = new Date().toISOString();
      this.store.saveCustomFields(fields);
      this.store.recordAuditLog({ bizType: 'counterparty', bizId: id, operationType: 'delete_counterparty_custom_field', operatorId: 0, beforeData: { name: existing.name, type: existing.type }, afterData: { deleted: true } });
    }
    return { id, deleted: true };
  }

  async list(query: ListCounterpartiesQuery = {}, canView?: (item: CounterpartyRecord) => boolean) {
    const customFields = await this.listCustomFields();
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
      .map((item) => publicRecord(item, customFields))
      .filter((item) => {
        if (canView && !canView(item)) return false;
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

      return record ? publicRecord(toCounterpartyRecord(record), await this.listCustomFields()) : null;
    }

    const record = this.store.getCounterparty(id);
    return record ? publicRecord(normalizeCounterpartyRecordDisplay(record), await this.listCustomFields()) : null;
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

      return record ? publicRecord(toCounterpartyRecord(record), await this.listCustomFields()) : null;
    }

    const record = this.store
      .listCounterparties()
      .find((item) => item.code === normalizedCode);

    return record ? publicRecord(normalizeCounterpartyRecordDisplay(record), await this.listCustomFields()) : null;
  }

  async create(payload: CreateCounterpartyPayload) {
    const type = normalizeText(payload.type);
    assertCounterpartyType(type);
    const cooperationStatus = payload.cooperationStatus ?? 'uncooperated';
    if (!cooperationStatuses.includes(cooperationStatus) || (type === 'customer' && cooperationStatus !== 'uncooperated')) throw new BadRequestException('供应商合作分类不合法');

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
      paymentMethod: normalizeText(payload.paymentMethod),
      settlementMethod: normalizeText(payload.settlementMethod),
      unitTags: normalizeTags(payload.unitTags),
      openingReceivable: normalizeAmount(payload.openingReceivable, '期初应收款'),
      payableReceivable: normalizeAmount(payload.payableReceivable, '应付应收款'),
      moldFee: normalizeAmount(payload.moldFee, '模具费用'),
    };
    const customFields = await this.listCustomFields();
    const customValues = normalizeCustomValues(payload.customValues, customFields);

    assertRequiredFormalCounterpartyFields(formalFields);
    if (!this.shouldUsePrisma()) this.assertCodeIsUnique(formalFields.code);

    if (this.shouldUsePrisma()) {
      await this.assertPrismaCodeIsUnique(formalFields.code);
      const record = (await this.prisma!.counterparty.create({
        data: {
          type,
          ...formalFields,
          ...optionalFields,
          customValues,
          email: normalizeOptionalText(payload.email),
          paymentTerms: normalizeOptionalText(payload.paymentTerms),
          status: 'active',
          cooperationStatus,
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
            cooperationStatus: record.cooperationStatus,
          },
        },
      });

      return publicRecord(toCounterpartyRecord(record), customFields);
    }

    const record: CounterpartyRecord = {
      id: this.store.nextCounterpartyId(),
      type,
      ...formalFields,
      ...optionalFields,
      customValues,
      email: normalizeText(payload.email),
      paymentTerms: normalizeText(payload.paymentTerms),
      status: 'active',
      cooperationStatus,
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
        cooperationStatus: record.cooperationStatus,
      },
    });
    return publicRecord(record, customFields);
  }

  async update(id: number, payload: UpdateCounterpartyPayload) {
    const customFields = await this.listCustomFields();
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

      const data: Record<string, any> = {
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

      for (const field of ['email', 'paymentTerms', 'paymentMethod', 'settlementMethod'] as const) {
        if (payload[field] !== undefined) {
          data[field] = normalizeText(payload[field]);
        }
      }

      if (payload.unitTags !== undefined) data.unitTags = normalizeTags(payload.unitTags);
      for (const field of ['openingReceivable', 'payableReceivable', 'moldFee'] as const) {
        if (payload[field] !== undefined) data[field] = normalizeAmount(payload[field], field === 'moldFee' ? '模具费用' : field === 'openingReceivable' ? '期初应收款' : '应付应收款');
      }
      if (payload.customValues !== undefined) {
        data.customValues = { ...readCustomValues(existing.customValues), ...normalizeCustomValues(payload.customValues, customFields) };
      }
      if (payload.cooperationStatus !== undefined) {
        if (existing.type === 'customer' || !cooperationStatuses.includes(payload.cooperationStatus)) throw new BadRequestException('供应商合作分类不合法');
        data.cooperationStatus = payload.cooperationStatus;
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

      return publicRecord(toCounterpartyRecord(updated), customFields);
    }

    const record = this.store.getCounterparty(id);

    if (!record) {
      throw new NotFoundException('往来单位不存在');
    }

    const beforeRecord = { ...record, customValues: { ...record.customValues } };
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

    if (payload.paymentMethod !== undefined) record.paymentMethod = normalizeText(payload.paymentMethod);
    if (payload.settlementMethod !== undefined) record.settlementMethod = normalizeText(payload.settlementMethod);
    if (payload.unitTags !== undefined) record.unitTags = normalizeTags(payload.unitTags);
    for (const field of ['openingReceivable', 'payableReceivable', 'moldFee'] as const) {
      if (payload[field] !== undefined) record[field] = normalizeAmount(payload[field], field === 'moldFee' ? '模具费用' : field === 'openingReceivable' ? '期初应收款' : '应付应收款');
    }
    if (payload.customValues !== undefined) record.customValues = { ...record.customValues, ...normalizeCustomValues(payload.customValues, customFields) };
    if (payload.cooperationStatus !== undefined) {
      if (record.type === 'customer' || !cooperationStatuses.includes(payload.cooperationStatus)) throw new BadRequestException('供应商合作分类不合法');
      record.cooperationStatus = payload.cooperationStatus;
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

    return publicRecord(record, customFields);
  }

  async markSupplierCooperated(payload: { supplierId: number; supplierName: string; ownerName: string; shipmentId: number }) {
    const name = payload.supplierName.trim();
    if (!name) throw new BadRequestException('采购单供应商名称不能为空');
    let supplier: CounterpartyRecord | null = payload.supplierId > 0 ? await this.findById(payload.supplierId) : null;
    if (supplier && supplier.type === 'customer') supplier = null;
    if (!supplier) {
      if (this.shouldUsePrisma()) {
        const matched = await this.prisma!.counterparty.findFirst({ where: { name, type: { in: ['supplier', 'both'] } }, orderBy: { id: 'asc' } });
        supplier = matched ? toCounterpartyRecord(matched as PrismaCounterpartyRecord) : null;
      } else {
        supplier = this.store.listCounterparties().find((item) => item.name === name && (item.type === 'supplier' || item.type === 'both')) ?? null;
      }
    }
    if (supplier) {
      if (supplier.cooperationStatus !== 'cooperated') await this.update(supplier.id, { cooperationStatus: 'cooperated', updatedBy: 'system' });
      return supplier.id;
    }
    const created = await this.create({ type: 'supplier', code: `SUP-SH-${payload.shipmentId}`, name, shortName: '', region: '', ownerName: payload.ownerName.trim(), contactName: '', phone: '', address: '', bankName: '', bankAccount: '', remark: '', cooperationStatus: 'cooperated', createdBy: 'system' });
    return created.id;
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
        return publicRecord(toCounterpartyRecord(record), await this.listCustomFields());
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

      return publicRecord(toCounterpartyRecord(updated), await this.listCustomFields());
    }

    const record = this.store.getCounterparty(id);

    if (!record) {
      throw new NotFoundException('往来单位不存在');
    }

    if (record.status === 'inactive') {
      return publicRecord(record, await this.listCustomFields());
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

    return publicRecord(record, await this.listCustomFields());
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
        return publicRecord(toCounterpartyRecord(record), await this.listCustomFields());
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

      return publicRecord(toCounterpartyRecord(updated), await this.listCustomFields());
    }

    const record = this.store.getCounterparty(id);

    if (!record) {
      throw new NotFoundException('往来单位不存在');
    }

    if (record.status === 'active') {
      return publicRecord(record, await this.listCustomFields());
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

    return publicRecord(record, await this.listCustomFields());
  }

  async listAuditLogs() {
    const activeIds = new Set((await this.listCustomFields()).map((field) => String(field.id)));
    const scrub = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const object = value as Record<string, unknown>;
      if (!('customValues' in object)) return value;
      return { ...object, customValues: Object.fromEntries(Object.entries(readCustomValues(object.customValues)).filter(([id]) => activeIds.has(id))) };
    };
    if (this.shouldUsePrisma()) {
      const logs = (await this.prisma!.operationLog.findMany({
        where: { bizType: 'counterparty' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })) as PrismaOperationLogRecord[];

      return {
        items: logs.map(toAuditLogRecord).map((item) => ({ ...item, beforeData: scrub(item.beforeData), afterData: scrub(item.afterData) })),
      };
    }

    return {
      items: this.store.listAuditLogs().map((item) => ({ ...item, beforeData: scrub(item.beforeData), afterData: scrub(item.afterData) })),
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
