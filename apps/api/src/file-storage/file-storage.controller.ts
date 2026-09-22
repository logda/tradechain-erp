import {
  Controller,
  Inject,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  FormalActions,
  FormalModules,
  FormalRoles,
} from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { resolveRequestBaseUrl } from './file-storage.config';
import { FileStorageService } from './file-storage.service';

type StoredUploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('files')
@UseGuards(FormalRoleGuard)
@FormalModules('sales')
export class FileStorageController {
  constructor(
    @Inject(FileStorageService)
    private readonly fileStorageService: FileStorageService,
  ) {}

  @Post('formal-quote-images')
  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.quote.write')
  @UseInterceptors(FilesInterceptor('files', 20))
  async uploadFormalQuoteImages(
    @UploadedFiles() files: StoredUploadFile[],
    @Req()
    request: {
      headers?: Record<string, string | string[] | undefined>;
    },
  ) {
    return {
      items: await this.fileStorageService.saveFormalQuoteImages(
        files ?? [],
        resolveRequestBaseUrl(request),
      ),
    };
  }

  @Post('formal-quote-attachments')
  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.quote.write')
  @UseInterceptors(FilesInterceptor('files', 20))
  async uploadFormalQuoteAttachments(
    @UploadedFiles() files: StoredUploadFile[],
    @Req()
    request: {
      headers?: Record<string, string | string[] | undefined>;
    },
  ) {
    return {
      items: await this.fileStorageService.saveFormalQuoteAttachments(
        files ?? [],
        resolveRequestBaseUrl(request),
      ),
    };
  }

  @Post('sales-order-attachments')
  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.order.write')
  @UseInterceptors(FilesInterceptor('files', 20))
  async uploadSalesOrderAttachments(
    @UploadedFiles() files: StoredUploadFile[],
    @Req()
    request: {
      headers?: Record<string, string | string[] | undefined>;
    },
  ) {
    return {
      items: await this.fileStorageService.saveSalesOrderAttachments(
        files ?? [],
        resolveRequestBaseUrl(request),
      ),
    };
  }
}
