import React, { useState, useEffect } from 'react';
import { Camera, Plus, MapPin, Clock, Trash2, ArrowLeft, Image as ImageIcon, Edit2, Package, FolderTree, X, Tag, Settings2, AlertTriangle, CheckCircle2 } from 'lucide-react';

const DEFAULT_GROUPS = ['Đồ đang phơi', 'Đồ dùng hàng ngày', 'Đồ lưu kho'];
const DEFAULT_STATUSES = ['Đang dơ', 'Đang giặt', 'Sạch', 'Chờ khô'];

export default function SmartWardrobeApp() {
  const [isClient, setIsClient] = useState(false);
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [statuses] = useState(DEFAULT_STATUSES);
  
  const [activeTab, setActiveTab] = useState('items'); // 'items', 'groups', 'form'
  const [editingItem, setEditingItem] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', location: '', group: '', status: DEFAULT_STATUSES[0], image: null
  });
  
  // Custom Dialog State thay thế alert/confirm
  const [dialog, setDialog] = useState({ isOpen: false, type: '', message: '', onConfirm: null, onCancel: null });

  useEffect(() => {
    setIsClient(true);
    const savedData = localStorage.getItem('smart_wardrobe_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setItems(parsed.items || []);
        setGroups(parsed.groups || DEFAULT_GROUPS);
      } catch (e) {
        console.error("Error parsing local storage data");
      }
    } else {
      setGroups(DEFAULT_GROUPS);
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        localStorage.setItem('smart_wardrobe_data', JSON.stringify({ items, groups }));
      } catch (e) {
        showDialog('alert', 'Bộ nhớ đã đầy! Vui lòng xóa bớt hình ảnh cũ để tiếp tục.');
      }
    }
  }, [items, groups, isClient]);

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
      setFormData({ ...formData, image: compressedImage });
    }
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

  const openForm = (item = null) => {
    if (item) {
      setFormData(item);
      setEditingItem(item);
    } else {
      setFormData({ name: '', location: '', group: groups[0] || 'Chưa phân loại', status: statuses[0], image: null });
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
      <div className="bg-indigo-600 text-white p-5 rounded-b-2xl shadow-md shrink-0 sticky top-0 z-10">
        <h1 className="text-2xl font-bold flex items-center"><Package className="mr-2" /> Tủ Đồ Của Tôi</h1>
        <p className="text-indigo-200 text-sm mt-1">Tổng số: {items.length} món đồ</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <ImageIcon size={48} className="mb-3 opacity-50" />
            <p>Chưa có đồ vật nào. Hãy thêm mới!</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 flex p-3 relative transition-all">
              <div className="w-24 h-24 rounded-lg bg-slate-100 shrink-0 overflow-hidden relative">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={28} /></div>
                )}
              </div>
              <div className="ml-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 pr-12 line-clamp-1">{item.name}</h3>
                  <div className="flex items-center text-xs text-slate-500 mt-1">
                    <FolderTree size={12} className="mr-1" /> {item.group}
                  </div>
                  <div className="flex items-center text-xs text-slate-500 mt-0.5">
                    <MapPin size={12} className="mr-1" /> {item.location || 'Chưa rõ vị trí'}
                  </div>
                </div>
                <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md flex items-center self-start mt-2 border border-emerald-100">
                  <Clock size={12} className="mr-1" /> {formatTime(item.updatedAt)}
                </div>
              </div>
              
              {/* Badge & Actions */}
              <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                <span className="text-[10px] font-bold px-2 py-1 bg-slate-800 text-white rounded-md uppercase tracking-wide">
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
          <label className="block relative w-full h-48 bg-slate-50 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition">
            {formData.image ? (
              <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-slate-500"><Camera size={40} className="mx-auto mb-2 text-indigo-400" /><span className="text-sm font-medium">Chạm để chụp / Tải ảnh</span></div>
            )}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
          </label>
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
      </div>

      <div className="absolute bottom-0 w-full p-4 bg-white border-t border-slate-100">
        <button onClick={saveItem} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:bg-indigo-700 active:scale-[0.98] transition flex justify-center items-center">
          {editingItem ? <CheckCircle2 size={20} className="mr-2" /> : <Plus size={20} className="mr-2" />}
          {editingItem ? 'Cập nhật thay đổi' : 'Lưu Đồ Vật'}
        </button>
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
      <button onClick={() => openTab('items')} className={`flex flex-col items-center justify-center w-1/2 py-2 transition-colors ${activeTab === 'items' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
        <div className={`p-1.5 rounded-xl mb-1 ${activeTab === 'items' ? 'bg-indigo-100' : ''}`}><Package size={22} className={activeTab === 'items' ? 'stroke-[2.5]' : ''} /></div>
        <span className={`text-[11px] ${activeTab === 'items' ? 'font-bold' : 'font-medium'}`}>Đồ vật</span>
      </button>
      <button onClick={() => openTab('groups')} className={`flex flex-col items-center justify-center w-1/2 py-2 transition-colors ${activeTab === 'groups' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>
        <div className={`p-1.5 rounded-xl mb-1 ${activeTab === 'groups' ? 'bg-emerald-100' : ''}`}><Settings2 size={22} className={activeTab === 'groups' ? 'stroke-[2.5]' : ''} /></div>
        <span className={`text-[11px] ${activeTab === 'groups' ? 'font-bold' : 'font-medium'}`}>Quản lý Nhóm</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex justify-center items-center p-0 sm:p-4 selection:bg-indigo-200 font-sans">
      <div className="w-full h-[100dvh] sm:h-[850px] max-w-[400px] bg-white sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden sm:border-[8px] border-slate-800">
        <div className="hidden sm:block absolute top-0 inset-x-0 h-6 bg-slate-800 rounded-b-2xl w-40 mx-auto z-[60]"></div>
        
        {/* Vùng hiển thị View chính */}
        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'groups' && renderGroupsTab()}
        {activeTab === 'form' && renderForm()}

        {/* Navigation & Dialog */}
        {activeTab !== 'form' && renderBottomNav()}
        {renderDialog()}
      </div>
    </div>
  );
}