import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Button } from '../src/components/button';

describe('Button', () => {
  it('renders children and defaults to primary variant', () => {
    render(<Button>Run scan</Button>);
    const btn = screen.getByRole('button', { name: 'Run scan' });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/bg-primary/);
  });

  it('maps variant prop to the destructive utility class', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.className).toMatch(/text-destructive/);
    expect(btn.className).not.toMatch(/bg-primary/);
  });

  it('forwards refs to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('disables and marks data-pending when pending=true', () => {
    render(<Button pending>Saving…</Button>);
    const btn = screen.getByRole('button', { name: /Saving/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('data-pending', 'true');
  });

  it('renders as child element when asChild', () => {
    render(
      <Button asChild>
        <a href="/dashboard">Open dashboard</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Open dashboard' });
    expect(link.tagName).toBe('A');
    expect(link.className).toMatch(/bg-primary/);
  });

  it('inherits dir from RTL parent without breaking layout classes', () => {
    render(
      <div dir="rtl">
        <Button>تشغيل</Button>
      </div>,
    );
    const btn = screen.getByRole('button', { name: 'تشغيل' });
    expect(btn.closest('[dir="rtl"]')).not.toBeNull();
    expect(btn.className).toMatch(/inline-flex/);
  });
});
