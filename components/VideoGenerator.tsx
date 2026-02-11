
import React, { useState, useRef, useEffect } from 'react';
import { VideoMode, Resolution, AspectRatio, GenerationHistory, UserProfile } from '../types';
import { generateVeoVideo } from '../services/gemini';
import { 
  DIRECTOR_MODE_INSTRUCTION, 
  LINK_ANALYSIS_INSTRUCTION,
  SEAMLESS_FLOW_INSTRUCTION,
  IMAGE_GEN_INSTRUCTION,
  CONSISTENCY_IMAGE_GEN_INSTRUCTION
} from '../constants';
import { GoogleGenAI, Type } from "@google/genai";

interface VideoGeneratorProps {
  onGenerated: (item: GenerationHistory) => void;
  history: GenerationHistory[];
  onOpenPricing: () => void;
  profile: UserProfile;
  onKeyError: () => void;
  analyzedScript: string;
  setAnalyzedScript: (s: string) => void;
  directorScript: string;
  setDirectorScript: (s: string) => void;
  seamlessScript: string;
  setSeamlessScript: (s: string) => void;
  targetLink: string;
  setTargetLink: (l: string) => void;
  batchResults: {prompt: string, url: string}[];
  setBatchResults: (res: {prompt: string, url: string}[]) => void;
  generatedImageUrl: string | null;
  setGeneratedImageUrl: (url: string | null) => void;
}

enum ToolMode {
  NONE = 'NONE',
  DIRECTOR = 'DIRECTOR',
  LINK_ANALYSER = 'LINK_ANALYSER',
  SEAMLESS_FLOW = 'SEAMLESS_FLOW',
  IMAGE_GEN = 'IMAGE_GEN',
  BATCH_IMAGE_GEN = 'BATCH_IMAGE_GEN'
}

export const VideoGenerator: React.FC<VideoGeneratorProps> = ({ 
  onGenerated, history, onOpenPricing, profile, onKeyError,
  analyzedScript, setAnalyzedScript, directorScript, setDirectorScript,
  seamlessScript, setSeamlessScript, targetLink, setTargetLink,
  batchResults, setBatchResults, generatedImageUrl, setGeneratedImageUrl
}) => {
  const [mode, setMode] = useState<VideoMode>(VideoMode.TEXT_TO_VIDEO);
  const [toolMode, setToolMode] = useState<ToolMode>(ToolMode.NONE);
  const [concurrentRenderCount, setConcurrentRenderCount] = useState<0 | 3 | 5>(0);
  const [isFullVideoRendering, setIsFullVideoRendering] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState<'EN' | 'VN'>('EN');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.LANDSCAPE);
  const [resolution, setResolution] = useState<Resolution>(Resolution.R720P);

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editPromptValue, setEditPromptValue] = useState("");
  
  // Countdown states
  const [countdown, setCountdown] = useState(20);
  // Using any to avoid NodeJS.Timeout namespace issues in browser environment
  const countdownIntervalRef = useRef<any>(null);

  // Batch Image Gen state
  const [batchPrompts, setBatchPrompts] = useState("");
  const [refImage, setRefImage] = useState<string | null>(() => localStorage.getItem('veopro_ref_image'));

  useEffect(() => {
    if (refImage) localStorage.setItem('veopro_ref_image', refImage);
    else localStorage.removeItem('veopro_ref_image');
  }, [refImage]);

  const [modePrompts, setModePrompts] = useState<Record<VideoMode, string>>(() => {
    try {
      const saved = localStorage.getItem('veopro_mode_prompts');
      return saved ? JSON.parse(saved) : {
        [VideoMode.TEXT_TO_VIDEO]: '', [VideoMode.IMAGE_TO_VIDEO]: '', [VideoMode.INTERPOLATION]: '', [VideoMode.CONSISTENCY]: ''
      };
    } catch { return { [VideoMode.TEXT_TO_VIDEO]: '', [VideoMode.IMAGE_TO_VIDEO]: '', [VideoMode.INTERPOLATION]: '', [VideoMode.CONSISTENCY]: '' }; }
  });

  const [modeImages, setModeImages] = useState<Record<VideoMode, {url: string, name: string}[]>>(() => {
    try {
      const saved = localStorage.getItem('veopro_mode_images');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        [VideoMode.TEXT_TO_VIDEO]: parsed[VideoMode.TEXT_TO_VIDEO] || [],
        [VideoMode.IMAGE_TO_VIDEO]: parsed[VideoMode.IMAGE_TO_VIDEO] || [],
        [VideoMode.INTERPOLATION]: parsed[VideoMode.INTERPOLATION] || [],
        [VideoMode.CONSISTENCY]: parsed[VideoMode.CONSISTENCY] || [],
      };
    } catch {
      return { [VideoMode.TEXT_TO_VIDEO]: [], [VideoMode.IMAGE_TO_VIDEO]: [], [VideoMode.INTERPOLATION]: [], [VideoMode.CONSISTENCY]: [] };
    }
  });

  useEffect(() => { 
    try { localStorage.setItem('veopro_mode_prompts', JSON.stringify(modePrompts)); } catch(e) {}
  }, [modePrompts]);
  
  useEffect(() => { 
    try { localStorage.setItem('veopro_mode_images', JSON.stringify(modeImages)); } catch(e) {}
  }, [modeImages]);

  const [concurrentPrompts, setConcurrentPrompts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('veopro_concurrent_prompts');
      return saved ? JSON.parse(saved) : ['', '', '', '', ''];
    } catch { return ['', '', '', '', '']; }
  });

  useEffect(() => {
    try { localStorage.setItem('veopro_concurrent_prompts', JSON.stringify(concurrentPrompts)); } catch(e) {}
  }, [concurrentPrompts]);

  const [isGenerating, setIsGenerating] = useState(false);
  const isStoppingRef = useRef(false);
  const [activeTasks, setActiveTasks] = useState<GenerationHistory[]>([]);

  const [directorForm, setDirectorForm] = useState({ genre: 'Hành động', plot: '', mainChar: '' });
  const [seamlessForm, setSeamlessForm] = useState({ script: '', dna: '' });
  const [toolPromptCount, setToolPromptCount] = useState('10');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const specificSlotRef = useRef<{ index: number; subIndex?: number } | null>(null);
  const [showZaloQR, setShowZaloQR] = useState(false);

  const currentImages = modeImages[mode] || [];
  const currentPromptText = modePrompts[mode] || '';
  const updatePromptForMode = (newText: string) => setModePrompts(prev => ({ ...prev, [mode]: newText }));

  // Global countdown loop 20s
  const startCountdown = () => {
    setCountdown(20);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 20 : prev - 1));
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(20);
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const startEditTask = (task: GenerationHistory) => {
    setEditingTaskId(task.id);
    setEditPromptValue(task.prompt);
  };

  const saveEditTask = (taskId: string) => {
    setActiveTasks(prev => prev.map(t => t.id === taskId ? { ...t, prompt: editPromptValue } : t));
    setEditingTaskId(null);
  };

  const deleteTask = (taskId: string) => {
    setActiveTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  const downloadVideoFile = async (url: string, filename: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const runGenerationTask = async (prompt: string, index: number, total: number, laneId: string = '', prevVideoRef?: any, imagesSnapshot?: {url: string, name: string}[], modeSnapshot?: VideoMode) => {
    if (isStoppingRef.current) return null;
    
    const activeMode = modeSnapshot || mode;
    const activeImages = imagesSnapshot || currentImages;
    
    const taskId = `vpro-${Date.now()}-${laneId}-${index}`;
    const task: GenerationHistory = { 
      id: taskId, 
      url: '', 
      prompt, 
      timestamp: Date.now(), 
      mode: activeMode, 
      progress: 5, 
      status: `${laneId ? `Luồng ${laneId}: ` : ''}Đang tạo...` 
    };
    
    // Add to active tasks immediately for UI display
    setActiveTasks(prev => [task, ...prev]);
    
    try {
      let reqImages: string[] = [];
      if (!prevVideoRef) {
        if (activeMode === VideoMode.IMAGE_TO_VIDEO) {
          reqImages = [activeImages[index]?.url].filter(url => !!url);
        } else if (activeMode === VideoMode.INTERPOLATION) {
          reqImages = [activeImages[index*2]?.url, activeImages[index*2+1]?.url].filter(url => !!url);
        } else if (activeMode === VideoMode.CONSISTENCY) {
          reqImages = activeImages.map(img => img.url).filter(url => !!url);
        }
      }
      
      const apiKey = (sessionStorage.getItem('veopro_use_custom') === 'true' && sessionStorage.getItem('veopro_custom_key')) ? sessionStorage.getItem('veopro_custom_key')! : process.env.API_KEY;
      
      const result = await generateVeoVideo({ 
        mode: activeMode, prompt, resolution, aspectRatio, images: reqImages, 
        previousVideo: prevVideoRef, customApiKey: apiKey,
        onProgress: (msg) => {
          if (isStoppingRef.current) return;
          setActiveTasks(cur => cur.map(t => t.id === taskId ? { ...t, status: `${laneId ? `Luồng ${laneId}: ` : ''}${msg}`, progress: Math.min((t.progress || 5) + 3, 99) } : t));
        }
      });
      
      if (isStoppingRef.current) return null;

      const completed = { ...task, url: result.finalUrl, status: 'Hoàn thành', progress: 100 };
      onGenerated(completed);
      setActiveTasks(cur => cur.map(t => t.id === taskId ? completed : t));
      return result.videoRef; 
    } catch (err: any) {
      setActiveTasks(cur => cur.map(t => t.id === taskId ? { ...t, status: 'Lỗi', progress: 0 } : t));
      if (err.message?.includes("API Key")) onKeyError();
      return null;
    }
  };

  const handleRunFullVideo = async () => {
    const prompts = currentPromptText.split('\n').map(p => p.trim()).filter(p => p !== '');
    if (prompts.length === 0) { alert("Vui lòng nhập kịch bản nối mạch."); return; }
    
    setIsFullVideoRendering(true); setIsGenerating(true); isStoppingRef.current = false;
    startCountdown();
    
    const imagesSnapshot = JSON.parse(JSON.stringify(currentImages));
    const modeSnapshot = mode;
    
    let lastVideoRef = null;
    for (let i = 0; i < prompts.length; i++) {
      if (isStoppingRef.current) break;
      lastVideoRef = await runGenerationTask(prompts[i], i, prompts.length, 'CinemaFlow', lastVideoRef, imagesSnapshot, modeSnapshot);
    }
    setIsFullVideoRendering(false); setIsGenerating(false);
    stopCountdown();
  };

  const handleGenerate = async () => {
    setIsGenerating(true); isStoppingRef.current = false;
    startCountdown();
    
    const imagesSnapshot = JSON.parse(JSON.stringify(currentImages));
    const modeSnapshot = mode;
    
    try {
      if (concurrentRenderCount > 0) {
        const activePrompts = concurrentPrompts.slice(0, concurrentRenderCount).filter(p => p.trim() !== '');
        if (activePrompts.length === 0) { alert("Vui lòng nhập kịch bản cho các luồng."); setIsGenerating(false); return; }
        
        // Return 3/5 Streams: Optimize Promise.all for independent and efficient parallel rendering
        // Truly independent parallel logic - each stream starts immediately
        await Promise.all(activePrompts.map((p, i) => 
          runGenerationTask(p, i, activePrompts.length, (i + 1).toString(), undefined, imagesSnapshot, modeSnapshot)
        ));
      } else {
        const prompts = currentPromptText.split('\n').map(p => p.trim()).filter(p => p !== '');
        if (prompts.length === 0) { alert("Vui lòng nhập kịch bản."); setIsGenerating(false); return; }
        for (let i = 0; i < prompts.length; i++) {
          if (isStoppingRef.current) break;
          await runGenerationTask(prompts[i], i, prompts.length, '', undefined, imagesSnapshot, modeSnapshot);
        }
      }
    } finally { setIsGenerating(false); stopCountdown(); }
  };

  const handleStop = () => {
    isStoppingRef.current = true;
    setIsGenerating(false);
    setIsFullVideoRendering(false);
    stopCountdown();
    alert("🛑 DỪNG KHẨN CẤP: Hệ thống đã ngắt toàn bộ tác vụ đang chạy.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Explicitly cast to File[] to avoid unknown type property access errors
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    
    const activeMode = mode;
    const slot = specificSlotRef.current;
    
    files.forEach((file, fIdx) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setModeImages(prev => {
            const currentList = [...(prev[activeMode] || [])];
            if (slot) {
              let targetIdx = slot.index;
              if (activeMode === VideoMode.INTERPOLATION && slot.subIndex !== undefined) {
                targetIdx = slot.index * 2 + slot.subIndex;
              }
              const finalIdx = targetIdx + fIdx;
              while (currentList.length <= finalIdx) currentList.push({ url: '', name: '' });
              currentList[finalIdx] = { url: base64, name: file.name.split('.')[0] };
            } else {
              currentList.push({ url: base64, name: file.name.split('.')[0] });
            }
            return { ...prev, [activeMode]: currentList };
          });
        }
      };
      reader.readAsDataURL(file);
    });
    
    specificSlotRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRefImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setRefImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBatchImageGen = async () => {
    if (!batchPrompts.trim() || !refImage) { alert("Vui lòng nhập kịch bản và tải lên ảnh đầu."); return; }
    setIsGenerating(true); isStoppingRef.current = false;
    startCountdown();
    
    const lines = batchPrompts.split('\n').map(l => l.trim()).filter(l => l !== '');
    
    try {
      const apiKey = (sessionStorage.getItem('veopro_use_custom') === 'true' && sessionStorage.getItem('veopro_custom_key')) ? sessionStorage.getItem('veopro_custom_key')! : process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      const getRawBase64 = (b64: string) => b64.includes(',') ? b64.split(',')[1] : b64;

      for (const line of lines) {
        if (isStoppingRef.current) break;
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: {
            parts: [
              { inlineData: { data: getRawBase64(refImage), mimeType: 'image/png' } },
              { text: `Current scene prompt: ${line}` }
            ]
          },
          config: {
            systemInstruction: CONSISTENCY_IMAGE_GEN_INSTRUCTION,
            imageConfig: {
              aspectRatio: aspectRatio === AspectRatio.LANDSCAPE ? "16:9" : "9:16",
              imageSize: "1K"
            }
          }
        });

        if (isStoppingRef.current) break;

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const url = `data:image/png;base64,${part.inlineData.data}`;
            setBatchResults([...batchResults, { prompt: line, url }]);
            break;
          }
        }
      }
    } catch (err) { alert("Lỗi render ảnh."); } finally { setIsGenerating(false); stopCountdown(); }
  };

  const handleToolGenerate = async (tMode: ToolMode) => {
    setIsGenerating(true); isStoppingRef.current = false;
    startCountdown();
    try {
      const apiKey = (sessionStorage.getItem('veopro_use_custom') === 'true' && sessionStorage.getItem('veopro_custom_key')) ? sessionStorage.getItem('veopro_custom_key')! : process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const langText = outputLanguage === 'EN' ? 'Anh Mỹ (English US)' : 'Việt Nam (Vietnamese)';

      if (tMode === ToolMode.IMAGE_GEN) {
        const prompt = `Script/Context: ${seamlessForm.script}. Character DNA/Description: ${seamlessForm.dna}. Genre/Style: ${directorForm.genre}. Ngôn ngữ yêu cầu: ${langText}.`;
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts: [{ text: prompt }] },
          config: {
            systemInstruction: IMAGE_GEN_INSTRUCTION,
            imageConfig: {
              aspectRatio: aspectRatio === AspectRatio.LANDSCAPE ? "16:9" : aspectRatio === AspectRatio.PORTRAIT ? "9:16" : "1:1",
              imageSize: "1K"
            }
          }
        });
        
        if (isStoppingRef.current) return;

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            setGeneratedImageUrl(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      } else {
        let instruction = '', content = '';
        if (tMode === ToolMode.DIRECTOR) { instruction = DIRECTOR_MODE_INSTRUCTION; content = `Thể loại: ${directorForm.genre}. Plot: ${directorForm.plot}. DNA: ${directorForm.mainChar}. Số cảnh: ${toolPromptCount}. Ngôn ngữ yêu cầu: ${langText}.`; }
        else if (tMode === ToolMode.LINK_ANALYSER) { instruction = LINK_ANALYSIS_INSTRUCTION; content = `Youtube: ${targetLink}. Cảnh: ${toolPromptCount}. Ngôn ngữ yêu cầu: ${langText}.`; }
        else if (tMode === ToolMode.SEAMLESS_FLOW) { instruction = SEAMLESS_FLOW_INSTRUCTION; content = `Kịch bản: ${seamlessForm.script}. DNA: ${seamlessForm.dna}. Cảnh: ${toolPromptCount}. Ngôn ngữ yêu cầu: ${langText}.`; }
        
        const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: content, config: { systemInstruction: instruction } });
        
        if (isStoppingRef.current) return;
        
        const text = response.text || '';
        if (tMode === ToolMode.DIRECTOR) setDirectorScript(text); else if (tMode === ToolMode.LINK_ANALYSER) setAnalyzedScript(text); else if (tMode === ToolMode.SEAMLESS_FLOW) setSeamlessScript(text);
        const extracted = text.match(/\[.*?\]/g); if (extracted) updatePromptForMode(extracted.map(p => p.slice(1, -1)).join('\n'));
      }
    } catch (err) { alert("Lỗi AI Studio."); } finally { setIsGenerating(false); stopCountdown(); }
  };

  const renderScriptView = (text: string, title: string) => (
    <div className="flex-1 bg-white p-4 font-serif leading-relaxed text-slate-900 overflow-y-auto custom-scrollbar shadow-inner min-h-0 relative">
      <div className="sticky top-0 right-0 z-30 flex justify-end mb-2">
        <button onClick={() => { navigator.clipboard.writeText(text); alert("Copy xong!"); }} className="bg-indigo-600 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase active:scale-95">📋 Copy</button>
      </div>
      <h3 className="text-base font-black text-center mb-3 uppercase underline decoration-2 underline-offset-4 decoration-indigo-500 italic">{title}</h3>
      {toolMode === ToolMode.IMAGE_GEN && generatedImageUrl ? (
        <div className="flex flex-col items-center space-y-4">
          <img src={generatedImageUrl} className="w-full rounded-2xl shadow-2xl border-4 border-slate-100" alt="Generated Cinematic" />
          <button onClick={() => {
             const link = document.createElement('a');
             link.href = generatedImageUrl;
             link.download = `cinematic_dna_${Date.now()}.png`;
             link.click();
          }} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95">📥 Tải Ảnh</button>
        </div>
      ) : (
        <div className="space-y-3">{text ? text.split('\n').map((line, idx) => (<p key={idx} className={line.startsWith('[') ? 'bg-indigo-50 p-2 rounded-xl border border-indigo-100 italic text-[10px]' : 'text-slate-700 text-[10px]'}>{line}</p>)) : <div className="h-full flex items-center justify-center text-slate-300 italic font-black text-xs opacity-30">Studio Output...</div>}</div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col flex-1 bg-[#f8fafc] p-2 overflow-hidden font-sans text-slate-800 h-full max-h-full">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-2 px-4 bg-white py-2 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-xl flex-shrink-0 gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => { setToolMode(ToolMode.DIRECTOR); setConcurrentRenderCount(0); }} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all border-2 active:scale-95 ${toolMode === ToolMode.DIRECTOR ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-indigo-600 border-slate-100'}`}>🎬 Đạo diễn Hollywood</button>
          <button onClick={() => { setToolMode(ToolMode.LINK_ANALYSER); setConcurrentRenderCount(0); }} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all border-2 active:scale-95 ${toolMode === ToolMode.LINK_ANALYSER ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-600 border-slate-100'}`}>🔗 Phân tích Link Youtube</button>
          <button onClick={() => { setToolMode(ToolMode.SEAMLESS_FLOW); setConcurrentRenderCount(0); }} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all border-2 active:scale-95 ${toolMode === ToolMode.SEAMLESS_FLOW ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-emerald-600 border-slate-100'}`}>🔗 Prompt liền mạch</button>
          <button onClick={() => { setToolMode(ToolMode.BATCH_IMAGE_GEN); setBatchPrompts(seamlessScript || analyzedScript || directorScript || ""); }} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all border-2 active:scale-95 bg-white text-cyan-600 border-cyan-100 hover:border-cyan-400 hover:bg-cyan-50 shadow-sm`}>🖼️ Tạo ảnh cuối cho mỗi prompt</button>
          <button onClick={() => { setToolMode(ToolMode.IMAGE_GEN); setConcurrentRenderCount(0); }} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all border-2 active:scale-95 ${toolMode === ToolMode.IMAGE_GEN ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-amber-600 border-slate-100'}`}>🎨 Tạo ảnh từ Kịch bản và DNA</button>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setShowZaloQR(true)} className="flex items-center space-x-2 text-[9px] text-blue-600 font-black bg-white px-3 py-1.5 rounded-full border-2 border-blue-100 shadow-lg active:scale-95 transition-all hover:border-blue-200"><span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-[7px]">Hỗ trợ</span><span>KỸ THUẬT AI</span></button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-2 min-h-0 overflow-hidden">
        {/* LEFT COLUMN */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <div className="bg-white border-2 border-slate-200 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col flex-1 overflow-hidden relative border-t-[6px] border-t-indigo-600 min-h-0">
            <div className="flex bg-slate-50/50 border-b-2 border-slate-100 flex-shrink-0 overflow-x-auto no-scrollbar">
              {['📝 Văn bản', '🖼️ Ảnh sang Video', '🎞️ Ảnh Đầu-Cuối', '🎭 Nhân vật DNA'].map((lbl, idx) => (
                <button key={idx} onClick={() => { setMode(Object.values(VideoMode)[idx]); setToolMode(ToolMode.NONE); setConcurrentRenderCount(0); }} className={`px-4 py-3 text-[9px] font-black border-r-2 border-slate-100 uppercase transition-all flex-1 whitespace-nowrap ${mode === Object.values(VideoMode)[idx] && toolMode === ToolMode.NONE ? 'bg-white text-indigo-600 shadow-[inset_0_4px_0_#4f46e5]' : 'text-slate-400 hover:bg-white/50'}`}>{lbl}</button>
              ))}
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/20 overflow-hidden">
              {toolMode === ToolMode.BATCH_IMAGE_GEN ? (
                <div className="p-4 space-y-4 h-full flex flex-col overflow-hidden bg-cyan-50/20">
                  <div className="flex justify-between items-center"><h4 className="text-xs font-black text-cyan-700 uppercase italic">Tạo chuỗi ảnh đồng nhất DNA cho Phim</h4><button onClick={() => { if(confirm("Xóa toàn bộ kết quả tạo ảnh?")) setBatchResults([]); }} className="text-[7px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-md uppercase">Xóa kết quả</button></div>
                  <div className="flex-1 flex gap-4 min-h-0">
                    <div className="flex-1 flex flex-col gap-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase">Danh sách Prompt (Mỗi dòng 1 prompt):</label>
                       <textarea value={batchPrompts} onChange={e => setBatchPrompts(e.target.value)} className="flex-1 bg-white border-2 border-slate-200 rounded-2xl p-4 text-[10px] font-bold outline-none focus:border-cyan-400 resize-none shadow-inner custom-scrollbar" placeholder="Dán các prompt đã phân tích vào đây...\nVí dụ: [Cinematic 16:9] A man running through a neon city..." />
                    </div>
                    <div className="w-64 flex flex-col gap-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase">Ảnh tham chiếu DNA (Ảnh đầu):</label>
                       <div onClick={() => refImageInputRef.current?.click()} className="flex-1 bg-white border-2 border-dashed border-cyan-200 rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden shadow-inner group relative">
                          {refImage ? <img src={refImage} className="w-full h-full object-cover" /> : <span className="text-[8px] font-black text-slate-300 uppercase text-center px-4">Click để tải ảnh nhân vật gốc</span>}
                          <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 transition-all"></div>
                       </div>
                       <input type="file" ref={refImageInputRef} onChange={handleRefImageChange} hidden accept="image/*" />
                    </div>
                  </div>
                  <div className="h-40 bg-white border-2 border-slate-100 rounded-2xl flex gap-2 p-2 overflow-x-auto no-scrollbar shadow-inner">
                    {batchResults.map((res, idx) => (
                      <div key={idx} className="flex-shrink-0 w-32 relative group">
                        <img src={res.url} className="w-full h-full object-cover rounded-xl border-2 border-cyan-100 shadow-md" />
                        <div className="absolute inset-0 bg-black/60 text-white text-[7px] font-black opacity-0 group-hover:opacity-100 transition-all rounded-xl p-2 flex flex-col items-center justify-center text-center">
                           <span className="mb-2 line-clamp-2">#{idx+1}: {res.prompt}</span>
                           <button onClick={() => {
                              const link = document.createElement('a');
                              link.href = res.url;
                              link.download = `scene_dna_${idx+1}.png`;
                              link.click();
                           }} className="bg-cyan-500 px-3 py-1 rounded-full active:scale-90 mb-1">TẢI</button>
                           <button onClick={() => setBatchResults(batchResults.filter((_, i) => i !== idx))} className="bg-red-500 px-3 py-1 rounded-full active:scale-90">XÓA</button>
                        </div>
                      </div>
                    ))}
                    {batchResults.length === 0 && <div className="flex-1 flex items-center justify-center text-slate-300 text-[8px] uppercase font-black italic opacity-30 tracking-widest">Chờ lệnh tạo ảnh chuỗi...</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setToolMode(ToolMode.NONE)} className="flex-1 py-3 bg-white border-2 border-slate-100 rounded-xl font-black text-[9px] text-slate-400 active:scale-95 uppercase">QUAY LẠI</button>
                    <button onClick={handleBatchImageGen} disabled={isGenerating} className="flex-[3] py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl font-black text-[10px] shadow-lg shadow-cyan-200 active:scale-95 uppercase italic tracking-wider">
                      {isGenerating ? `RENDER DNA (ĐANG CHẠY - ${countdown}S)...` : '⚡ BẮT ĐẦU TẠO CHUỒI ẢNH ĐỒNG NHẤT DNA'}
                    </button>
                  </div>
                </div>
              ) : toolMode !== ToolMode.NONE ? (
                <div className="p-4 space-y-3 h-full flex flex-col overflow-hidden min-h-0">
                  <div className="flex justify-between items-center"><h4 className="text-[10px] font-black text-slate-400 uppercase">Hệ thống kịch bản chuyên sâu</h4>{toolMode === ToolMode.IMAGE_GEN && generatedImageUrl && <button onClick={() => setGeneratedImageUrl(null)} className="text-[7px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-md uppercase">Xóa ảnh kết quả</button>}</div>
                  <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 flex flex-col space-y-2 overflow-y-auto custom-scrollbar pr-1">
                      {(toolMode === ToolMode.DIRECTOR || toolMode === ToolMode.IMAGE_GEN) && <>
                        <textarea value={directorForm.plot} onChange={e => setDirectorForm({...directorForm, plot: e.target.value})} className="h-20 bg-white border-2 border-slate-200 rounded-xl p-2 text-[10px] font-medium outline-none focus:border-indigo-400 resize-none" placeholder="Tóm tắt cốt truyện..." />
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Thể loại Phim:</label>
                          <select value={directorForm.genre} onChange={e => setDirectorForm({...directorForm, genre: e.target.value})} className="bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black outline-none transition-all focus:border-indigo-400">
                            <option>Hành động</option>
                            <option>Tình cảm</option>
                            <option>Kinh dị</option>
                            <option>Viễn tưởng</option>
                            <option>Phim giã sử</option>
                            <option>Phim Cổ xưa ( Thời tiền sử)</option>
                            <option>Phim Hoạt hình 2D(3D)</option>
                          </select>
                        </div>
                        <textarea value={directorForm.mainChar} onChange={e => setDirectorForm({...directorForm, mainChar: e.target.value})} className="h-16 bg-white border-2 border-slate-200 rounded-xl p-2 text-[10px] font-medium focus:border-indigo-400 resize-none outline-none" placeholder="DNA nhân vật..." />
                      </>}
                      {toolMode === ToolMode.LINK_ANALYSER && <input value={targetLink} onChange={e => setTargetLink(e.target.value)} className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-[10px] font-bold focus:border-blue-400 outline-none" placeholder="Link Youtube..." />}
                      {(toolMode === ToolMode.SEAMLESS_FLOW || toolMode === ToolMode.IMAGE_GEN) && <>
                        <textarea value={seamlessForm.script} onChange={e => setSeamlessForm({...seamlessForm, script: e.target.value})} className="h-20 bg-white border-2 border-slate-200 rounded-xl p-2 text-[10px] font-medium focus:border-emerald-400 resize-none outline-none" placeholder="Nội dung kịch bản..." />
                        <textarea value={seamlessForm.dna} onChange={e => setSeamlessForm({...seamlessForm, dna: e.target.value})} className="h-16 bg-white border-2 border-slate-200 rounded-xl p-2 text-[10px] font-medium focus:border-emerald-400 resize-none outline-none" placeholder="DNA cố định..." />
                      </>}
                    </div>
                    <div className="flex-[1.2] min-h-0 flex flex-col border-2 border-slate-100 rounded-[1.5rem] overflow-hidden shadow-2xl">
                      {renderScriptView(
                        toolMode === ToolMode.DIRECTOR ? directorScript : 
                        toolMode === ToolMode.LINK_ANALYSER ? analyzedScript : 
                        toolMode === ToolMode.SEAMLESS_FLOW ? seamlessScript : 
                        "AI Cinematic Generator", 
                        toolMode === ToolMode.IMAGE_GEN ? "DNA Image Preview" : "Hollywood Studio"
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setOutputLanguage('EN')} className={`flex-1 py-2.5 rounded-xl text-[8px] font-black uppercase border-2 transition-all active:scale-95 ${outputLanguage === 'EN' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600'}`}>EN (ANH MỸ)</button>
                    <button onClick={() => setOutputLanguage('VN')} className={`flex-1 py-2.5 rounded-xl text-[8px] font-black uppercase border-2 transition-all active:scale-95 ${outputLanguage === 'VN' ? 'bg-red-600 text-white' : 'bg-white text-red-600'}`}>VN (VIỆT NAM)</button>
                    <div className="flex items-center gap-1 bg-white border-2 border-slate-200 rounded-xl px-2 h-[38px] shadow-sm">
                       <span className="text-[8px] font-black text-slate-400 uppercase">Cảnh:</span>
                       <input type="number" min="1" max="100" value={toolPromptCount} onChange={e => setToolPromptCount(e.target.value)} className="py-1 text-[10px] font-black w-10 text-center outline-none bg-white text-black border border-slate-100 rounded" />
                    </div>
                    <button onClick={() => handleToolGenerate(toolMode)} disabled={isGenerating} className={`flex-[3] py-3.5 rounded-xl font-black text-[9px] uppercase shadow-lg active:scale-95 italic transition-all ${toolMode === ToolMode.IMAGE_GEN ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}>
                        {isGenerating ? `RENDER (CHỜ ${countdown}S)...` : toolMode === ToolMode.IMAGE_GEN ? '⚡ TẠO ẢNH NHÂN VẬT DNA' : '⚡ XUẤT PROMPTS HOLLYWOOD STUDIO'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 p-2 overflow-y-auto custom-scrollbar min-h-0 bg-slate-50/10 no-scrollbar">
                  {concurrentRenderCount > 0 ? (
                    <div className="space-y-3 p-2">
                       <div className="flex justify-between items-center"><h4 className="text-[10px] font-black text-amber-600 uppercase italic tracking-widest mb-2">⚡ RENDER {concurrentRenderCount} LUỒNG SONG SONG</h4><button onClick={() => { if(confirm("Xóa toàn bộ kịch bản luồng?")) setConcurrentPrompts(['','','','','']); }} className="text-[7px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-md uppercase">Xóa kịch bản</button></div>
                       {concurrentPrompts.slice(0, concurrentRenderCount).map((p, idx) => (
                         <div key={idx} className="bg-white border-2 border-amber-100 p-3 rounded-2xl shadow-sm">
                            <span className="text-[9px] font-black text-amber-500 uppercase italic">LUỒNG #{idx+1}</span>
                            <textarea value={p} onChange={e => { const n = [...concurrentPrompts]; n[idx] = e.target.value; setConcurrentPrompts(n); }} className="w-full mt-2 bg-slate-50 p-3 rounded-xl text-[10px] font-bold outline-none h-20 resize-none border focus:border-amber-400" placeholder={`Nhập kịch bản cho luồng ${idx+1}...`} />
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kịch bản phân cảnh</span><button onClick={() => { if(confirm("Xóa toàn bộ kịch bản phân cảnh?")) updatePromptForMode(""); }} className="text-[7px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-md uppercase">Xóa kịch bản</button></div>
                      {currentPromptText.split('\n').map((line, i) => (
                        <div key={i} className="flex flex-col group">
                          <div className={`flex gap-2 p-2 bg-white border-2 rounded-[1rem] shadow-sm relative hover:shadow-md ${line ? 'border-indigo-100' : 'border-slate-100'}`}>
                             <div className="flex items-center justify-start"><span className="text-[9px] font-black text-indigo-600 italic">#{i+1}</span></div>
                             
                             {(mode === VideoMode.IMAGE_TO_VIDEO) && (
                                <div className="w-14 h-14 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg overflow-hidden cursor-pointer flex items-center justify-center shadow-inner group/img" onClick={() => { specificSlotRef.current = { index: i }; fileInputRef.current?.click(); }}>
                                  {currentImages[i]?.url ? <img src={currentImages[i].url} className="w-full h-full object-cover" alt="preview" /> : <span className="text-[7px] font-black text-slate-300 uppercase text-center leading-tight">Tải ảnh</span>}
                                </div>
                             )}
                             
                             {(mode === VideoMode.INTERPOLATION) && (
                                <div className="flex gap-1">
                                  <div className="w-12 h-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg overflow-hidden cursor-pointer flex items-center justify-center shadow-inner" onClick={() => { specificSlotRef.current = { index: i, subIndex: 0 }; fileInputRef.current?.click(); }}>
                                    {currentImages[i*2]?.url ? <img src={currentImages[i*2].url} className="w-full h-full object-cover" alt="start" /> : <span className="text-[6px] font-black text-slate-300">ĐẦU</span>}
                                  </div>
                                  <div className="w-12 h-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg overflow-hidden cursor-pointer flex items-center justify-center shadow-inner" onClick={() => { specificSlotRef.current = { index: i, subIndex: 1 }; fileInputRef.current?.click(); }}>
                                    {currentImages[i*2+1]?.url ? <img src={currentImages[i*2+1].url} className="w-full h-full object-cover" alt="end" /> : <span className="text-[6px] font-black text-slate-300">CUỐI</span>}
                                  </div>
                                </div>
                             )}
                             
                             <textarea value={line} onChange={e => { const n = currentPromptText.split('\n'); n[i] = e.target.value; updatePromptForMode(n.join('\n')); }} className="flex-1 bg-white border-2 border-slate-100 outline-none text-[10px] font-bold py-1.5 px-2 h-14 rounded-xl focus:border-indigo-400 shadow-inner resize-none" placeholder={`Kịch bản cảnh #${i+1}...`} />
                             <button onClick={() => { const n = currentPromptText.split('\n'); n.splice(i, 1); updatePromptForMode(n.join('\n')); }} className="absolute -right-1 -top-1 bg-red-500 text-white w-5 h-5 rounded-full text-[9px] font-black shadow-lg flex items-center justify-center active:scale-90 z-20">✕</button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => updatePromptForMode(currentPromptText + (currentPromptText ? '\n' : ''))} className="mt-2 ml-10 py-1 px-3 border-2 border-dashed border-indigo-200 rounded-xl text-[8px] font-black text-indigo-300 hover:text-indigo-600 transition-all uppercase tracking-widest">+ THÊM CẢNH</button>
                    </div>
                  )}

                  {mode === VideoMode.CONSISTENCY && (
                    <div className="mt-4 p-3 bg-indigo-50/50 rounded-[1.5rem] border-2 border-indigo-100 shadow-inner">
                      <div className="flex justify-between items-center mb-3"><span className="text-[8px] font-black uppercase text-indigo-800 italic tracking-widest">🧬 KHO DNA NHÂN VẬT ({currentImages.length})</span><div className="flex gap-2"><button onClick={() => { if(confirm("Xóa toàn bộ DNA?")) setModeImages(prev => ({...prev, [mode]: []})); }} className="text-[7px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-md uppercase">Xóa hết</button><button onClick={() => { specificSlotRef.current = null; fileInputRef.current?.click(); }} className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[8px] font-black shadow-lg hover:bg-indigo-700 transition-colors">TẢI DNA</button></div></div>
                      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar no-scrollbar">
                        {currentImages.map((img, idx) => (
                          <div key={idx} className="relative flex-shrink-0 w-24 bg-white p-1 rounded-xl border-2 border-indigo-100 shadow-xl overflow-hidden">
                            <img src={img.url} className="w-full aspect-square object-cover rounded-lg mb-1" alt={`dna-${idx}`} />
                            <input value={img.name} onChange={e => { const n = [...currentImages]; n[idx].name = e.target.value; setModeImages(prev => ({...prev, [mode]: n})); }} className="w-full text-[7px] font-black text-center text-indigo-600 bg-slate-50 rounded-md py-0.5 outline-none uppercase" placeholder="Tên..." />
                            <button onClick={() => setModeImages(prev => ({ ...prev, [mode]: prev[mode].filter((_, i) => i !== idx) }))} className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full text-[8px] flex items-center justify-center font-black active:scale-90 shadow-md">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* ACTION FOOTER */}
            <div className="p-2 bg-white border-t-2 border-slate-50 flex flex-col sm:flex-row items-center justify-between flex-shrink-0 shadow-2xl gap-2">
              <button onClick={handleGenerate} disabled={isGenerating} className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-4 py-3 rounded-xl font-black text-[10px] shadow-lg uppercase active:scale-95 w-full sm:flex-[1.2] italic transition-all hover:shadow-indigo-200">{isGenerating ? `RENDER (${countdown}S)...` : '🚀 TẠO VIDEO'}</button>
              
              <div className="w-full sm:flex-[1.5] bg-slate-50 border-2 border-slate-100 rounded-xl p-1 flex gap-1 shadow-inner">
                 {[AspectRatio.LANDSCAPE, AspectRatio.PORTRAIT, AspectRatio.SQUARE].map((ratio) => (
                    <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`flex-1 py-1 rounded-lg text-[8px] font-black transition-all active:scale-95 ${aspectRatio === ratio ? 'bg-white text-blue-600 shadow-md border border-blue-100' : 'text-slate-400 hover:text-slate-600 uppercase'}`}>{ratio === AspectRatio.LANDSCAPE ? '16:9' : ratio === AspectRatio.PORTRAIT ? '9:16' : '1:1'}</button>
                 ))}
              </div>

              <div className="flex-[0.8] bg-white border-2 border-slate-100 rounded-xl px-2 py-1 flex items-center gap-1 shadow-sm">
                 <span className="text-[7px] font-black text-slate-400 uppercase">Res:</span>
                 <select value={resolution} onChange={e => setResolution(e.target.value as Resolution)} className="bg-transparent text-[9px] font-black outline-none text-blue-600 uppercase cursor-pointer">
                    <option value={Resolution.R720P}>720</option>
                    <option value={Resolution.R1080P}>1080</option>
                 </select>
              </div>

              {isGenerating ? <button onClick={handleStop} className="bg-red-500 text-white px-3 py-3 rounded-xl font-black text-[9px] uppercase animate-pulse shadow-lg w-full sm:flex-1 italic">🛑 DỪNG</button> : <button onClick={onOpenPricing} className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg active:scale-95 w-full sm:flex-1 italic transition-all hover:from-emerald-600 hover:to-teal-500">💳 BẢN QUYỀN</button>}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (SUPERVISION) */}
        <div className="flex-1 lg:flex-[0.75] flex flex-col min-w-0 h-full overflow-hidden">
          <div className="bg-white border-2 border-slate-200 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col flex-1 border-t-[6px] border-t-blue-600 overflow-hidden min-h-0 relative">
            <div className="bg-slate-900 text-white p-2.5 border-b border-white/5 flex justify-between items-center flex-shrink-0 shadow-lg">
              <div className="flex items-center space-x-2"><span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></span><span className="text-[10px] font-black uppercase italic tracking-widest">Supervision Panel</span></div>
              <div className="flex gap-1">
                 <button onClick={() => { setConcurrentRenderCount(3); }} className={`text-[7px] font-black px-2 py-1 rounded-lg border transition-all active:scale-95 ${concurrentRenderCount === 3 ? 'bg-amber-500 text-white border-amber-600 shadow-lg' : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10'}`}>3 Luồng</button>
                 <button onClick={() => { setConcurrentRenderCount(5); }} className={`text-[7px] font-black px-2 py-1 rounded-lg border transition-all active:scale-95 ${concurrentRenderCount === 5 ? 'bg-amber-500 text-white border-amber-600 shadow-lg' : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10'}`}>5 Luồng</button>
                 {concurrentRenderCount > 0 && <button onClick={() => setConcurrentRenderCount(0)} className="text-[7px] font-black px-2 py-1 rounded-lg border bg-red-500 text-white border-red-600 active:scale-95 shadow-md">TẮT</button>}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 p-2 space-y-2 min-h-0 no-scrollbar">
              <div className="flex justify-between items-center px-1"><span className="text-[8px] font-black text-slate-400 uppercase italic">Kết quả Render ({activeTasks.length})</span>{activeTasks.length > 0 && <button onClick={() => { if(confirm("Xóa danh sách video đang hiển thị?")) setActiveTasks([]); }} className="text-[7px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-md uppercase">Xóa danh sách</button>}</div>
              {activeTasks.map((task, idx) => (
                <div key={task.id} className="p-2 border-2 rounded-[1rem] bg-white shadow-lg relative overflow-hidden border-indigo-50 hover:border-blue-300 group transition-all">
                  <div className="absolute top-1.5 left-1.5 z-20"><input type="checkbox" checked={selectedTaskIds.has(task.id)} onChange={() => toggleSelectTask(task.id)} className="w-4 h-4 rounded-md checked:bg-blue-600 cursor-pointer shadow-sm border-slate-200" /></div>
                  <div className="absolute top-1.5 right-1.5 z-20 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditTask(task)} title="Sửa kịch bản" className="bg-white/90 p-1 rounded-md text-blue-600 shadow-md text-[9px] hover:bg-blue-50 transition-colors">✏️</button>
                    <button onClick={() => downloadVideoFile(task.url, task.id)} title="Tải video" className="bg-white/90 p-1 rounded-md text-emerald-600 shadow-md text-[9px] hover:bg-emerald-50 transition-colors" disabled={!task.url}>💾</button>
                    <button onClick={() => deleteTask(task.id)} title="Xóa" className="bg-white/90 p-1 rounded-md text-red-600 shadow-md text-[9px] hover:bg-red-50 transition-colors">🗑️</button>
                  </div>
                  <div className="flex justify-between items-start mb-1.5 mt-0.5">
                    <div className="flex-1 pr-12 pl-6">
                      {editingTaskId === task.id ? (
                        <div className="flex gap-1"><input value={editPromptValue} onChange={e => setEditPromptValue(e.target.value)} className="flex-1 text-[8px] font-bold border rounded px-1 outline-none focus:border-blue-300 bg-white text-black" /><button onClick={() => saveEditTask(task.id)} className="text-[8px] bg-blue-600 text-white px-1.5 rounded font-black active:scale-95">OK</button></div>
                      ) : (
                        <p className="text-[9px] font-black text-slate-800 line-clamp-1 italic uppercase tracking-tighter">#{activeTasks.length - idx}: {task.prompt}</p>
                      )}
                      <p className="text-[8px] text-blue-600 font-bold uppercase italic tracking-tighter">{task.status}</p>
                    </div>
                    <div className="text-[9px] font-black text-indigo-400 italic">{task.progress}%</div>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-1.5"><div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-1000" style={{ width: `${task.progress}%` }}></div></div>
                  {task.url && <video src={task.url} controls playsInline crossOrigin="anonymous" className="w-full rounded-lg shadow-inner border border-slate-100 bg-black aspect-video" />}
                </div>
              ))}
              {activeTasks.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-40"><span className="text-3xl mb-3">🎬</span><span className="text-[8px] font-black uppercase tracking-widest italic tracking-[0.2em]">Ready for action...</span></div>}
            </div>
            
            <div className="p-2 bg-gradient-to-br from-slate-900 to-slate-950 border-t-[4px] border-t-emerald-500 shadow-2xl flex-shrink-0 flex gap-2">
               <button onClick={handleRunFullVideo} disabled={isGenerating} className={`flex-1 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-[0.1em] transition-all relative overflow-hidden shadow-xl active:scale-95 ${isFullVideoRendering ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white hover:from-emerald-600 hover:to-teal-500'}`}><span className="relative z-10 italic">{isFullVideoRendering ? `RENDERING (${countdown}S)...` : '▶ TẠO VIDEO LIỀN MẠCH'}</span></button>
               <button onClick={() => { const s = activeTasks.filter(t => selectedTaskIds.has(t.id) && t.url); s.forEach((t, i) => setTimeout(() => downloadVideoFile(t.url, `cinema_${t.id}`), i*1000)); }} className="flex-1 py-3.5 rounded-xl font-black text-[9px] uppercase bg-blue-600 text-white shadow-xl active:scale-95 flex items-center justify-center gap-1 italic transition-all hover:bg-blue-700"><span>📁 LƯU VÀO MÁY</span>{selectedTaskIds.size > 0 && <span className="bg-white text-blue-600 px-1.5 py-0.5 rounded-full text-[7px]">{selectedTaskIds.size}</span>}</button>
            </div>
          </div>
        </div>
      </div>

      {showZaloQR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 z-[500] animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center relative shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95">
            <button onClick={() => setShowZaloQR(false)} className="absolute top-6 right-6 font-black text-2xl text-slate-300 hover:text-red-500 transition-all active:scale-75">✕</button>
            <h3 className="text-xl font-black mb-6 italic uppercase tracking-tighter text-slate-800">HỖ TRỢ KỸ THUẬT AI</h3>
            <div className="bg-slate-50 p-4 rounded-3xl mb-6 shadow-inner">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://zalo.me/0973480488`} className="mx-auto rounded-[2rem] shadow-xl border-4 border-white w-48" alt="QR Zalo" />
            </div>
            <p className="text-xl font-black text-blue-600 italic tracking-tighter">0973.480.488</p>
            <p className="text-[9px] font-black text-slate-400 mt-4 uppercase tracking-widest">Phòng Lab AI Studio Phục vụ 24/7</p>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple hidden accept="image/*" />
      <input type="file" ref={refImageInputRef} onChange={handleRefImageChange} hidden accept="image/*" />
    </div>
  );
};
