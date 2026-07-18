import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * ProtectedRoute allows access only if the user is authenticated (token exists).
 * Optionally validates the user's role if allowedRoles is specified.
 */
export function ProtectedRoute({ allowedRoles }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('userRole');

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const redirectPath = role === 'valet' ? '/valet' : role === 'rs' ? '/rs' : '/login';
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
}

/**
 * GuestRoute prevents logged-in users from accessing the guest-only pages (e.g. login).
 * Redirects authenticated users to their corresponding dashboard.
 */
export function GuestRoute() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('userRole');

  if (token && role) {
    const redirectPath = role === 'valet' ? '/valet' : role === 'rs' ? '/rs' : '/login';
    if (redirectPath !== '/login') {
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <Outlet />;
}
