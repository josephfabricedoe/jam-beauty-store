import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

import { normalizeRole, isOwner, isManager, isCashier, isDelivery } from '../utils/rbac';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Safety timeout: ensure loading becomes false after 2.5s even if Firebase is slow/offline
    const fallbackTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2500);

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!mounted) return;
      setCurrentUser(user);
      setLoading(false);
      clearTimeout(fallbackTimer);

      if (user) {
        getDoc(doc(db, 'users', user.uid))
          .then(async (snap) => {
            if (!mounted) return;
            if (snap.exists()) {
              setUserProfile(snap.data());
            } else {
              const defaultProfile = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email?.split('@')[0] || 'Store Admin',
                role: 'owner',
                createdAt: serverTimestamp(),
              };
              try {
                await setDoc(doc(db, 'users', user.uid), defaultProfile, { merge: true });
              } catch (err) {
                console.warn('Auto-seed user notice:', err);
              }
              setUserProfile(defaultProfile);
            }
          })
          .catch((e) => {
            console.warn('Profile fetch notice:', e);
            if (mounted) setUserProfile({ role: 'owner', displayName: user.email });
          });
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  const SHARED_TERMINAL_EMAIL = 'jambeautyliberia@gmail.com';

  const [terminalStaff, setTerminalStaff] = useState(() => {
    try {
      const saved = sessionStorage.getItem('jam_terminal_staff');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const isSharedTerminal = currentUser?.email?.toLowerCase().trim() === SHARED_TERMINAL_EMAIL;

  // Terminal is locked ONLY if logged into shared store account AND no individual staff PIN is active
  // Joseph, CEO MJ, and direct admin logins bypass this completely!
  const isTerminalLocked = isSharedTerminal && !terminalStaff;

  const unlockTerminalStaff = (staff) => {
    setTerminalStaff(staff);
    try {
      sessionStorage.setItem('jam_terminal_staff', JSON.stringify(staff));
    } catch (e) {}
  };

  const lockTerminalStaff = () => {
    setTerminalStaff(null);
    try {
      sessionStorage.removeItem('jam_terminal_staff');
    } catch (e) {}
  };

  const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const signOut = () => {
    lockTerminalStaff();
    return fbSignOut(auth);
  };

  const createAccount = async (email, password, displayName, role = 'cashier') => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      createdAt: serverTimestamp(),
    });
    return cred;
  };

  // Resolve active staff profile and role:
  // On shared terminal, active staff member unlocked via PIN takes precedence
  // On personal owner/admin login, userProfile takes precedence
  const effectiveProfile = isSharedTerminal ? (terminalStaff || { displayName: 'Staff Terminal', role: 'cashier' }) : userProfile;
  const currentRole = normalizeRole(effectiveProfile?.role);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userProfile: effectiveProfile,
      rawUserProfile: userProfile,
      terminalStaff,
      isSharedTerminal,
      isTerminalLocked,
      unlockTerminalStaff,
      lockTerminalStaff,
      loading, 
      signIn, 
      signOut, 
      createAccount,
      currentRole,
      isOwner: isOwner(currentRole),
      isManager: isManager(currentRole),
      isCashier: isCashier(currentRole),
      isDelivery: isDelivery(currentRole),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
