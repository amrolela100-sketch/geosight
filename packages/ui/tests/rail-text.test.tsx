import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RailText } from '../src/components/rail-text';

describe('RailText', () => {
  it('renders children', () => {
    render(<RailText>52.5200° N · 13.4050° E</RailText>);
    expect(screen.getByText('52.5200° N · 13.4050° E')).toBeInTheDocument();
  });

  it('applies the right rail position by default', () => {
    const { container } = render(<RailText>geo</RailText>);
    expect(container.firstChild).toHaveClass('right-2');
  });

  it('applies the left rail position when requested', () => {
    const { container } = render(<RailText side="left">geo</RailText>);
    expect(container.firstChild).toHaveClass('left-2');
  });
});
