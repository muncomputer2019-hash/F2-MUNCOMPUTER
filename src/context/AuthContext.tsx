import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../services/firebase';
import { BOOTSTRAPPED_ADMIN_EMAILS } from '../config/businessConfig';
import type { StaffUser, UserRole } from '../types';

const DEVICE_ID_STORAGE_KEY = 'mun_computer_device_id';
const PORTAL_VERIFIED_STORAGE_KEY = 'mun_computer_portal_verified';

export function getOrCreateDeviceId(): string {
  try {
    let existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!existing) {
      const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
      existing = `MC-DEV-${randomPart}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, existing);
    }
    return existing;
  } catch {
    return 'MC-DEV-BROWSER';
  }
}

interface AuthContextValue {
  firebaseUser: User | null;
  staffProfile: StaffUser | null;
  authReady: boolean;
  isSecurityVerified: boolean;
  deviceId: string;
  isAuthorizedStaff: boolean;
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
  signInWithGoogleForPortal: (selectedRole?: UserRole) => Promise<{
    user: User;
    profile: StaffUser;
  }>;
  completePortalSecurityCheck: (uid: string) => Promise<void>;
  logoutPortal: () => Promise<void>;
  refreshStaffProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSecurityVerified, setIsSecurityVerified] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(PORTAL_VERIFIED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const loadStaffProfile = async (user: User): Promise<StaffUser | null> => {
    const email = (user.email || '').toLowerCase();
    const isBootstrappedAdmin = Boolean(
      user.emailVerified && BOOTSTRAPPED_ADMIN_EMAILS.includes(email)
    );

    const staffRef = doc(db, 'staff_users', user.uid);
    try {
      const snap = await getDoc(staffRef);
      if (snap.exists()) {
        const data = snap.data() as StaffUser;
        setStaffProfile(data);
        return data;
      }

      if (isBootstrappedAdmin) {
        const adminDocRef = doc(db, 'admins', user.uid);
        const adminSnap = await getDoc(adminDocRef);
        if (!adminSnap.exists()) {
          await setDoc(adminDocRef, {
            email: user.email || email,
            createdAt: serverTimestamp(),
          });
        }
        const newAdminProfile: Omit<StaffUser, 'createdAt' | 'updatedAt' | 'lastLoginAt'> & {
          createdAt: ReturnType<typeof serverTimestamp>;
          updatedAt: ReturnType<typeof serverTimestamp>;
          lastLoginAt: ReturnType<typeof serverTimestamp>;
        } = {
          uid: user.uid,
          email: user.email || email,
          displayName: user.displayName || 'MUN COMPUTER Admin',
          role: 'admin',
          status: 'active',
          registeredDevices: [deviceId],
          lastLoginAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(staffRef, newAdminProfile);
        const createdSnap = await getDoc(staffRef);
        const createdData = createdSnap.data() as StaffUser;
        setStaffProfile(createdData);
        return createdData;
      }

      setStaffProfile(null);
      return null;
    } catch (error) {
      console.error('Error loading staff profile:', error);
      setStaffProfile(null);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadStaffProfile(user);
      } else {
        setStaffProfile(null);
        setIsSecurityVerified(false);
        try {
          sessionStorage.removeItem(PORTAL_VERIFIED_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogleForPortal = async (selectedRole?: UserRole) => {
    const credential = await signInWithPopup(auth, googleProvider);
    const user = credential.user;
    const profile = await loadStaffProfile(user);

    if (!profile || profile.status !== 'active') {
      await signOut(auth);
      throw new Error(
        'This Google account is not registered as an active MUN COMPUTER staff, manager, or admin account. Please contact the business administrator.'
      );
    }

    if (selectedRole && selectedRole === 'admin' && profile.role !== 'admin') {
      await signOut(auth);
      throw new Error('Selected role Admin requires an Admin-level account.');
    }

    if (selectedRole && selectedRole === 'manager' && !['admin', 'manager'].includes(profile.role)) {
      await signOut(auth);
      throw new Error('Selected role Manager requires Manager or Admin permissions.');
    }

    return { user, profile };
  };

  const completePortalSecurityCheck = async (uid: string) => {
    const staffRef = doc(db, 'staff_users', uid);
    try {
      const snap = await getDoc(staffRef);
      if (snap.exists()) {
        const data = snap.data() as StaffUser;
        const currentDevices = Array.isArray(data.registeredDevices) ? data.registeredDevices : [];
        const nextDevices = currentDevices.includes(deviceId)
          ? currentDevices
          : [...currentDevices.slice(-9), deviceId];

        await updateDoc(staffRef, {
          registeredDevices: nextDevices,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const refreshed = await getDoc(staffRef);
        if (refreshed.exists()) {
          setStaffProfile(refreshed.data() as StaffUser);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff_users/${uid}`);
    }

    setIsSecurityVerified(true);
    try {
      sessionStorage.setItem(PORTAL_VERIFIED_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const logoutPortal = async () => {
    setIsSecurityVerified(false);
    try {
      sessionStorage.removeItem(PORTAL_VERIFIED_STORAGE_KEY);
    } catch {
      // ignore
    }
    await signOut(auth);
    setStaffProfile(null);
  };

  const refreshStaffProfile = async () => {
    if (firebaseUser) {
      await loadStaffProfile(firebaseUser);
    }
  };

  const isAuthorizedStaff = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      staffProfile &&
      staffProfile.status === 'active'
  );
  const isAdmin = Boolean(isAuthorizedStaff && staffProfile?.role === 'admin');
  const isManagerOrAdmin = Boolean(
    isAuthorizedStaff && (staffProfile?.role === 'admin' || staffProfile?.role === 'manager')
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        staffProfile,
        authReady,
        isSecurityVerified,
        deviceId,
        isAuthorizedStaff,
        isAdmin,
        isManagerOrAdmin,
        signInWithGoogleForPortal,
        completePortalSecurityCheck,
        logoutPortal,
        refreshStaffProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
