import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionMarker } from '../src/components/section-marker';

describe('SectionMarker', () => {
  it('renders the Roman numeral for the given index', () => {
    render(<SectionMarker index={3} label="Lab" />);
    expect(screen.getByText('III.')).toBeInTheDocument();
    expect(screen.getByText('Lab')).toBeInTheDocument();
  });

  it('falls back to the Arabic numeral past XII', () => {
    render(<SectionMarker index={15} label="Beyond" />);
    expect(screen.getByText('15.')).toBeInTheDocument();
  });

  it('renders zero-padded pagination when provided', () => {
    render(<SectionMarker index={1} label="About" pagination={{ current: 2, total: 8 }} />);
    expect(screen.getByText(/Nº 002 \/ 008/)).toBeInTheDocument();
  });

  it('omits pagination when not provided', () => {
    render(<SectionMarker index={1} label="About" />);
    expect(screen.queryByText(/Nº/)).not.toBeInTheDocument();
  });
});
