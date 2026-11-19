import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { authReady, firebaseUser, isAuthorizedStaff, isAdmin, isSecurityVerified } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="border border-slate-200 bg-white rounded-xl p-6 text-sm text-slate-600">
          Verifying MUN COMPUTER session...
        </div>
      </div>
    );
  }

  if (!firebaseUser || !isAuthorizedStaff || !isSecurityVerified) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-950">Administrator Access Required</h1>
          <p className="text-sm text-slate-600">
            This module is restricted to authorized MUN COMPUTER Admin accounts. Your current role
            does not have permission to access Admin controls.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/dashboard"
              className="px-4 py-2 text-sm font-semibold bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors"
            >
              Go to Business Manager
            </Link>
            <Link
              to="/"
              className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Public Website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
