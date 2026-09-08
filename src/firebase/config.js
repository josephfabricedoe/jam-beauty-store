import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration for project: jam-beauty-store-online
// Get your apiKey from: Firebase Console -> Project Settings -> Your Apps
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyABnn-dG_UIJ-3UpbfvL5KMP0gBey6rkI8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jam-beauty-store-online.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jam-beauty-store-online',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'jam-beauty-store-online.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '794552738927',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:794552738927:web:c544c1b3bce5fe18b5199a',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
