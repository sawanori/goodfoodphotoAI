import admin from 'firebase-admin';

// Firebase Admin SDKの初期化
// Cloud Runでは環境変数GOOGLE_APPLICATION_CREDENTIALSが自動設定される
// ローカル開発ではサービスアカウントキーファイルが必要

let initialized = false;

export function initializeFirebase() {
  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    initialized = true;
    console.log('Firebase Admin SDK initialized');
  }
  return admin;
}

// インスタンスをエクスポート
export const firebaseAdmin = admin;

// Firestoreインスタンスをエクスポート
export const db = admin.firestore();
