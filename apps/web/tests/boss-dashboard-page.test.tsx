import { render, screen } from '@testing-library/react';
import BossDashboardPage from '../app/dashboard/boss/page';

describe('BossDashboardPage', () => {
  it('renders the read-only management dashboard sections', () => {
    render(<BossDashboardPage />);

    expect(
      screen.getByRole('heading', { name: '老板经营看板' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('只读查看销售、采购、发货、售后与财务汇总'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '风险提醒' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '销售汇总' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '采购汇总' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '售后与财务' })).toBeInTheDocument();
    expect(screen.getByText('partial_shipped')).toBeInTheDocument();
    expect(screen.getByText('purchasing')).toBeInTheDocument();
    expect(screen.getByText('finance_reviewing')).toBeInTheDocument();
  });
});
