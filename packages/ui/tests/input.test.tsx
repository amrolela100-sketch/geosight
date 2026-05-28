import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Input } from '../src/components/input';

describe('Input', () => {
  it('renders a text input by default', () => {
    render(<Input placeholder="Brand name" />);
    const el = screen.getByPlaceholderText('Brand name') as HTMLInputElement;
    expect(el.type).toBe('text');
  });

  it('forwards refs', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="ref-input" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('applies aria-invalid + destructive styling when invalid', () => {
    render(<Input invalid aria-label="email" />);
    const el = screen.getByLabelText('email');
    expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(el.className).toMatch(/border-destructive/);
  });
});
