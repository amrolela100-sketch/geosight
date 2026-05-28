import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '../src/components/page-header';

describe('PageHeader', () => {
  it('renders title as h1', () => {
    render(<PageHeader title="Brands" />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Brands' });
    expect(heading).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<PageHeader title="Brands" subtitle="Track your brand presence" />);
    expect(screen.getByText('Track your brand presence')).toBeInTheDocument();
  });

  it('renders action slot when provided', () => {
    render(
      <PageHeader
        title="Brands"
        action={<button type="button">Add brand</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add brand' })).toBeInTheDocument();
  });
});
