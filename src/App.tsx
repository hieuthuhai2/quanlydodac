import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, Plus, MapPin, Clock, Trash2, ArrowLeft, Image as ImageIcon, Edit2, Package, FolderTree, X, Tag, Settings2, AlertTriangle, CheckCircle2, Search, SearchX, LogOut, Lock, User, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, FIREBASE_ENABLED } from './firebase';

const LOCAL_KEY = 'smart_wardrobe_data';
const BACKUP_KEY = 'smart_wardrobe_data_backup';

const DEFAULT_GROUPS = ['Đồ đang phơi', 'Đồ dùng hàng ngày', 'Đồ lưu kho'];
const DEFAULT_STATUSES = ['Đang dơ', 'Đang giặt', 'Sạch', 'Chờ khô'];
const DEFAULT_STATUS_COLORS = { 'Đang dơ': 'red', 'Đang giặt': 'sky', 'Sạch': 'emerald', 'Chờ khô': 'amber' };

// Bảng màu trạng thái (viết đầy đủ class để Tailwind nhận diện)
const STATUS_PALETTE = {
  slate:   { badge: 'bg-slate-700 text-white',   dot: 'bg-slate-700' },
  red:     { badge: 'bg-red-500 text-white',     dot: 'bg-red-500' },
  amber:   { badge: 'bg-amber-500 text-white',   dot: 'bg-amber-500' },
  emerald: { badge: 'bg-emerald-600 text-white', dot: 'bg-emerald-600' },
  sky:     { badge: 'bg-sky-500 text-white',     dot: 'bg-sky-500' },
  violet:  { badge: 'bg-violet-600 text-white',  dot: 'bg-violet-600' },
  pink:    { badge: 'bg-pink-500 text-white',    dot: 'bg-pink-500' },
};

/**
 * Bỏ dấu tiếng Việt + đưa về chữ thường.
 * "Giày Chạy Bộ" -> "giay chay bo"; "Chìa khóa" -> "chia khoa"
 */
const removeAccents = (str) =>
  String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // xóa các dấu thanh/dấu mũ
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();

// Gộp các trường cần tìm của 1 đồ vật thành 1 chuỗi đã chuẩn hóa
const buildHaystack = (item) =>
  removeAccents([item.name, item.location, item.group, item.status, item.notes].join(' '));

// ===== Tiện ích đồng bộ / đăng nhập =====
// Firebase Auth cần email -> ghép tên đăng nhập thành email ảo (không gửi mail thật)
const normalizeUsername = (u) => removeAccents(u).replace(/\s+/g, '');
const toEmail = (u) => `${normalizeUsername(u)}@tudo.app`;
const isValidUsername = (u) => /^[a-z0-9._-]{3,30}$/.test(normalizeUsername(u));

// JSON ổn định (sắp xếp khóa) để so sánh dữ liệu trước/sau khi đồng bộ
const stable = (o) => JSON.stringify(o, Object.keys(o).sort());
// Firestore không nhận giá trị undefined
const clean = (o) => JSON.parse(JSON.stringify(o));

const authErrorMessage = (code) => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Sai tên đăng nhập hoặc mật khẩu.';
    case 'auth/email-already-in-use':
      return 'Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.';
    case 'auth/weak-password':
      return 'Mật khẩu quá yếu (cần ít nhất 6 ký tự).';
    case 'auth/network-request-failed':
      return 'Không có kết nối mạng. Vui lòng thử lại.';
    case 'auth/too-many-requests':
      return 'Thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.';
    case 'auth/operation-not-allowed':
      return 'Chưa bật đăng nhập Email/Password trong Firebase.';
    default:
      return 'Có lỗi xảy ra: ' + (code || 'không rõ');
  }
};

function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidUsername(username)) {
      setError('Tên đăng nhập gồm 3-30 ký tự: chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, toEmail(username), password);
      } else {
        await createUserWithEmailAndPassword(auth, toEmail(username), password);
      }
    } catch (err) {
      setError(authErrorMessage(err.code));
      setLoading(false);
    }
  };

  const inputCls = 'w-full pl-11 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition';

  return (
    <div className="h-full flex flex-col justify-center bg-gradient-to-b from-indigo-600 to-indigo-800 px-6">
      <div className="text-center text-white mb-6">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/15 flex items-center justify-center"><Package size={34} /></div>
        <h1 className="text-2xl font-bold">Tủ Đồ Thông Minh</h1>
        <p className="text-indigo-200 text-sm mt-1">Đăng nhập để đồng bộ giữa các thiết bị</p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 text-sm font-bold">
          <button type="button" onClick={() => { setMode('login'); setError(''); }} className={`py-2 rounded-lg transition ${mode === 'login' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500'}`}>Đăng nhập</button>
          <button type="button" onClick={() => { setMode('register'); setError(''); }} className={`py-2 rounded-lg transition ${mode === 'register' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500'}`}>Đăng ký</button>
        </div>

        <div className="relative">
          <User size={20} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input type="text" autoCapitalize="none" autoCorrect="off" autoComplete="username" placeholder="Tên đăng nhập" className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="relative">
          <Lock size={20} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mật khẩu" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {mode === 'register' && (
          <div className="relative">
            <Lock size={20} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        )}

        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3">{error}</div>}

        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow hover:bg-indigo-700 active:scale-[0.98] transition flex justify-center items-center disabled:opacity-60">
          {loading ? <Loader2 size={20} className="animate-spin" /> : (mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản')}
        </button>

        {mode === 'register' && (
          <p className="text-xs text-slate-400 leading-relaxed">Lưu ý: không có email nên <b>không thể lấy lại mật khẩu</b> nếu quên. Hãy ghi nhớ cẩn thận.</p>
        )}
      </form>
    </div>
  );
}

export default function SmartWardrobeApp() {
  const [isClient, setIsClient] = useState(false);
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [statusColors, setStatusColors] = useState(DEFAULT_STATUS_COLORS);
  const [newStatusColor, setNewStatusColor] = useState('slate');
  const [editingStatus, setEditingStatus] = useState(null); // { old, value }

  // Đăng nhập & đồng bộ đám mây
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!FIREBASE_ENABLED);
  const [cloudReady, setCloudReady] = useState(false);
  const [online, setOnline] = useState(true);
  const synced = useRef({ items: new Map(), settings: '' });

  // Tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');
  const [chipFilter, setChipFilter] = useState(null); // { field: 'status' | 'group', value }
  
  const [activeTab, setActiveTab] = useState('items'); // 'items', 'groups', 'form'
  const [editingItem, setEditingItem] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', location: '', group: '', status: DEFAULT_STATUSES[0], notes: '', image: null
  });
  
  // Custom Dialog State thay thế alert/confirm
  const [dialog, setDialog] = useState({ isOpen: false, type: '', message: '', onConfirm: null, onCancel: null });

  useEffect(() => {
    setIsClient(true);
    if (FIREBASE_ENABLED) return; // chế độ đám mây: dữ liệu lấy từ Firestore
    const savedData = localStorage.getItem(LOCAL_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setItems(parsed.items || []);
        setGroups(parsed.groups || DEFAULT_GROUPS);
        if (parsed.statuses && parsed.statuses.length > 0) setStatuses(parsed.statuses);
        if (parsed.statusColors) setStatusColors(parsed.statusColors);
      } catch (e) {
        console.error("Error parsing local storage data");
      }
    } else {
      setGroups(DEFAULT_GROUPS);
    }
  }, []);

  useEffect(() => {
    if (isClient && !FIREBASE_ENABLED) {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify({ items, groups, statuses, statusColors }));
      } catch (e) {
        showDialog('alert', 'Bộ nhớ đã đầy! Vui lòng xóa bớt hình ảnh cũ để tiếp tục.');
      }
    }
  }, [items, groups, statuses, statusColors, isClient]);

  // ===== Theo dõi mạng =====
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ===== Theo dõi trạng thái đăng nhập =====
  useEffect(() => {
    if (!FIREBASE_ENABLED) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        // Đăng xuất: xóa dữ liệu trên màn hình (dữ liệu vẫn còn trên đám mây)
        setCloudReady(false);
        setItems([]);
        setGroups(DEFAULT_GROUPS);
        setStatuses(DEFAULT_STATUSES);
        setStatusColors(DEFAULT_STATUS_COLORS);
        setActiveTab('items');
        setSearchQuery('');
        setChipFilter(null);
      }
      setAuthReady(true);
    });
  }, []);

  // ===== Nhận dữ liệu realtime từ Firestore =====
  useEffect(() => {
    if (!FIREBASE_ENABLED || !user) return;
    setCloudReady(false);
    synced.current = { items: new Map(), settings: '' };

    const loaded = { items: false, settings: false };
    const cloud = { itemCount: 0, hasSettings: false };
    let initialized = false;

    const finishIfReady = () => {
      if (initialized || !loaded.items || !loaded.settings) return;
      initialized = true;
      // Tài khoản mới + còn dữ liệu cũ trên máy -> chuyển lên đám mây
      if (cloud.itemCount === 0 && !cloud.hasSettings) {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) {
          try {
            const p = JSON.parse(raw);
            if ((p.items && p.items.length) || p.groups) {
              setItems(p.items || []);
              setGroups(p.groups || DEFAULT_GROUPS);
              if (p.statuses && p.statuses.length) setStatuses(p.statuses);
              if (p.statusColors) setStatusColors(p.statusColors);
              localStorage.setItem(BACKUP_KEY, raw); // giữ bản sao lưu
              localStorage.removeItem(LOCAL_KEY);
            }
          } catch (e) { console.error('Không đọc được dữ liệu cũ', e); }
        }
      }
      setCloudReady(true);
    };

    const unsubItems = onSnapshot(collection(db, 'users', user.uid, 'items'), (snap) => {
      const arr = snap.docs.map(d => d.data());
      arr.sort((a, b) => Number(b.id) - Number(a.id)); // mới nhất lên đầu
      synced.current.items = new Map(arr.map(i => [i.id, stable(i)]));
      cloud.itemCount = arr.length;
      setItems(arr);
      loaded.items = true;
      finishIfReady();
    }, (err) => console.error('Lỗi đọc đồ vật:', err));

    const unsubSettings = onSnapshot(doc(db, 'users', user.uid, 'meta', 'settings'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const g = d.groups || DEFAULT_GROUPS;
        const st = d.statuses && d.statuses.length ? d.statuses : DEFAULT_STATUSES;
        let colors = DEFAULT_STATUS_COLORS;
        try { colors = JSON.parse(d.statusColors || '{}'); } catch (e) {}
        synced.current.settings = JSON.stringify({ groups: g, statuses: st, statusColors: colors });
        setGroups(g);
        setStatuses(st);
        setStatusColors(colors);
        cloud.hasSettings = true;
      } else {
        cloud.hasSettings = false;
      }
      loaded.settings = true;
      finishIfReady();
    }, (err) => console.error('Lỗi đọc cài đặt:', err));

    return () => { unsubItems(); unsubSettings(); };
  }, [user]);

  // ===== Ghi thay đổi lên Firestore (chỉ ghi phần khác biệt) =====
  useEffect(() => {
    if (!FIREBASE_ENABLED || !user || !cloudReady) return;
    const uid = user.uid;

    const current = new Map();
    items.forEach(i => current.set(i.id, stable(clean(i))));

    current.forEach((str, id) => {
      if (synced.current.items.get(id) !== str) {
        synced.current.items.set(id, str);
        setDoc(doc(db, 'users', uid, 'items', id), JSON.parse(str)).catch(e => console.error('Lỗi lưu:', e));
      }
    });
    synced.current.items.forEach((_, id) => {
      if (!current.has(id)) {
        synced.current.items.delete(id);
        deleteDoc(doc(db, 'users', uid, 'items', id)).catch(e => console.error('Lỗi xóa:', e));
      }
    });

    const settingsStr = JSON.stringify({ groups, statuses, statusColors });
    if (synced.current.settings !== settingsStr) {
      synced.current.settings = settingsStr;
      setDoc(doc(db, 'users', uid, 'meta', 'settings'), {
        groups, statuses, statusColors: JSON.stringify(statusColors),
      }).catch(e => console.error('Lỗi lưu cài đặt:', e));
    }
  }, [items, groups, statuses, statusColors, cloudReady, user]);

  const confirmLogout = () => {
    showDialog('confirm', 'Đăng xuất khỏi tài khoản này? Dữ liệu vẫn được lưu an toàn trên đám mây.', () => {
      closeDialog();
      signOut(auth);
    });
  };

  const showDialog = (type, message, onConfirm = null) => {
    setDialog({ isOpen: true, type, message, onConfirm, onCancel: () => setDialog({ ...dialog, isOpen: false }) });
  };

  const closeDialog = () => setDialog({ ...dialog, isOpen: false });

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressedImage = await compressImage(file);
      setFormData((prev) => ({ ...prev, image: compressedImage }));
    }
    e.target.value = '';
  };

  const saveItem = () => {
    if (!formData.name.trim()) {
      showDialog('alert', 'Vui lòng nhập tên đồ vật!');
      return;
    }
    const finalGroup = formData.group || (groups.length > 0 ? groups[0] : 'Chưa phân loại');
    const itemData = {
      ...formData,
      group: finalGroup,
      id: editingItem ? editingItem.id : Date.now().toString(),
      updatedAt: new Date().toISOString()
    };

    if (editingItem) {
      setItems(items.map(i => i.id === itemData.id ? itemData : i));
    } else {
      setItems([itemData, ...items]);
    }
    openTab('items');
  };

  const deleteItem = (id) => {
    showDialog('confirm', 'Bạn có chắc chắn muốn xóa đồ vật này?', () => {
      setItems(items.filter(i => i.id !== id));
      closeDialog();
    });
  };

  // Cập nhật trạng thái trực tiếp từ tab Quản lý nhóm
  const updateItemStatus = (id, newStatus) => {
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, status: newStatus, updatedAt: new Date().toISOString() } 
        : item
    ));
  };

  const addGroup = (e) => {
    e.preventDefault();
    const newGroup = e.target.elements.groupName.value.trim();
    if (!newGroup) return;
    if (groups.includes(newGroup)) {
      showDialog('alert', 'Nhóm này đã tồn tại!');
      return;
    }
    setGroups([...groups, newGroup]);
    e.target.reset();
  };

  const deleteGroup = (groupName) => {
    const isUsed = items.some(item => item.group === groupName);
    if (isUsed) {
      showDialog('confirm', `Nhóm "${groupName}" đang chứa đồ vật. Xóa nhóm này sẽ chuyển các đồ vật về nhóm "Chưa phân loại". Tiếp tục?`, () => {
        setGroups(groups.filter(g => g !== groupName));
        setItems(items.map(i => i.group === groupName ? { ...i, group: 'Chưa phân loại' } : i));
        closeDialog();
      });
    } else {
      showDialog('confirm', `Bạn muốn xóa nhóm "${groupName}"?`, () => {
        setGroups(groups.filter(g => g !== groupName));
        closeDialog();
      });
    }
  };

  // ===== Quản lý trạng thái =====
  const getBadgeClass = (status) => (STATUS_PALETTE[statusColors[status]] || STATUS_PALETTE.slate).badge;

  const addStatus = (e) => {
    e.preventDefault();
    const name = e.target.elements.statusName.value.trim();
    if (!name) return;
    if (statuses.includes(name)) {
      showDialog('alert', 'Trạng thái này đã tồn tại!');
      return;
    }
    setStatuses([...statuses, name]);
    setStatusColors({ ...statusColors, [name]: newStatusColor });
    e.target.reset();
  };

  const renameStatus = () => {
    if (!editingStatus) return;
    const oldName = editingStatus.old;
    const newName = editingStatus.value.trim();
    if (!newName || newName === oldName) { setEditingStatus(null); return; }
    if (statuses.includes(newName)) {
      showDialog('alert', 'Trạng thái này đã tồn tại!');
      return;
    }
    setStatuses(statuses.map(st => st === oldName ? newName : st));
    setItems(items.map(i => i.status === oldName ? { ...i, status: newName } : i));
    const { [oldName]: oldColor, ...restColors } = statusColors;
    setStatusColors({ ...restColors, [newName]: oldColor || 'slate' });
    setEditingStatus(null);
  };

  const changeStatusColor = (name, colorKey) => {
    setStatusColors({ ...statusColors, [name]: colorKey });
  };

  const deleteStatus = (name) => {
    if (statuses.length <= 1) {
      showDialog('alert', 'Phải giữ lại ít nhất 1 trạng thái!');
      return;
    }
    const fallback = statuses.find(st => st !== name);
    const usedCount = items.filter(i => i.status === name).length;
    const msg = usedCount > 0
      ? `Có ${usedCount} đồ vật đang ở trạng thái "${name}". Xóa sẽ chuyển chúng sang "${fallback}". Tiếp tục?`
      : `Bạn muốn xóa trạng thái "${name}"?`;
    showDialog('confirm', msg, () => {
      setStatuses(statuses.filter(st => st !== name));
      setItems(items.map(i => i.status === name ? { ...i, status: fallback } : i));
      const { [name]: removed, ...restColors } = statusColors;
      setStatusColors(restColors);
      closeDialog();
    });
  };

  // ===== Tìm kiếm thông minh =====
  const filteredItems = useMemo(() => {
    if (chipFilter) {
      return items.filter(i => i[chipFilter.field] === chipFilter.value);
    }
    const tokens = removeAccents(searchQuery).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items;
    // Mọi từ khóa đều phải xuất hiện (ở bất kỳ trường nào)
    return items.filter(i => {
      const haystack = buildHaystack(i);
      return tokens.every(t => haystack.includes(t));
    });
  }, [items, searchQuery, chipFilter]);

  // Thẻ lọc nhanh: chỉ hiện trạng thái/nhóm đang có đồ vật
  const quickChips = useMemo(() => {
    const chips = [];
    statuses.forEach(st => {
      const count = items.filter(i => i.status === st).length;
      if (count > 0) chips.push({ field: 'status', value: st, count });
    });
    [...groups, 'Chưa phân loại'].forEach(g => {
      const count = items.filter(i => i.group === g).length;
      if (count > 0) chips.push({ field: 'group', value: g, count });
    });
    return chips;
  }, [items, groups, statuses]);

  const clearSearch = () => { setSearchQuery(''); setChipFilter(null); };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setChipFilter(null); // người dùng tự gõ -> bỏ lọc theo thẻ
  };

  const toggleChip = (chip) => {
    const isActive = chipFilter && chipFilter.field === chip.field && chipFilter.value === chip.value;
    if (isActive) {
      clearSearch();
    } else {
      setSearchQuery(chip.value);
      setChipFilter({ field: chip.field, value: chip.value });
    }
  };

  const isSearching = searchQuery.trim() !== '';

  const openForm = (item = null) => {
    if (item) {
      setFormData(item);
      setEditingItem(item);
    } else {
      setFormData({ name: '', location: '', group: groups[0] || 'Chưa phân loại', status: statuses[0], notes: '', image: null });
      setEditingItem(null);
    }
    setActiveTab('form');
  };

  const openTab = (tab) => {
    setActiveTab(tab);
    setEditingItem(null);
  };

  const renderItemsTab = () => (
    <div className="flex flex-col h-full bg-slate-50 pb-20 animate-in fade-in duration-300">
      <div className="bg-indigo-600 text-white p-5 pb-4 rounded-b-2xl shadow-md shrink-0 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold flex items-center min-w-0"><Package className="mr-2 shrink-0" /> <span className="truncate">Tủ Đồ Của Tôi</span></h1>
          {FIREBASE_ENABLED && user && (
            <button onClick={confirmLogout} className="shrink-0 flex items-center gap-1.5 bg-white/15 border border-white/25 px-2.5 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition">
              {online ? <Cloud size={14} /> : <CloudOff size={14} />}
              <span className="max-w-[80px] truncate">{(user.email || '').split('@')[0]}</span>
              <LogOut size={14} />
            </button>
          )}
        </div>
        <p className="text-indigo-200 text-sm mt-1">
          {isSearching ? `Tìm thấy ${filteredItems.length} / ${items.length} món đồ` : `Tổng số: ${items.length} món đồ`}
        </p>

        {/* Thanh tìm kiếm */}
        <div className="relative mt-3">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            enterKeyHint="search"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Tìm tên, vị trí, nhóm, ghi chú..."
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-white text-slate-800 placeholder-slate-400 text-sm outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
          />
          {searchQuery && (
            <button onClick={clearSearch} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-90 transition">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Thẻ lọc nhanh */}
        {quickChips.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
            {quickChips.map(chip => {
              const active = chipFilter && chipFilter.field === chip.field && chipFilter.value === chip.value;
              return (
                <button
                  key={chip.field + chip.value}
                  onClick={() => toggleChip(chip)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${active ? 'bg-white text-indigo-700 border-white' : 'bg-white/15 text-white border-white/30 hover:bg-white/25'}`}
                >
                  {chip.field === 'status'
                    ? <span className={`w-2 h-2 rounded-full ${(STATUS_PALETTE[statusColors[chip.value]] || STATUS_PALETTE.slate).dot} ${active ? '' : 'ring-1 ring-white/70'}`} />
                    : <FolderTree size={12} />}
                  {chip.value}
                  <span className={`text-[10px] ${active ? 'text-indigo-400' : 'text-indigo-200'}`}>{chip.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <ImageIcon size={48} className="mb-3 opacity-50" />
            <p>Chưa có đồ vật nào. Hãy thêm mới!</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4 text-slate-500">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <SearchX size={32} className="text-slate-400" />
            </div>
            <p className="font-medium text-slate-700 leading-relaxed">
              Không tìm thấy đồ vật nào phù hợp với từ khóa <span className="font-bold text-indigo-600 break-words">“{searchQuery}”</span>
            </p>
            <p className="text-xs text-slate-400 mt-2">Thử gõ ngắn hơn hoặc dùng từ khóa khác (không cần gõ dấu).</p>
            <button onClick={clearSearch} className="mt-5 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow hover:bg-indigo-700 active:scale-95 transition">
              Xóa tìm kiếm
            </button>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 flex p-3 relative transition-all">
              <div className="w-24 h-24 rounded-lg bg-slate-100 shrink-0 overflow-hidden relative">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={28} /></div>
                )}
              </div>
              <div className="ml-3 flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 pr-20 line-clamp-1">{item.name}</h3>
                  <div className="inline-flex items-center max-w-full text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md mt-1">
                    <span className="mr-1">📍</span><span className="truncate">{item.location || 'Chưa rõ vị trí'}</span>
                  </div>
                  <div className="flex items-center text-xs text-slate-500 mt-1.5">
                    <FolderTree size={12} className="mr-1 shrink-0" /> <span className="truncate">{item.group}</span>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">“{item.notes}”</p>
                  )}
                </div>
                <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md flex items-center self-start mt-2 border border-emerald-100">
                  <Clock size={12} className="mr-1" /> {formatTime(item.updatedAt)}
                </div>
              </div>

              {/* Badge & Actions */}
              <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${getBadgeClass(item.status)}`}>
                  {item.status}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => openForm(item)} className="p-1.5 text-blue-500 bg-blue-50 rounded-md hover:bg-blue-100"><Edit2 size={16} /></button>
                  <button onClick={() => deleteItem(item.id)} className="p-1.5 text-red-500 bg-red-50 rounded-md hover:bg-red-100"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <button onClick={() => openForm()} className="fixed bottom-24 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-20">
        <Plus size={28} />
      </button>
    </div>
  );

  const renderGroupsTab = () => (
    <div className="flex flex-col h-full bg-slate-50 pb-20 animate-in fade-in duration-300">
      <div className="bg-emerald-600 text-white p-5 rounded-b-2xl shadow-md shrink-0 sticky top-0 z-10">
        <h1 className="text-2xl font-bold flex items-center"><FolderTree className="mr-2" /> Quản lý Nhóm</h1>
        <p className="text-emerald-100 text-sm mt-1">Sắp xếp và cập nhật đồ vật theo nhóm</p>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        <form onSubmit={addGroup} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Thêm nhóm mới</label>
          <div className="flex gap-2">
            <input type="text" name="groupName" placeholder="Tên nhóm (VD: Đồ đi biển)..." className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
            <button type="submit" className="bg-emerald-600 text-white px-4 rounded-lg font-semibold hover:bg-emerald-700 active:scale-95 transition-all">Thêm</button>
          </div>
        </form>

        <div className="space-y-4">
          {[...groups, 'Chưa phân loại'].map(group => {
            const groupItems = items.filter(i => i.group === group);
            if (group === 'Chưa phân loại' && groupItems.length === 0) return null; // Ẩn nếu không có đồ chưa phân loại

            return (
              <div key={group} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Group Header */}
                <div className="bg-slate-100 p-3 flex justify-between items-center border-b border-slate-200">
                  <div className="flex items-center text-slate-800 font-bold">
                    <Tag size={16} className="mr-2 text-emerald-600" /> {group}
                    <span className="ml-2 text-xs font-normal bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{groupItems.length} món</span>
                  </div>
                  {group !== 'Chưa phân loại' && (
                    <button onClick={() => deleteGroup(group)} className="text-slate-400 hover:text-red-500 p-1">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                {/* Group Items List with Inline Status Update */}
                <div className="p-2 space-y-2">
                  {groupItems.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-4">Chưa có đồ vật nào trong nhóm này</div>
                  ) : (
                    groupItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="w-12 h-12 rounded bg-slate-200 shrink-0 overflow-hidden">
                          {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-3 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5"><MapPin size={10} className="inline mr-1" />{item.location || 'Chưa rõ'}</p>
                        </div>
                        {/* QUAN TRỌNG: Dropdown cập nhật trạng thái trực tiếp */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <select 
                            value={item.status}
                            onChange={(e) => updateItemStatus(item.id, e.target.value)}
                            className="bg-white border border-emerald-300 text-emerald-700 text-xs font-bold rounded p-1.5 focus:ring-2 focus:ring-emerald-500 outline-none max-w-[100px]"
                          >
                            {statuses.map(st => <option key={st} value={st}>{st}</option>)}
                          </select>
                          <span className="text-[9px] text-slate-400 block"><Clock size={8} className="inline mr-0.5"/>Vừa cập nhật</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="flex flex-col h-full bg-white animate-in fade-in slide-in-from-bottom-4 duration-300 z-30 absolute inset-0">
      <div className="bg-indigo-600 text-white p-4 shadow-md flex items-center shrink-0">
        <button onClick={() => openTab('items')} className="mr-3 p-1.5 rounded-full hover:bg-indigo-700 bg-indigo-500 transition">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">{editingItem ? 'Cập nhật đồ vật' : 'Thêm đồ vật mới'}</h1>
      </div>

      <div className="p-5 overflow-y-auto pb-24 flex-1 space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Hình ảnh đồ vật</label>
          <div className="relative w-full h-48 bg-slate-50 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 flex items-center justify-center">
            {formData.image ? (
              <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-slate-500"><Camera size={40} className="mx-auto mb-2 text-indigo-400" /><span className="text-sm font-medium">Chưa có ảnh</span></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <label className="flex items-center justify-center gap-2 p-3 bg-indigo-600 text-white rounded-xl font-bold text-sm cursor-pointer active:scale-95 transition">
              <Camera size={18} /> Chụp ảnh
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
            </label>
            <label className="flex items-center justify-center gap-2 p-3 bg-slate-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-sm cursor-pointer active:scale-95 transition">
              <ImageIcon size={18} /> Chọn từ thư viện
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Tên đồ vật *</label>
          <input type="text" placeholder="Ví dụ: Giày chạy bộ..." className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nhóm</label>
            <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none" value={formData.group} onChange={(e) => setFormData({...formData, group: e.target.value})}>
              <option value="" disabled>Chọn nhóm</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
              {formData.group && !groups.includes(formData.group) && <option value={formData.group}>{formData.group}</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Trạng thái</label>
            <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
              {statuses.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Vị trí hiện tại</label>
          <div className="relative">
            <MapPin size={20} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input type="text" placeholder="Ví dụ: Máy giặt, Ban công..." className="w-full pl-11 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Ghi chú</label>
          <textarea rows={3} placeholder="Ví dụ: Cần dùng cuối tuần, của bé..." className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none" value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
        </div>
      </div>

      <div className="absolute bottom-0 w-full p-4 bg-white border-t border-slate-100">
        <button onClick={saveItem} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:bg-indigo-700 active:scale-[0.98] transition flex justify-center items-center">
          {editingItem ? <CheckCircle2 size={20} className="mr-2" /> : <Plus size={20} className="mr-2" />}
          {editingItem ? 'Cập nhật thay đổi' : 'Lưu Đồ Vật'}
        </button>
      </div>
    </div>
  );

  const renderStatusTab = () => (
    <div className="flex flex-col h-full bg-slate-50 pb-20 animate-in fade-in duration-300">
      <div className="bg-violet-600 text-white p-5 rounded-b-2xl shadow-md shrink-0 sticky top-0 z-10">
        <h1 className="text-2xl font-bold flex items-center"><Tag className="mr-2" /> Quản lý Trạng thái</h1>
        <p className="text-violet-200 text-sm mt-1">Thêm, đổi tên, đổi màu hoặc xóa trạng thái</p>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        <form onSubmit={addStatus} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Thêm trạng thái mới</label>
          <div className="flex gap-2">
            <input type="text" name="statusName" placeholder="VD: Cần ủi, Đang sửa..." className="flex-1 min-w-0 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm" />
            <button type="submit" className="bg-violet-600 text-white px-4 rounded-lg font-semibold hover:bg-violet-700 active:scale-95 transition-all">Thêm</button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-slate-500 mr-1">Màu:</span>
            {Object.keys(STATUS_PALETTE).map(key => (
              <button type="button" key={key} onClick={() => setNewStatusColor(key)}
                className={`w-7 h-7 rounded-full ${STATUS_PALETTE[key].dot} ${newStatusColor === key ? 'ring-2 ring-offset-2 ring-violet-500' : ''}`} />
            ))}
          </div>
        </form>

        <div className="space-y-3">
          {statuses.map(st => {
            const count = items.filter(i => i.status === st).length;
            const isEditing = editingStatus && editingStatus.old === st;
            return (
              <div key={st} className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <input autoFocus type="text" value={editingStatus.value}
                        onChange={(e) => setEditingStatus({ ...editingStatus, value: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameStatus(); }}
                        className="flex-1 min-w-0 p-2 border border-violet-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm" />
                      <button onClick={renameStatus} className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold">Lưu</button>
                      <button onClick={() => setEditingStatus(null)} className="p-2 text-slate-400"><X size={18} /></button>
                    </>
                  ) : (
                    <>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide ${getBadgeClass(st)}`}>{st}</span>
                      <span className="text-xs text-slate-400 flex-1">{count} món</span>
                      <button onClick={() => setEditingStatus({ old: st, value: st })} className="p-1.5 text-blue-500 bg-blue-50 rounded-md hover:bg-blue-100"><Edit2 size={16} /></button>
                      <button onClick={() => deleteStatus(st)} className="p-1.5 text-red-500 bg-red-50 rounded-md hover:bg-red-100"><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {Object.keys(STATUS_PALETTE).map(key => (
                    <button key={key} onClick={() => changeStatusColor(st, key)}
                      className={`w-6 h-6 rounded-full ${STATUS_PALETTE[key].dot} ${(statusColors[st] || 'slate') === key ? 'ring-2 ring-offset-2 ring-violet-500' : ''}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderDialog = () => {
    if (!dialog.isOpen) return null;
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
          <div className={`p-4 flex items-center ${dialog.type === 'confirm' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
            <AlertTriangle size={24} className="mr-3" />
            <h3 className="font-bold text-lg">{dialog.type === 'confirm' ? 'Xác nhận' : 'Thông báo'}</h3>
          </div>
          <div className="p-5 text-slate-600 font-medium leading-relaxed">
            {dialog.message}
          </div>
          <div className="p-4 bg-slate-50 flex gap-3 justify-end border-t border-slate-100">
            {dialog.type === 'confirm' && (
              <button onClick={dialog.onCancel} className="px-5 py-2.5 rounded-lg font-bold text-slate-600 bg-white border border-slate-300 active:bg-slate-100">Hủy</button>
            )}
            <button onClick={dialog.onConfirm || dialog.onCancel} className={`px-5 py-2.5 rounded-lg font-bold text-white ${dialog.type === 'confirm' ? 'bg-amber-500 active:bg-amber-600' : 'bg-rose-500 active:bg-rose-600'}`}>
              Đồng ý
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!isClient) return null;

  const renderBottomNav = () => (
    <div className="absolute bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 flex justify-around items-center h-[72px] pb-safe z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
      <button onClick={() => openTab('items')} className={`flex flex-col items-center justify-center w-1/3 py-2 transition-colors ${activeTab === 'items' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
        <div className={`p-1.5 rounded-xl mb-1 ${activeTab === 'items' ? 'bg-indigo-100' : ''}`}><Package size={22} className={activeTab === 'items' ? 'stroke-[2.5]' : ''} /></div>
        <span className={`text-[11px] ${activeTab === 'items' ? 'font-bold' : 'font-medium'}`}>Đồ vật</span>
      </button>
      <button onClick={() => openTab('groups')} className={`flex flex-col items-center justify-center w-1/3 py-2 transition-colors ${activeTab === 'groups' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>
        <div className={`p-1.5 rounded-xl mb-1 ${activeTab === 'groups' ? 'bg-emerald-100' : ''}`}><Settings2 size={22} className={activeTab === 'groups' ? 'stroke-[2.5]' : ''} /></div>
        <span className={`text-[11px] ${activeTab === 'groups' ? 'font-bold' : 'font-medium'}`}>Quản lý Nhóm</span>
      </button>
      <button onClick={() => openTab('status')} className={`flex flex-col items-center justify-center w-1/3 py-2 transition-colors ${activeTab === 'status' ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}>
        <div className={`p-1.5 rounded-xl mb-1 ${activeTab === 'status' ? 'bg-violet-100' : ''}`}><Tag size={22} className={activeTab === 'status' ? 'stroke-[2.5]' : ''} /></div>
        <span className={`text-[11px] ${activeTab === 'status' ? 'font-bold' : 'font-medium'}`}>Trạng thái</span>
      </button>
    </div>
  );

  const frame = (children) => (
    <div className="min-h-screen bg-slate-900 flex justify-center items-center p-0 sm:p-4 selection:bg-indigo-200 font-sans">
      <div className="w-full h-[100dvh] sm:h-[850px] max-w-[400px] bg-white sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden sm:border-[8px] border-slate-800">
        <div className="hidden sm:block absolute top-0 inset-x-0 h-6 bg-slate-800 rounded-b-2xl w-40 mx-auto z-[60]"></div>
        {children}
      </div>
    </div>
  );

  const loadingView = (text) => (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
      <Loader2 size={32} className="animate-spin text-indigo-500" />
      <p className="text-sm">{text}</p>
    </div>
  );

  if (FIREBASE_ENABLED) {
    if (!authReady) return frame(loadingView('Đang khởi động...'));
    if (!user) return frame(<AuthScreen />);
    if (!cloudReady) return frame(loadingView('Đang tải dữ liệu...'));
  }

  return frame(
    <>
      {/* Vùng hiển thị View chính */}
      {activeTab === 'items' && renderItemsTab()}
      {activeTab === 'groups' && renderGroupsTab()}
      {activeTab === 'status' && renderStatusTab()}
      {activeTab === 'form' && renderForm()}

      {/* Navigation & Dialog */}
      {activeTab !== 'form' && renderBottomNav()}
      {renderDialog()}
    </>
  );
}
