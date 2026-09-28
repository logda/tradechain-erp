import { BadRequestException } from '@nestjs/common';

export function parseAuditBizId(value: string | undefined) {
  if (value === undefined) return undefined;
  const id = Number(value);
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) {
    throw new BadRequestException('日志单据 ID 必须为正整数');
  }
  return id;
}
