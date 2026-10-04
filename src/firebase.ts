import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// ============================================================
// DÁN CẤU HÌNH FIREBASE CỦA BẠN VÀO ĐÂY (thay các chữ DIEN_VAO_DAY)
// Lấy ở: Firebase Console → Project settings → Your apps → Web app
// ============================================================
export const firebaseConfig = {
  apiKey: 'DIEN_VAO_DAY',
  authDomain: 'DIEN_VAO_DAY',
  projectId: 'DIEN_VAO_DAY',
  storageBucket: 'DIEN_VAO_DAY',
  messagingSenderId: 'DIEN_VAO_DAY',
  appId: 'DIEN_VAO_DAY',
};

// Chưa điền cấu hình -> app chạy chế độ lưu trên máy như cũ (không đăng nhập)
export const FIREBASE_ENABLED = !firebaseConfig.apiKey.startsWith('DIEN_');

const app = FIREBASE_ENABLED ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;

// Bật bộ nhớ đệm offline: mất mạng vẫn xem/sửa được, có mạng lại tự đồng bộ
export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null;
