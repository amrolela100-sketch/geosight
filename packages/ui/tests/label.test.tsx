import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Label } from '../src/components/label';

describe('Label', () => {
  it('renders children and applies base classes', () => {
    render(<Label htmlFor="brand">Brand</Label>);
    const el = screen.getByText('Brand');
    expect(el.tagName).toBe('LABEL');
    expect(el.className).toMatch(/flex/);
  });

  it('renders hint when provided', () => {
    render(<Label hint="Use the official spelling">Brand</Label>);
    expect(screen.getByText('Use the official spelling')).toBeInTheDocument();
  });

  it('renders error over hint when both provided', () => {
    render(
      <Label hint="ignored" error="Required field">
        Brand
      </Label>,
    );
    expect(screen.getByText('Required field')).toBeInTheDocument();
    expect(screen.queryByText('ignored')).not.toBeInTheDocument();
  });
});
