
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'generate' | 'pricing';
  setActiveTab: (tab: 'generate' | 'pricing') => void;
  hasApiKey: boolean;
  onOpenKeyPicker: () => void;
  profile: UserProfile;
  onProfileUpdate: (newProfile: UserProfile) => void;
  usageCount: number;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  hasApiKey, 
  onOpenKeyPicker,
  profile,
  onProfileUpdate,
  usageCount
}) => {
  const [useCustomKey, setUseCustomKey] = useState(() => sessionStorage.getItem('veopro_use_custom') === 'true');
  const [showKeyPopup, setShowKeyPopup] = useState(false);
  const [customKeyData, setCustomKeyData] = useState({
    apiKey: sessionStorage.getItem('veopro_custom_key') || '',
    projectId: sessionStorage.getItem('veopro_project_id') || ''
  });

  const handleToggleCustom = (checked: boolean) => {
    setUseCustomKey(checked);
    sessionStorage.setItem('veopro_use_custom', checked.toString());
    if (checked && !customKeyData.apiKey) {
      setShowKeyPopup(true);
    }
  };

  const handleSaveKeys = () => {
    sessionStorage.setItem('veopro_custom_key', customKeyData.apiKey);
    sessionStorage.setItem('veopro_project_id', customKeyData.projectId);
    setShowKeyPopup(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f1f5f9] text-slate-800">
      <header className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center space-x-10">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-blue-700 tracking-tighter uppercase italic">Veo3 YOHU-pro</h1>
            <span className="text-[9px] font-bold text-slate-400 -mt-1 uppercase tracking-widest">Cinema Pro Continuity Engine</span>
          </div>
          <nav className="flex space-x-1">
            <button 
              onClick={() => setActiveTab('generate')}
              className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${activeTab === 'generate' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Tạo Video
            </button>
            <button 
              onClick={() => setActiveTab('pricing')}
              className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${activeTab === 'pricing' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              TRUNG TÂM KÍCH HOẠT BẢN QUYỀN
            </button>
          </nav>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center bg-slate-50 px-5 py-2.5 rounded-full border border-slate-200 shadow-inner">
             <label className="flex items-center cursor-pointer group">
               <span className="text-[10px] font-black uppercase text-slate-500 mr-4 group-hover:text-blue-600 transition">Dùng Key riêng</span>
               <div className="relative">
                 <input 
                   type="checkbox" 
                   className="sr-only" 
                   checked={useCustomKey}
                   onChange={(e) => handleToggleCustom(e.target.checked)}
                 />
                 <div className={`w-11 h-6 bg-slate-300 rounded-full shadow-inner transition ${useCustomKey ? 'bg-blue-500' : ''}`}></div>
                 <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition transform ${useCustomKey ? 'translate-x-5' : ''}`}></div>
               </div>
             </label>
             {useCustomKey && (
               <button onClick={() => setShowKeyPopup(true)} className="ml-4 text-[9px] font-black text-blue-600 uppercase underline hover:text-blue-800 transition">Cài đặt</button>
             )}
          </div>
          
          <div className="flex flex-col items-end">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {profile.machineId}</div>
            <div className="text-[9px] font-bold text-green-500 uppercase tracking-widest animate-pulse">● Hệ thống Online</div>
          </div>
        </div>
      </header>

      {/* Popup Nhập Key */}
      {showKeyPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-md shadow-[0_0_120px_rgba(0,0,0,0.6)] border-8 border-blue-50 animate-in zoom-in-95">
              <h3 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tighter italic text-center">⚙️ Cấu hình API Cá nhân</h3>
              <div className="space-y-5 mb-10">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-4 tracking-widest">Google API Key (AI Studio)</label>
                    <input 
                      type="password" 
                      value={customKeyData.apiKey}
                      onChange={e => setCustomKeyData({...customKeyData, apiKey: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold focus:border-blue-400 outline-none transition shadow-inner"
                      placeholder="Dán API Key..."
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-4 tracking-widest">Project ID / Name</label>
                    <input 
                      type="text" 
                      value={customKeyData.projectId}
                      onChange={e => setCustomKeyData({...customKeyData, projectId: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold focus:border-blue-400 outline-none transition shadow-inner"
                      placeholder="Project ID..."
                    />
                 </div>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => { setShowKeyPopup(false); setUseCustomKey(false); }} className="flex-1 py-5 rounded-3xl font-black text-xs uppercase tracking-widest border-2 border-slate-100 text-slate-400 hover:bg-slate-50 transition">Hủy bỏ</button>
                 <button onClick={handleSaveKeys} className="flex-[2] py-5 rounded-3xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white shadow-lg active:scale-95 transition">💾 Lưu & Kích hoạt</button>
              </div>
           </div>
        </div>
      )}

      <div className="flex-1 overflow-auto flex flex-col min-h-0">
        {children}
      </div>
      
      <footer className="bg-white border-t border-slate-200 px-8 py-2.5 text-[11px] text-slate-500 font-medium flex justify-between items-center shadow-inner flex-shrink-0">
        <div className="flex items-center space-x-4">
          <span className="text-blue-600 font-black italic uppercase tracking-widest">Studio Status:</span>
          <span className="bg-green-100 text-green-700 px-4 py-1 rounded-full font-black text-[9px] uppercase tracking-tighter shadow-sm">● Sẵn sàng</span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
             <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm border transition-colors cursor-default ${profile.accountType === 'Miễn phí 100%' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>SỬ DỤNG: {usageCount} ({profile.accountType})</span>
             {profile.accountType === 'Gói Chuyên Nghiệp 1' && <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm border border-emerald-100 hover:bg-emerald-100 transition-colors cursor-default">License: PRO-01 (ACTIVE)</span>}
             {profile.accountType === 'Gói Chuyên Nghiệp 9' && <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm border border-blue-100 hover:bg-blue-100 transition-colors cursor-default">License: PRO-09 (PREMIUM)</span>}
          </div>
        </div>
        <div className="opacity-40 font-black text-[9px] tracking-[0.4em]">V3.1.0-CINEMA-PRO-STATION</div>
      </footer>
    </div>
  );
};
