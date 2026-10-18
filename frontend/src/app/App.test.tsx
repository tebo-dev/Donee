import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthProvider';
import { App } from './App';

describe('app navigation', () => {
  it('recovers from an unknown route through the home link', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/missing']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'Nothing here. Not just yet.' }),
    ).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Back to Donee' }));
    expect(
      screen.getByRole('heading', { name: 'Less noise. More doing.' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Nothing here. Not just yet.' }),
    ).not.toBeInTheDocument();
  });
});
