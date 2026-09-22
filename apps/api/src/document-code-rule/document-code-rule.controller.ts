import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminOnlyGuard } from '../auth/admin-only.guard';
import { FormalActions, FormalModules } from '../auth/formal-role.decorator';
import { DocumentCodeRuleService } from './document-code-rule.service';

@Controller('document-code-rules')
@FormalModules('admin')
@UseGuards(AdminOnlyGuard)
export class DocumentCodeRuleController {
  constructor(
    @Inject(DocumentCodeRuleService)
    private readonly documentCodeRuleService: DocumentCodeRuleService,
  ) {}

  @Get()
  getRuleSet() {
    return this.documentCodeRuleService.getRuleSet();
  }

  @Patch('quote-no')
  @FormalActions('master_data.write')
  updateQuoteNoRule(
    @Body()
    body: {
      strategy: 'composed_segments';
      serialLength: number;
      serialScope: 'global_total' | 'global_year' | 'global_month' | 'global_day';
      segments: Array<{
        key: 'prefix' | 'year' | 'month' | 'day' | 'serial';
        enabled: boolean;
        order: number;
        value?: string;
      }>;
      updatedBy: string;
    },
  ) {
    return this.documentCodeRuleService.updateRule('quote_no', body);
  }

  @Patch('demand-no')
  @FormalActions('master_data.write')
  updateDemandNoRule(
    @Body()
    body: {
      strategy: 'composed_segments';
      serialLength: number;
      serialScope: 'global_total' | 'global_year' | 'global_month' | 'global_day';
      segments: Array<{
        key: 'prefix' | 'year' | 'month' | 'day' | 'serial';
        enabled: boolean;
        order: number;
        value?: string;
      }>;
      updatedBy: string;
    },
  ) {
    return this.documentCodeRuleService.updateRule('demand_no', body);
  }

  @Patch('customer-order-no')
  @FormalActions('master_data.write')
  updateCustomerOrderNoRule(
    @Body()
    body: {
      strategy: 'composed_segments';
      serialLength: number;
      serialScope: 'global_total' | 'global_year' | 'global_month' | 'global_day';
      segments: Array<{
        key: 'prefix' | 'year' | 'month' | 'day' | 'serial';
        enabled: boolean;
        order: number;
        value?: string;
      }>;
      updatedBy: string;
    },
  ) {
    return this.documentCodeRuleService.updateRule('customer_order_no', body);
  }
}
