import { FormalLookupController } from '../src/formal-lookup/formal-lookup.controller';
import type { ProductService } from '../src/product/product.service';
import type { CounterpartyService } from '../src/counterparty/counterparty.service';
import type { UserManagementService } from '../src/user-management/user-management.service';

describe('FormalLookupController products', () => {
  it('requests the redacted product view for sales roles', () => {
    const list = jest.fn();
    const controller = new FormalLookupController(
      { list } as unknown as ProductService,
      {} as CounterpartyService,
      {} as UserManagementService,
    );
    controller.listProducts('active', { headers: { 'x-erp-role': 'sales' } });
    expect(list).toHaveBeenCalledWith({ status: 'active', page: 1, pageSize: 1000 }, 'sales');
  });
});
