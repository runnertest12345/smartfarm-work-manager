'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const requiredConfig = [
  ['NEXT_PUBLIC_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['NEXT_PUBLIC_FIREBASE_APP_ID', firebaseConfig.appId],
] as const;

export const missingFirebaseConfig = requiredConfig
  .filter(([, value]) => !value)
  .map(([name]) => name);

export const firebaseConfigurationReady = missingFirebaseConfig.length === 0;
export const firebaseWorkspaceId =
  process.env.NEXT_PUBLIC_FIREBASE_WORKSPACE_ID?.trim() || 'default';

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let services: FirebaseServices | null = null;

export function getFirebaseServices(): FirebaseServices {
  if (!firebaseConfigurationReady) {
    throw new Error(
      `Firebase 환경 변수가 설정되지 않았습니다: ${missingFirebaseConfig.join(', ')}`,
    );
  }
  if (services) return services;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  services = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };
  services.auth.useDeviceLanguage();
  void setPersistence(services.auth, browserSessionPersistence).catch(() => {
    // Some privacy-focused browsers can reject persistence changes. Auth still works.
  });
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(services.auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    connectFirestoreEmulator(services.db, '127.0.0.1', 8080);
  }
  return services;
}

export function requireSignedInUser() {
  const user = getFirebaseServices().auth.currentUser;
  if (!user)
    throw new Error('로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.');
  return user;
}
