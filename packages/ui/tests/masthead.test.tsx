import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Masthead } from '../src/components/masthead';

describe('Masthead', () => {
  it('renders volume and issue', () => {
    render(<Masthead volume="OD / 2026" issue="VOL 01 · Nº 26" />);
    expect(screen.getByText('OD / 2026')).toBeInTheDocument();
    expect(screen.getByText('VOL 01 · Nº 26')).toBeInTheDocument();
  });

  it('renders the status slot when provided', () => {
    render(
      <Masthead
        volume="OD / 2026"
        issue="VOL 01"
        status={<span data-testid="status">● live</span>}
      />,
    );
    expect(screen.getByTestId('status')).toBeInTheDocument();
  });

  it('renders the middle slot when provided', () => {
    render(<Masthead volume="OD" issue="VOL 01" middle="Build sha-9f2c1" />);
    expect(screen.getByText('Build sha-9f2c1')).toBeInTheDocument();
  });
});
