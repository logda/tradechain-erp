import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  buildSalesOrderAttachmentUploadKey,
  buildFormalQuoteAttachmentUploadKey,
  buildFormalQuoteUploadKey,
  buildPublicFileUrl,
  normalizeStorageRelativePath,
  resolveFormalQuoteAttachmentUploadRoot,
  resolveFormalQuoteUploadRoot,
  resolveSalesOrderAttachmentUploadRoot,
} from './file-storage.config';

type StoredUploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export function normalizeUploadedFileName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '未命名附件';
  }

  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed;
  }

  const decoded = Buffer.from(trimmed, 'latin1').toString('utf8');
  if (decoded.includes('\uFFFD')) {
    return trimmed;
  }

  if (/[\u4e00-\u9fff]/.test(decoded)) {
    return decoded;
  }

  if (/[ÃÂæäåçèéïðœ]/.test(trimmed) && decoded !== trimmed) {
    return decoded;
  }

  return trimmed;
}

@Injectable()
export class FileStorageService {
  private async saveUploadedFiles(
    files: StoredUploadFile[],
    fallbackBaseUrl: string,
    uploadRoot: string,
    buildUploadKey: (absolutePath: string) => string,
  ) {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dayRoot = join(uploadRoot, year, month, day);

    await mkdir(dayRoot, { recursive: true });

    return Promise.all(
      files.map(async (file) => {
        const originalFileName = normalizeUploadedFileName(file.originalname);
        const fileName = `${randomUUID()}${extname(originalFileName) || '.bin'}`;
        const absolutePath = join(dayRoot, fileName);

        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, file.buffer);

        const key = buildUploadKey(absolutePath);
        const pathname = normalizeStorageRelativePath(`/uploads/${key}`);

        return {
          key,
          fileName: originalFileName,
          mimeType: file.mimetype,
          size: file.size,
          url: buildPublicFileUrl(pathname, fallbackBaseUrl),
        };
      }),
    );
  }

  async saveFormalQuoteImages(
    files: StoredUploadFile[],
    fallbackBaseUrl: string,
  ) {
    return this.saveUploadedFiles(
      files,
      fallbackBaseUrl,
      resolveFormalQuoteUploadRoot(),
      buildFormalQuoteUploadKey,
    );
  }

  async saveFormalQuoteAttachments(
    files: StoredUploadFile[],
    fallbackBaseUrl: string,
  ) {
    return this.saveUploadedFiles(
      files,
      fallbackBaseUrl,
      resolveFormalQuoteAttachmentUploadRoot(),
      buildFormalQuoteAttachmentUploadKey,
    );
  }

  async saveSalesOrderAttachments(
    files: StoredUploadFile[],
    fallbackBaseUrl: string,
  ) {
    return this.saveUploadedFiles(
      files,
      fallbackBaseUrl,
      resolveSalesOrderAttachmentUploadRoot(),
      buildSalesOrderAttachmentUploadKey,
    );
  }
}
