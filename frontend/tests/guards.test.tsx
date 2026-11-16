import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccessDenied, RequireAuth, RequireRole, elementForRole } from '../src/router/guards';

const mockUseAuth = vi.fn();

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

afterEach(() => {
  cleanup();
  mockUseAuth.mockReset();
});

describe('route guards', () => {
  it('maps each role to its dashboard', () => {
    expect(elementForRole('admin')).toBe('/admin/dashboard');
    expect(elementForRole('teacher')).toBe('/teacher/dashboard');
    expect(elementForRole('student')).toBe('/student/dashboard');
  });

  it('redirects unauthenticated users home', () => {
    mockUseAuth.mockReturnValue({ currentUser: null });
    render(
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/" element={<div>home page</div>} />
          <Route
            path="/private"
            element={
              <RequireAuth>
                <div>private page</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('home page')).toBeInTheDocument();
  });

  it('renders children when the role is allowed', () => {
    mockUseAuth.mockReturnValue({ currentUser: { role: 'admin' } });
    render(
      <MemoryRouter>
        <RequireRole roles={['admin']}>
          <div>admin only</div>
        </RequireRole>
      </MemoryRouter>
    );
    expect(screen.getByText('admin only')).toBeInTheDocument();
  });

  it('denies access for a disallowed role', () => {
    mockUseAuth.mockReturnValue({ currentUser: { role: 'student' } });
    render(
      <MemoryRouter>
        <RequireRole roles={['admin']}>
          <div>admin only</div>
        </RequireRole>
      </MemoryRouter>
    );
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('admin only')).not.toBeInTheDocument();
  });

  it('dispatches a logout event from the denied page', () => {
    const handler = vi.fn();
    window.addEventListener('auth:logout', handler);
    render(<AccessDenied />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('auth:logout', handler);
  });
});
