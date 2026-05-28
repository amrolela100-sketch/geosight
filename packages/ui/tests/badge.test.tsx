import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from '../src/components/badge';

describe('Badge', () => {
  it('renders with neutral tone by default', () => {
    render(<Badge>Phase 1</Badge>);
    const el = screen.getByText('Phase 1');
    expect(el.className).toMatch(/text-muted-foreground/);
  });

  it('applies blue tone classes when tone=blue', () => {
    render(<Badge tone="blue">Live</Badge>);
    expect(screen.getByText('Live').className).toMatch(/text-blue-100/);
  });

  it('applies sm size classes when size=sm', () => {
    render(<Badge size="sm">tag</Badge>);
    expect(screen.getByText('tag').className).toMatch(/text-\[11px\]/);
  });
});
