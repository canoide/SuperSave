import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import UserDashboard from './pages/UserDashboard.jsx';

// ProtectedRoute component evaluates dynamically when the route is matched/rendered
function ProtectedRoute({ allowedRole, children }) {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  console.log('ProtectedRoute rendering for role:', allowedRole, 'token:', !!token, 'user:', user);

  if (!token || !user) {
    console.log('ProtectedRoute: redirecting to /login (missing session)');
    return <Navigate to="/login" replace />;
  }

  try {
    const userObj = JSON.parse(user);
    if (userObj.role !== allowedRole) {
      const fallbackRedir = userObj.role === 'admin' ? '/admin' : '/user';
      console.log('ProtectedRoute: role mismatch. Redirecting to:', fallbackRedir);
      return <Navigate to={fallbackRedir} replace />;
    }
    console.log('ProtectedRoute: authorized. Rendering children...');
    return children;
  } catch (e) {
    console.error('ProtectedRoute parsing error:', e);
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin Dashboard (Protected) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* User Portal (Protected) */}
        <Route
          path="/user"
          element={
            <ProtectedRoute allowedRole="user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch-all and Redirect */}
        <Route
          path="*"
          element={
            <Navigate to="/login" replace />
          }
        />
      </Routes>
    </Router>
  );
}
