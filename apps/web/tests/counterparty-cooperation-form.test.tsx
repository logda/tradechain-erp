import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UpdateCounterpartyForm } from '../app/app/master-data/counterparties/update-counterparty-form';

const item = { id: 2, type: 'supplier' as const, code: 'SUP-2', name: '供应商', shortName: '', region: '', ownerName: 'Leo', contactName: '', phone: '', address: '', bankName: '', bankAccount: '', remark: '', cooperationStatus: 'uncooperated' as const };
const props = { endpoint: '/api/counterparties/2', item, updatedBy: 'Leo', allowedTypes: ['supplier' as const], ownerOptions: [{ id: 4, username: 'leo', realName: 'Leo', roleCode: 'purchase', status: 'active', fullAccess: false }] };

describe('supplier cooperation form permission', () => {
  it('shows the classification control to the boss', () => {
    render(<UpdateCounterpartyForm {...props} actorRole="boss" />);
    expect(screen.getByRole('combobox', { name: '供应商合作分类' })).toHaveValue('uncooperated');
  });

  it('does not show the manual classification control to purchasing', () => {
    render(<UpdateCounterpartyForm {...props} actorRole="purchase" />);
    expect(screen.queryByRole('combobox', { name: '供应商合作分类' })).not.toBeInTheDocument();
  });
});
