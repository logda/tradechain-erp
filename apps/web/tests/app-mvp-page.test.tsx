import { render, screen } from '@testing-library/react';
import AppMvpPage from '../app/app/mvp/page';

describe('AppMvpPage', () => {
  it('renders the MVP acceptance center with steps and limits', async () => {
    render(<>{await AppMvpPage({})}</>);

    expect(
      screen.getByRole('heading', { name: '全链路验收中心' }),
    ).toBeInTheDocument();
    expect(screen.getByText('MVP 状态：已完成，可进入验收')).toBeInTheDocument();
    expect(screen.getByText('管理员 admin / Admin123456')).toBeInTheDocument();
    expect(screen.getByText('老板 mia / Mia123456')).toBeInTheDocument();
    expect(screen.getByText('销售 zoe / Zoe123456')).toBeInTheDocument();
    expect(screen.getByText('采购 leo / Leo123456')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '推荐验收路径' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '完成口径' })).toBeInTheDocument();
    expect(screen.getByText('正式数据库已完成迁移、种子数据和校验。')).toBeInTheDocument();
    expect(screen.getByText('权限、审计、待办、主数据和全链路页面已纳入 MVP 验收。')).toBeInTheDocument();
    expect(screen.getByText('1. 管理员创建或注销业务账号')).toBeInTheDocument();
    expect(screen.getByText('7. 发货批次推进回单与异常')).toBeInTheDocument();
    expect(screen.getByText('9. 老板看板下钻审批、异常和财务队列')).toBeInTheDocument();
    expect(screen.getByText('10. 日志中心复核关键操作追溯')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MVP 边界' })).toBeInTheDocument();
    expect(
      screen.getByText(
        '当前版本已支持 Prisma 正式数据库、正式权限账号、主链路页面和审计追溯，适合流程验收和老板汇报。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '正式上线仍建议继续补库存、深财务、通知、导入导出、生产级审计归档和发布流程。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '开始销售链路' })).toHaveAttribute(
      'href',
      '/app/sales',
    );
    expect(screen.getByRole('link', { name: '查看老板看板' })).toHaveAttribute(
      'href',
      '/app/dashboard/boss',
    );
    expect(screen.getByRole('link', { name: '进入待办中心' })).toHaveAttribute(
      'href',
      '/app/todos',
    );
    expect(screen.getByRole('link', { name: '查看日志中心' })).toHaveAttribute(
      'href',
      '/app/logs',
    );
  });
});
