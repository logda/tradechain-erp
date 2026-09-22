import { BadRequestException, Injectable } from '@nestjs/common';
import {
  resolveQuoteSourceStore,
  type QuoteSourceRecord,
} from './quote-source.store';

export type UpdateQuoteSourcesPayload = {
  items: Array<{
    code: string;
    label: string;
    enabled?: boolean;
    sortOrder?: number;
  }>;
  updatedBy: string;
};

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}

function normalizeLabel(value: string) {
  return value.trim();
}

@Injectable()
export class QuoteSourceService {
  private readonly store = resolveQuoteSourceStore();

  list() {
    return {
      items: this.store
        .list()
        .sort((left, right) => left.sortOrder - right.sortOrder),
    };
  }

  update(payload: UpdateQuoteSourcesPayload) {
    const updatedBy = payload.updatedBy.trim() || 'system';
    const items = payload.items.map((item, index) => {
      const code = normalizeCode(item.code);
      const label = normalizeLabel(item.label);

      if (!code || !label) {
        throw new BadRequestException('来源编码和来源名称不能为空');
      }

      return {
        code,
        label,
        enabled: item.enabled !== false,
        sortOrder:
          typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder)
            ? item.sortOrder
            : index + 1,
        updatedAt: new Date().toISOString(),
        updatedBy,
      } satisfies QuoteSourceRecord;
    });

    const deduplicated = new Set<string>();
    items.forEach((item) => {
      if (deduplicated.has(item.code)) {
        throw new BadRequestException(`来源编码重复: ${item.code}`);
      }

      deduplicated.add(item.code);
    });

    return {
      items: this.store.save(items).sort((left, right) => left.sortOrder - right.sortOrder),
    };
  }
}
