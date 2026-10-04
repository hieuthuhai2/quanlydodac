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
  apiKey: 'AIzaSyDZbPzN7473GlIk6hL0oa-I3hsvmUHu6-o',
  authDomain: 'quanlydodacc.firebaseapp.com',
  projectId: 'quanlydodacc',
  storageBucket: 'quanlydodacc.firebasestorage.app',
  messagingSenderId: '162107035134',
  appId: '1:162107035134:web:3d56f9db08a2fa6a0484af',
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
