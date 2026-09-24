import { describe, expect, it, vi } from 'vitest';
import AppMvpPage from '../app/app/mvp/page';

const redirectMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

describe('旧验收中心链接', () => {
  it('跳回正式工作台', async () => {
    await AppMvpPage({});
    expect(redirectMock).toHaveBeenCalledWith('/app');
  });
});
