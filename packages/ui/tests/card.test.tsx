import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../src/components/card';

describe('Card', () => {
  it('defaults to solid variant', () => {
    render(<Card data-testid="card">x</Card>);
    const el = screen.getByTestId('card');
    expect(el.className).toMatch(/bg-card\/40/);
  });

  it('applies glass-panel class when variant=glass', () => {
    render(
      <Card data-testid="card" variant="glass">
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toMatch(/glass-panel/);
  });

  it('composes header, title, description, content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your keys</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Manage your keys')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });
});
