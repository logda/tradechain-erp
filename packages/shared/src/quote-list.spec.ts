import { quoteBossConfirmedOptions, quoteListSortFields } from './quote-list.js';

describe('quote list query contracts', () => {
  it('exposes the supported sort fields in order', () => {
    expect(quoteListSortFields).toEqual([
      'createdAt',
      'docNo',
      'customerName',
    ]);
  });

  it('exposes tri-state boss confirmation filter options', () => {
    expect(quoteBossConfirmedOptions).toEqual(['all', 'yes', 'no']);
  });
});
