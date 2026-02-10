
import React, { useState, useRef } from 'react';
import { SUBSCRIPTION_PLANS, BANK_INFO } from '../constants';
import { SubscriptionPlan, UserProfile } from '../types';

interface PricingProps {
  onClose?: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  currentProfile: UserProfile;
}

export const Pricing: React.FC<PricingProps> = ({ onClose, onUpdateProfile, currentProfile }) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    // Cuộn xuống phần thanh toán khi chọn gói
    setTimeout(() => {
      paymentRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleConfirmActivation = () => {
    if (!selectedPlan) {
      alert("Vui lòng chọn một gói để kích hoạt.");
      return;
    }

    // Mô phỏng việc kích hoạt bản quyền
    const newProfile: UserProfile = {
      ...currentProfile,
      accountType: selectedPlan.name,
      expiryDate: selectedPlan.duration === 'Vĩnh viễn' ? 'Vĩnh viễn' : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN'),
      limitText: selectedPlan.videoLimitText,
      licenseInfo: `Bản quyền: YOHU-PRO Studio. Gói: ${selectedPlan.name}`
    };

    onUpdateProfile(newProfile);
    alert(`Chúc mừng! Bạn đã kích hoạt thành công ${selectedPlan.name}. Hệ thống sẽ cập nhật quyền hạn ngay lập tức.`);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-lg flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] shadow-[0_0_60px_rgba(0,0,0,0.3)] w-full max-w-6xl overflow-hidden animate-in zoom-in-95 flex flex-col relative border border-slate-200 max-h-[95vh]">
        
        {/* Modal Header */}
        <div className="bg-indigo-950 text-white px-8 py-5 flex items-center justify-between border-b border-white/5 shadow-md flex-shrink-0">
          <div className="flex items-center space-x-4">
            <div className="w-4 h-4 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.6)]"></div>
            <div className="flex flex-col">
              <span className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">TRUNG TÂM KÍCH HOẠT BẢN QUYỀN V3.7</span>
              <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest italic">Hệ thống AI Chuyên nghiệp</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="bg-white/10 hover:bg-red-500 text-white w-10 h-10 rounded-2xl flex items-center justify-center transition-all font-black text-xl shadow-inner active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="p-10 overflow-y-auto flex flex-col items-center flex-1 bg-slate-50/50 custom-scrollbar">
          <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter uppercase text-center drop-shadow-sm">NÂNG CẤP BẢN QUYỀN</h2>
          <p className="text-slate-400 font-bold text-xs mb-12 uppercase tracking-[0.4em] text-center italic">Sản xuất video Hollywood chuyên nghiệp - Nối cảnh liên tục</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl mb-14">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div 
                key={plan.id} 
                className={`bg-white rounded-[2.5rem] border-2 flex flex-col items-center p-8 transition-all duration-500 group cursor-pointer relative ${selectedPlan?.id === plan.id ? 'border-emerald-500 shadow-2xl shadow-emerald-100 scale-105' : 'border-slate-100 shadow-xl hover:border-emerald-200'}`}
                onClick={() => handleSelectPlan(plan)}
              >
                {selectedPlan?.id === plan.id && (
                   <div className="absolute -top-4 bg-emerald-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase shadow-lg animate-bounce z-10">GÓI ĐANG CHỌN</div>
                )}
                
                <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tight text-center group-hover:text-emerald-600 transition">{plan.name}</h3>
                
                <div className="w-full space-y-3 mb-10">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl py-3 px-4 text-center">
                    <span className="text-[12px] font-black text-emerald-800">THỜI HẠN: {plan.duration}</span>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl py-3 px-4 text-center">
                    <span className="text-[11px] font-black text-indigo-800 uppercase tracking-tighter">{plan.videoLimitText}</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl py-3 px-4 text-center">
                    <span className="text-[11px] font-black text-amber-800 uppercase tracking-tighter">⚡ RENDER {plan.concurrentLimit} LUỒNG SONG SONG</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl py-3 px-4 text-center">
                    <span className="text-[11px] font-black text-blue-800 uppercase tracking-tighter">🔄 {plan.stitchTime}</span>
                  </div>
                </div>

                <div className="text-4xl font-black text-slate-900 mb-1 tracking-tighter">{plan.price}</div>
                <div className="text-[10px] text-slate-400 font-black mb-10 uppercase tracking-[0.2em]">{plan.subtitle}</div>

                <button 
                  className={`w-full py-5 rounded-2xl font-black text-sm transition shadow-xl active:scale-95 uppercase tracking-widest ${selectedPlan?.id === plan.id ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  {selectedPlan?.id === plan.id ? 'SẴN SÀNG THANH TOÁN' : 'CHỌN GÓI NÀY'}
                </button>
              </div>
            ))}
          </div>

          <div ref={paymentRef} className={`w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-10 bg-white border rounded-[3rem] p-12 shadow-2xl relative overflow-hidden transition-all duration-700 ${selectedPlan ? 'border-indigo-500 opacity-100 translate-y-0' : 'border-slate-200 opacity-50 translate-y-10'}`}>
            <div className="absolute top-0 left-0 w-3 h-full bg-indigo-500"></div>
            
            <div className="flex flex-col justify-center">
              <div className="inline-flex items-center space-x-3 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-2xl w-fit mb-8 border border-indigo-100">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-lg animate-pulse"></span>
                <span className="text-[11px] font-black uppercase tracking-widest text-indigo-800">THÔNG TIN THANH TOÁN & BẢN QUYỀN</span>
              </div>
              
              <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition shadow-sm">
                  <p className="text-[10px] text-slate-400 font-black uppercase mb-2 tracking-widest">NGÂN HÀNG THỤ HƯỞNG</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tighter italic">{BANK_INFO.bank}</p>
                </div>
                
                <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 hover:border-indigo-200 transition shadow-sm">
                  <p className="text-[10px] text-slate-400 font-black uppercase mb-2 tracking-widest">SỐ TÀI KHOẢN (MB BANK)</p>
                  <p className="text-4xl font-black text-indigo-700 tracking-tighter select-all">{BANK_INFO.account}</p>
                </div>
                
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition shadow-sm">
                  <p className="text-[10px] text-slate-400 font-black uppercase mb-2 tracking-widest">CHỦ SỞ HỮU BẢN QUYỀN</p>
                  <p className="text-xl font-black text-slate-800 uppercase tracking-widest">{BANK_INFO.name}</p>
                </div>

                <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200 shadow-inner">
                  <p className="text-[13px] font-bold text-amber-900 leading-relaxed italic">
                    💡 Nội dung chuyển khoản: <span className="font-black text-red-600 underline decoration-red-300 decoration-2">{BANK_INFO.name} + {selectedPlan?.name || "Gói của bạn"}</span>
                    <br/>
                    <span className="text-[11px] mt-2 block text-amber-700 font-medium">Lưu ý: Sau khi thanh toán, hãy bấm nút "XÁC NHẬN ĐÃ CHUYỂN KHOẢN" để hệ thống cập nhật.</span>
                  </p>
                </div>

                <button 
                  onClick={handleConfirmActivation}
                  disabled={!selectedPlan}
                  className={`w-full py-6 rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${selectedPlan ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                  XÁC NHẬN ĐÃ CHUYỂN KHOẢN
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center bg-slate-50 rounded-[2.5rem] border border-slate-200 shadow-inner p-10">
              <div className="bg-white p-6 rounded-[2rem] shadow-2xl mb-8 transform hover:scale-105 transition duration-500 border border-slate-100 relative group">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=MB|${BANK_INFO.account}|KhaiPham|${selectedPlan?.price || '0'}|${BANK_INFO.name}+${selectedPlan?.name || ''}`} 
                  className="w-64 h-64 rounded-xl shadow-lg border-2 border-slate-50 relative z-10" 
                  alt="Mã QR Thanh toán" 
                />
              </div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] text-center mb-1">MÃ VIETQR CHUẨN QUỐC GIA</p>
              <p className="text-[9px] font-bold text-slate-300 text-center uppercase tracking-tighter">{BANK_INFO.name} • YOHU-PRO STUDIO v3.7</p>
              
              {selectedPlan && (
                <div className="mt-8 text-center bg-white px-6 py-4 rounded-3xl border border-indigo-100 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số tiền thanh toán</p>
                  <p className="text-3xl font-black text-indigo-600 tracking-tighter">{selectedPlan.price}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest flex-shrink-0">
           <span>YOHU-PRO Studio Professional v3.7-FREE-VN</span>
           <span className="text-emerald-600">● KẾT NỐI BẢO MẬT SSL 256-BIT</span>
           <span>Hệ thống tự động 24/7</span>
        </div>
      </div>
    </div>
  );
};
