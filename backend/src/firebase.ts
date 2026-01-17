import admin from 'firebase-admin';

// Firebase Admin SDKの初期化
// Cloud Runでは環境変数GOOGLE_APPLICATION_CREDENTIALSが自動設定される
// ローカル開発ではサービスアカウントキーファイルが必要

let initialized = false;
let _db: admin.firestore.Firestore | null = null;

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

// Firestoreインスタンスを遅延初期化でエクスポート
export function getFirestore(): admin.firestore.Firestore {
  if (!_db) {
    if (!initialized) {
      initializeFirebase();
    }
    _db = admin.firestore();
  }
  return _db;
}

// 後方互換性のためのエイリアス（非推奨）
export const db = {
  get instance() {
    return getFirestore();
  }
};
