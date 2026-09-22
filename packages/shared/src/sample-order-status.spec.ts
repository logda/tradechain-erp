import { sampleOrderStatuses } from './sample-order-status.js';

describe('sample order statuses', () => {
  it('exposes the full sample lifecycle in order', () => {
    expect(sampleOrderStatuses).toEqual([
      'draft',
      'pending_approval',
      'pending_sampling',
      'sampling',
      'sample_sent',
      'customer_confirmed',
      'closed_no_followup',
      'canceled',
      'replaced',
    ]);
  });
});
