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

  const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const signOut = () => fbSignOut(auth);

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

  const currentRole = normalizeRole(userProfile?.role);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userProfile, 
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
