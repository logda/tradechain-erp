import { render, screen } from '@testing-library/react';

function Harness() {
  return <main>Web test harness ready</main>;
}

describe('web foundation', () => {
  it('renders React components in jsdom', () => {
    render(<Harness />);

    expect(screen.getByText('Web test harness ready')).toBeInTheDocument();
  });
});
