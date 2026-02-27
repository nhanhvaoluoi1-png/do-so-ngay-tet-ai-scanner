/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, XCircle, Loader2, History, ScanLine, Info, Trophy, LogOut, Clock, Key, Ticket, ShieldCheck, AlertCircle, Music, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LotteryService, ScanResult, LotteryRegion } from './services/lotteryService';
import confetti from 'canvas-confetti';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const lotteryService = new LotteryService();

const STATIONS: Record<LotteryRegion, string[]> = {
  'MN': ['TP.HCM', 'Vĩnh Long', 'Bình Dương', 'Trà Vinh', 'Long An', 'Hậu Giang', 'Bình Phước', 'Tiền Giang', 'Kiên Giang', 'Đà Lạt', 'Đồng Tháp', 'Cà Mau', 'Bến Tre', 'Vũng Tàu', 'Bạc Liêu', 'Đồng Nai', 'Cần Thơ', 'Sóc Trăng', 'Tây Ninh', 'An Giang', 'Bình Thuận'],
  'MT': ['Khánh Hòa', 'Kon Tum', 'Phú Yên', 'Thừa Thiên Huế', 'Đắk Lắk', 'Quảng Nam', 'Đà Nẵng', 'Quảng Ngãi', 'Đắk Nông', 'Gia Lai', 'Ninh Thuận', 'Quảng Trị', 'Bình Định'],
  'MB': ['Miền Bắc']
};

const Lantern = ({ className }: { className?: string }) => (
  <div className={`flex flex-col items-center lantern-swing ${className}`}>
    <div className="w-1 h-6 bg-festive-gold" />
    <div className="w-10 h-12 bg-festive-red rounded-full border-2 border-festive-gold relative flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 flex justify-between px-1">
        <div className="w-0.5 h-full bg-festive-gold/30" />
        <div className="w-0.5 h-full bg-festive-gold/30" />
        <div className="w-0.5 h-full bg-festive-gold/30" />
      </div>
      <span className="text-[8px] font-bold text-festive-gold z-10">TẾT</span>
    </div>
    <div className="w-6 h-2 bg-festive-gold rounded-b-lg" />
    <div className="flex space-x-1 mt-[-2px]">
      <div className="w-0.5 h-4 bg-festive-gold" />
      <div className="w-0.5 h-4 bg-festive-gold" />
      <div className="w-0.5 h-4 bg-festive-gold" />
    </div>
  </div>
);

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [lotteryData, setLotteryData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Nhạc nền: Festive/Spring music (Instrumental)
    // Sử dụng link ổn định hơn
    const audio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'); 
    audio.loop = true;
    audio.volume = 0.3;
    audio.preload = "auto";
    
    audio.onerror = () => {
      // Silent fallback if primary fails
      if (audio.src !== 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3') {
        audio.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
        audio.load();
      }
    };

    audio.onplay = () => setIsMusicPlaying(true);
    audio.onpause = () => setIsMusicPlaying(false);

    bgMusicRef.current = audio;

    const winAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
    winAudio.volume = 0.8;
    winAudio.preload = "auto";
    winSoundRef.current = winAudio;

    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, []);

  const toggleMusic = async () => {
    if (!bgMusicRef.current) return;
    
    if (bgMusicRef.current.paused) {
      try {
        await bgMusicRef.current.play();
      } catch (e) {
        console.log("Audio play blocked or failed", e);
        setError("Không thể phát nhạc. Vui lòng thử lại.");
      }
    } else {
      bgMusicRef.current.pause();
    }
  };

  const startApp = async () => {
    setShowWelcome(false);
    // Try to play music on first interaction
    if (bgMusicRef.current) {
      try {
        await bgMusicRef.current.play();
        setIsMusicPlaying(true);
      } catch (e) {
        console.log("Initial play blocked", e);
        // Don't show error here, user can manually toggle
      }
    }
  };

  useEffect(() => {
    if (scanResult?.isWinner && winSoundRef.current) {
      winSoundRef.current.play().catch(e => console.log("Audio play blocked", e));
    }
  }, [scanResult?.isWinner]);
  const [cameraActive, setCameraActive] = useState(false);
  const [region, setRegion] = useState<LotteryRegion>('MN');
  const [station, setStation] = useState<string>(STATIONS['MN'][0]);
  const [showHistory, setShowHistory] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [history, setHistory] = useState<ScanResult[]>(() => {
    const saved = localStorage.getItem('lottery_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('lottery_history', JSON.stringify(history));
  }, [history]);
  const [winnings, setWinnings] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const fetchResults = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await lotteryService.fetchLatestResults(region, station);
      setLotteryData(data);
    } catch (err) {
      console.error("Error fetching results:", err);
    } finally {
      setIsLoading(false);
    }
  }, [region, station]);

  useEffect(() => {
    // Reset station when region changes
    setStation(STATIONS[region][0]);
  }, [region]);

  useEffect(() => {
    // Fetch lottery results on mount or station change
    fetchResults();
  }, [fetchResults]);

  const startCamera = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(newStream);
      setCameraActive(true);
    } catch (err) {
      setError("Không thể truy cập camera. Vui lòng cấp quyền.");
    }
  };

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [cameraActive, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      try {
        const result = await lotteryService.scanTicket(base64Image, region);
        setScanResult(result);
        setWinnings(result.prizeAmount);
        if (result.prizeAmount > 0) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
      } catch (err: any) {
        setError(err.message || "Lỗi khi phân tích ảnh. Vui lòng thử lại.");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Haptic feedback
    if (window.navigator.vibrate) window.navigator.vibrate(50);

    setIsScanning(true);
    setError(null);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg');
      
      try {
        const result = await lotteryService.scanTicket(base64Image, region);
        setScanResult(result);
        setHistory(prev => [result, ...prev].slice(0, 20)); // Keep last 20
        stopCamera();
        
        setWinnings(result.prizeAmount);
        if (result.prizeAmount > 0) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
      } catch (err: any) {
        setError(err.message || "Lỗi khi quét ảnh. Vui lòng thử lại.");
      } finally {
        setIsScanning(false);
      }
    }
  };

  const reset = () => {
    setScanResult(null);
    setWinnings(0);
    setError(null);
    startCamera();
  };

  return (
    <div className="min-h-screen text-[#141414] font-sans relative overflow-x-hidden">
      {/* Decorative Background Pattern */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0" 
           style={{ backgroundImage: 'radial-gradient(#FFD700 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Lantern Decorations */}
      <div className="fixed top-0 left-4 z-20 hidden md:block">
        <Lantern />
      </div>
      <div className="fixed top-0 right-4 z-20 hidden md:block">
        <Lantern />
      </div>
      <div className="fixed top-0 left-20 z-20 hidden lg:block">
        <Lantern className="scale-75 opacity-80" />
      </div>
      <div className="fixed top-0 right-20 z-20 hidden lg:block">
        <Lantern className="scale-75 opacity-80" />
      </div>
      
      {/* Mobile Lanterns */}
      <div className="absolute top-0 left-2 z-20 md:hidden">
        <Lantern className="scale-50 origin-top" />
      </div>
      <div className="absolute top-0 right-2 z-20 md:hidden">
        <Lantern className="scale-50 origin-top" />
      </div>

      {/* Welcome Overlay */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-festive-red"
          >
            <div className="text-center p-8 space-y-8">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-32 h-32 bg-festive-gold rounded-full mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(255,215,0,0.5)]"
              >
                <Ticket className="w-16 h-16 text-festive-red" />
              </motion.div>
              
              <div className="space-y-2">
                <h1 className="text-4xl font-black text-festive-gold uppercase tracking-tighter">Dò Số Ngày Tết</h1>
                <p className="text-festive-gold/80 font-bold uppercase tracking-[0.3em]">Mừng Xuân Ất Tỵ 2026</p>
              </div>

              <button 
                onClick={startApp}
                className="px-12 py-4 bg-festive-gold text-festive-red font-black rounded-full text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
              >
                Bắt đầu ngay
              </button>
              
              <p className="text-festive-gold/40 text-[10px] uppercase tracking-widest">Nhấn để kích hoạt âm thanh & camera</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-6 border-b border-festive-gold/20 flex justify-between items-center bg-festive-red text-festive-gold sticky top-0 z-30 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-festive-gold rounded-full">
            <Ticket className="w-6 h-6 text-festive-red" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight drop-shadow-md">XỔ SỐ KIẾN THIẾT</h1>
            <p className="text-[10px] text-festive-gold/80 uppercase tracking-widest font-mono font-bold">Mừng Xuân Ất Tỵ 2026</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleMusic}
            className="p-2 bg-festive-gold/20 rounded-full border border-festive-gold/30 text-festive-gold hover:bg-festive-gold/40 transition-all active:scale-95"
            title={isMusicPlaying ? "Tắt nhạc" : "Bật nhạc"}
          >
            {isMusicPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 bg-festive-gold/20 rounded-full border border-festive-gold/30 text-festive-gold hover:bg-festive-gold/40 transition-all active:scale-95"
            title="Lịch sử"
          >
            <History className="w-5 h-5" />
          </button>
          <button 
            onClick={fetchResults}
            className="p-2 bg-festive-gold/20 rounded-full border border-festive-gold/30 text-festive-gold hover:bg-festive-gold/40 transition-all active:scale-95"
            title="Cập nhật kết quả"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-8 relative z-10">
        
        {/* Region Selector */}
        <div className="flex p-1 bg-festive-dark/50 backdrop-blur-md rounded-2xl border border-festive-gold/20">
          {(['MN', 'MT', 'MB'] as LotteryRegion[]).map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                region === r 
                  ? 'bg-festive-gold text-festive-red shadow-lg' 
                  : 'text-festive-gold/60 hover:text-festive-gold'
              }`}
            >
              {r === 'MN' ? 'Miền Nam' : r === 'MT' ? 'Miền Trung' : 'Miền Bắc'}
            </button>
          ))}
        </div>

        {/* Station Selector */}
        {region !== 'MB' && (
          <div className="flex overflow-x-auto pb-2 space-x-2 no-scrollbar">
            {STATIONS[region].map((s) => {
              const isActive = station === s;
              return (
                <button
                  key={s}
                  onClick={() => setStation(s)}
                  className={`px-4 py-2 text-xs font-bold rounded-full whitespace-nowrap transition-all border ${
                    isActive 
                      ? 'bg-festive-red text-festive-gold border-festive-gold shadow-md' 
                      : 'bg-white/10 text-festive-gold border-festive-gold/30 hover:border-festive-gold'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}
        
        {/* Camera Section */}
        <section className="relative aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-festive-gold">
          {!scanResult ? (
            <>
              {!cameraActive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-white p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
                    <Camera className="w-10 h-10" />
                  </div>
                  <h2 className="text-xl font-medium">Sẵn sàng quét vé số</h2>
                  <p className="text-sm text-white/60">Đặt vé số vào khung hình để hệ thống tự động nhận diện đài, ngày và số vé.</p>
                  <div className="flex flex-col space-y-3 w-full max-w-[240px]">
                    <button 
                      onClick={startCamera}
                      className="w-full py-3 bg-white text-black rounded-full font-bold hover:bg-white/90 transition-all active:scale-95 flex items-center justify-center space-x-2"
                    >
                      <Camera className="w-5 h-5" />
                      <span>Mở Camera</span>
                    </button>
                    <button 
                      onClick={() => scanFileInputRef.current?.click()}
                      className="w-full py-3 bg-white/10 text-white border border-white/20 rounded-full font-bold hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center space-x-2"
                    >
                      <History className="w-5 h-5" />
                      <span>Thêm từ thư viện</span>
                    </button>
                    <input 
                      type="file" 
                      ref={scanFileInputRef} 
                      onChange={(e) => {
                        handleFileUpload(e);
                        e.target.value = ''; // Reset to allow same file selection
                      }} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  {/* Scanning Overlay */}
                  <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 flex items-center justify-center">
                    <div className="w-full h-1/2 border-2 border-white/50 relative overflow-hidden">
                      <div className="scanner-line" />
                    </div>
                  </div>
                  
                  <div className="absolute bottom-8 left-0 right-0 flex justify-center px-8 space-x-4">
                    <button 
                      onClick={captureAndScan}
                      disabled={isLoading || isScanning}
                      className="flex-1 py-4 bg-festive-red text-festive-gold rounded-2xl font-bold shadow-lg hover:bg-festive-red/90 border-2 border-festive-gold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {isScanning ? <Loader2 className="animate-spin" /> : <ScanLine />}
                      <span>{isScanning ? 'Đang phân tích...' : 'Quét Ngay'}</span>
                    </button>
                    <button 
                      onClick={stopCamera}
                      className="p-4 bg-white/20 backdrop-blur-md text-white rounded-2xl hover:bg-white/30 transition-all"
                    >
                      <XCircle />
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="absolute inset-0 bg-white p-6 overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-festive-red">Xác nhận vé số</h3>
                  <p className="text-sm text-gray-500 font-medium">{scanResult.station} - {scanResult.date}</p>
                </div>
                <button 
                  onClick={reset}
                  className="p-2 bg-festive-red/10 text-festive-red rounded-full hover:bg-festive-red/20 transition-colors border border-festive-red/20"
                  title="Thoát"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Ticket Info Card */}
                <div className="p-6 bg-red-50 rounded-3xl border-2 border-festive-gold/30 flex flex-col items-center space-y-4 shadow-inner">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-festive-red/60">Số vé của bạn</span>
                  <div className="flex space-x-2">
                    {scanResult.ticketNumber.split('').map((digit, i) => (
                      <span key={i} className="w-10 h-14 bg-white border-2 border-festive-gold/50 rounded-xl flex items-center justify-center text-2xl font-mono font-black shadow-md text-festive-red">
                        {digit}
                      </span>
                    ))}
                  </div>
                  {scanResult.series && (
                    <p className="text-xs font-bold text-festive-red/80 bg-festive-gold/20 px-3 py-1 rounded-full">Ký hiệu: {scanResult.series}</p>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      scanResult.status === 'Đã có kết quả' ? 'bg-festive-red text-festive-gold' : 'bg-festive-gold/20 text-festive-gold'
                    }`}>
                      {scanResult.status}
                    </span>
                  </div>
                </div>

                {/* Result Card */}
                <div className={`p-6 rounded-3xl shadow-xl border-2 ${
                  scanResult.isWinner 
                    ? 'bg-festive-red text-festive-gold border-festive-gold' 
                    : 'bg-festive-dark text-festive-gold/80 border-festive-gold/30'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-70">Kết quả đối chiếu</h4>
                    {scanResult.isWinner ? <Trophy className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5 opacity-50" />}
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-2xl font-black drop-shadow-sm">{scanResult.resultMessage}</p>
                    {scanResult.isWinner && (
                      <div className="pt-4 border-t border-festive-gold/30 space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-sm opacity-80">Tiền thưởng:</span>
                          <span className="text-2xl font-mono font-bold">{scanResult.prizeAmount.toLocaleString()} VNĐ</span>
                        </div>
                        {scanResult.taxAmount > 0 && (
                          <>
                            <div className="flex justify-between items-end text-festive-gold/70">
                              <span className="text-xs opacity-80">Thuế TNCN (10%):</span>
                              <span className="text-sm font-mono font-bold">-{scanResult.taxAmount.toLocaleString()} VNĐ</span>
                            </div>
                            <div className="flex justify-between items-end pt-2 border-t border-festive-gold/30">
                              <span className="text-sm font-bold">Thực nhận:</span>
                              <span className="text-2xl font-mono font-bold text-white drop-shadow-md">{scanResult.netAmount.toLocaleString()} VNĐ</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Match Details */}
                <div className="p-4 bg-red-50/50 rounded-2xl border border-festive-gold/20">
                  <div className="flex items-center space-x-3 mb-2">
                    <Info className="w-5 h-5 text-festive-red/60" />
                    <h4 className="font-bold text-sm text-festive-red">Chi tiết đối chiếu</h4>
                  </div>
                  <p className="text-[11px] text-gray-600 italic leading-relaxed">
                    {scanResult.matchDetails}
                  </p>
                  {scanResult.taxAmount > 0 && (
                    <div className="mt-3 p-2 bg-festive-red/10 rounded-lg border border-festive-red/20 flex items-start space-x-2">
                      <AlertCircle className="w-3 h-3 text-festive-red mt-0.5" />
                      <p className="text-[9px] text-festive-red font-medium">
                        Lưu ý: Theo quy định, giải thưởng trên 10 triệu đồng phải nộp thuế TNCN 10% cho phần vượt quá 10 triệu.
                      </p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={reset}
                  className="w-full py-4 bg-festive-red text-festive-gold rounded-2xl font-bold flex items-center justify-center space-x-2 hover:bg-festive-red/90 transition-all active:scale-95 shadow-lg border-2 border-festive-gold"
                >
                  <Ticket className="w-5 h-5" />
                  <span>Quét vé khác</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Results Info Section */}
        <section className="festive-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-festive-red" />
              <h3 className="font-bold text-festive-red">Kết quả xổ số hôm nay</h3>
            </div>
            <span className="text-[10px] font-mono bg-festive-gold text-festive-red px-2 py-1 rounded uppercase font-bold">Live Data</span>
          </div>

          <AnimatePresence mode="wait">
            {isLoading && !lotteryData ? (
              <motion.div 
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-2"
              >
                <Loader2 className="animate-spin w-8 h-8 text-festive-red" />
                <p className="text-sm text-festive-red font-medium">Đang tải kết quả mới nhất...</p>
              </motion.div>
            ) : lotteryData ? (
              <motion.div 
                key={station}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center border-b border-festive-gold/20 pb-2">
                  <span className="text-sm font-bold text-festive-red">{lotteryData.station}</span>
                  <span className="text-xs text-gray-400">{lotteryData.date}</span>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {/* Special Prize */}
                  <div className="p-4 rounded-2xl bg-festive-red/10 border border-festive-red/20 flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-wider text-festive-red font-bold">Đặc Biệt</span>
                    <div className="flex flex-wrap justify-end gap-2">
                      {lotteryData.prizes?.DB?.map((n: string, i: number) => (
                        <span key={i} className="text-2xl font-mono font-bold text-festive-red tracking-tighter drop-shadow-sm">{n}</span>
                      ))}
                    </div>
                  </div>

                  {/* Other Prizes */}
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(lotteryData.prizes || {})
                      .filter(([key]) => key !== 'DB' && (region !== 'MB' || key !== 'G8'))
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([key, numbers]: [string, any]) => (
                        <div key={key} className="p-3 rounded-xl bg-red-50/30 border border-festive-gold/10">
                          <p className="text-[9px] uppercase tracking-wider text-festive-red/50 font-bold mb-1">{key}</p>
                          <div className="flex flex-wrap gap-1">
                            {numbers.map((n: string, i: number) => (
                              <span key={i} className="text-sm font-mono font-bold text-festive-red">{n}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
                <p className="text-center text-[10px] text-gray-400 italic">Dữ liệu được cập nhật tự động cho đài {station}.</p>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center text-festive-red/40 font-medium"
              >
                Không có dữ liệu cho đài này.
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Rules/Info */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 festive-card">
            <h4 className="text-xs font-bold uppercase text-festive-red mb-2">
              Cơ cấu giải thưởng {region === 'MB' ? '(Miền Bắc)' : '(MN/MT)'}
            </h4>
            <div className="grid grid-cols-2 gap-x-4 text-[8px] text-gray-600">
              {region === 'MB' ? (
                <>
                  <ul className="space-y-1">
                    <li><span className="font-bold text-festive-red">Đặc biệt:</span> 5 số (1 Tỷ)</li>
                    <li><span className="font-bold text-festive-red">Giải Nhất:</span> 5 số (10tr)</li>
                    <li><span className="font-bold text-festive-red">Giải Nhì:</span> 5 số (5tr)</li>
                    <li><span className="font-bold text-festive-red">Giải Ba:</span> 5 số (1tr)</li>
                  </ul>
                  <ul className="space-y-1">
                    <li><span className="font-bold text-festive-red">Giải Bốn:</span> 4 số (400k)</li>
                    <li><span className="font-bold text-festive-red">Giải Năm:</span> 4 số (200k)</li>
                    <li><span className="font-bold text-festive-red">Giải Sáu:</span> 3 số (100k)</li>
                    <li><span className="font-bold text-festive-red">Giải Bảy:</span> 2 số (40k)</li>
                  </ul>
                </>
              ) : (
                <>
                  <ul className="space-y-1">
                    <li><span className="font-bold text-festive-red">Đặc biệt:</span> 6 số (2 Tỷ)</li>
                    <li><span className="font-bold text-festive-red">Giải Nhất:</span> 5 số cuối (30tr)</li>
                    <li><span className="font-bold text-festive-red">Giải Nhì:</span> 5 số cuối (15tr)</li>
                    <li><span className="font-bold text-festive-red">Giải Ba:</span> 5 số cuối (10tr)</li>
                    <li><span className="font-bold text-festive-red">Giải Bốn:</span> 5 số cuối (3tr)</li>
                    <li><span className="font-bold text-festive-red">Giải Năm:</span> 4 số cuối (1tr)</li>
                  </ul>
                  <ul className="space-y-1">
                    <li><span className="font-bold text-festive-red">Giải Sáu:</span> 4 số cuối (400k)</li>
                    <li><span className="font-bold text-festive-red">Giải Bảy:</span> 3 số cuối (200k)</li>
                    <li><span className="font-bold text-festive-red">Giải Tám:</span> 2 số cuối (100k)</li>
                    <li><span className="font-bold text-festive-red">Phụ ĐB:</span> Trúng 5 số cuối GĐB</li>
                    <li><span className="font-bold text-festive-red">Khuyến khích:</span> Sai 1 số GĐB</li>
                  </ul>
                </>
              )}
            </div>
          </div>
          <div className="p-4 festive-card">
            <h4 className="text-xs font-bold uppercase text-festive-red mb-2">Hướng dẫn quét</h4>
            <ul className="text-[10px] space-y-1 text-gray-600">
              <li className="flex items-center space-x-2">
                <ShieldCheck className="w-3 h-3 text-festive-red" />
                <span>Chụp ảnh rõ nét, đủ ánh sáng.</span>
              </li>
              <li className="flex items-center space-x-2">
                <ShieldCheck className="w-3 h-3 text-festive-red" />
                <span>Tránh lóa đèn tại vị trí dãy số.</span>
              </li>
              <li className="flex items-center space-x-2">
                <ShieldCheck className="w-3 h-3 text-festive-red" />
                <span>AI tự động tra cứu kết quả Google.</span>
              </li>
            </ul>
          </div>
        </section>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-festive-red text-festive-gold border-2 border-festive-gold rounded-2xl text-sm flex items-center space-x-2 shadow-xl"
          >
            <XCircle className="w-5 h-5 shrink-0" />
            <span className="font-bold">{error}</span>
          </motion.div>
        )}

        {/* API Config (Moved to bottom) */}
        <div className="flex justify-center space-x-2 pt-4 border-t border-festive-gold/20">
          <button 
            onClick={handleOpenKeySelector}
            className="px-4 py-2 rounded-full text-xs font-bold bg-festive-gold text-festive-red hover:bg-festive-gold/90 transition-all flex items-center space-x-2 shadow-md"
          >
            <Key className="w-4 h-4" />
            <span>Cấu hình API</span>
          </button>
        </div>
      </main>

      <canvas ref={canvasRef} className="hidden" />
      
      <footer className="p-8 text-center text-festive-gold/60 text-[10px] uppercase tracking-[0.2em] relative z-10">
        &copy; 2026 Quét Vé Số By NhatHoang &bull; Mừng Xuân Ất Tỵ
      </footer>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border-2 border-festive-gold"
            >
              <div className="p-6 bg-festive-red text-festive-gold flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5" />
                  <h3 className="font-bold uppercase tracking-tight">Lịch sử quét</h3>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                {history.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-sm italic">
                    Chưa có lịch sử quét vé.
                  </div>
                ) : (
                  history.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex justify-between items-center">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[10px] font-bold text-festive-red uppercase">{item.station}</span>
                          <span className="text-[10px] text-gray-400">{item.date}</span>
                        </div>
                        <p className="text-sm font-mono font-bold text-gray-700">{item.ticketNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] font-bold uppercase ${item.isWinner ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {item.isWinner ? `Trúng ${item.prizeAmount.toLocaleString()}đ` : 'Không trúng'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem('lottery_history');
                  }}
                  className="w-full py-3 text-xs font-bold text-gray-400 hover:text-festive-red transition-colors uppercase tracking-widest"
                >
                  Xóa tất cả lịch sử
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
