import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorialEyebrow } from '../src/components/editorial-eyebrow';

describe('EditorialEyebrow', () => {
  it('renders children', () => {
    render(<EditorialEyebrow>Section I</EditorialEyebrow>);
    expect(screen.getByText('Section I')).toBeInTheDocument();
  });

  it('applies the strong tone class', () => {
    render(
      <EditorialEyebrow tone="strong" data-testid="eyebrow">
        Manifesto
      </EditorialEyebrow>,
    );
    expect(screen.getByTestId('eyebrow').className).toMatch(/eyebrow-track--strong/);
  });

  it('applies the coral tone class', () => {
    render(
      <EditorialEyebrow tone="coral" data-testid="eyebrow">
        Live
      </EditorialEyebrow>,
    );
    expect(screen.getByTestId('eyebrow').className).toMatch(/eyebrow-track--coral/);
  });
});
