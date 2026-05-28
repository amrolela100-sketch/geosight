import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '../src/components/empty-state';

function StubIcon({ className }: { className?: string }) {
  return <svg data-testid="icon" className={className} />;
}

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No brands yet" description="Add your first brand to start." />);
    expect(screen.getByText('No brands yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first brand to start.')).toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    render(<EmptyState icon={StubIcon} title="Empty" />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(
      <EmptyState
        title="Empty"
        action={<button type="button">Add brand</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add brand' })).toBeInTheDocument();
  });
});
