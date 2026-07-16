import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import Toast from '../../components/Toast';

const SLIDES = [
  { img: '/dokum1.png', caption: 'Sistem monitoring linen rumah sakit terintegrasi', accent: 'Hygiene & Infection Control' },
  { img: '/dokum2.png', caption: 'Manajemen linen modern untuk layanan kesehatan', accent: 'Quality Assurance' },
  { img: '/dokum3.png', caption: 'Proses pencucian dengan standar higienis tertinggi', accent: 'Operational Efficiency' },
  { img: '/dokum5.png', caption: 'Tim profesional siap melayani kebutuhan Anda', accent: 'Compliance & Logistics' },
  { img: '/dokum6.png', caption: 'Solusi laundry rumah sakit yang terpercaya', accent: 'Tailored Solutions' },
];

export default function Login() {
  const [current, setCurrent] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState({ isOpen: false, title: '', message: '', icon: 'success' });
  const navigate = useNavigate();

  useEffect(() => {
    const id = setInterval(() => setCurrent((c) => (c + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Silakan masukkan username dan password Anda.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/auth/login', { username, password });
      if (response.data && response.data.success) {
        const { token, role, redirect, message, user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('userRole', role);
        localStorage.setItem('username', username);
        if (user) {
          localStorage.setItem('employeeId', user.id || '');
          localStorage.setItem('fullName', user.fullName || '');
          localStorage.setItem('position', user.position || '');
          localStorage.setItem('department', user.department || '');
          localStorage.setItem('profilePath', user.profilePath || '');
          localStorage.setItem('hospitalId', user.hospitalId || '');
        }
        setToast({ isOpen: true, title: 'Login Berhasil!', message, icon: 'success' });
        setTimeout(() => navigate(redirect), 1500);
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.response?.data?.message || 'Username atau password salah. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 lg:bg-white overflow-hidden flex flex-col lg:flex-row items-center justify-center lg:items-stretch lg:justify-start font-sans">
      {/* Mobile subtle grid pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,165,158,0.06)_0%,transparent_60%)] lg:hidden pointer-events-none" />

      {/* ── LEFT: Hero Carousel (Desktop Only) ── */}
      <div className="hidden lg:flex relative w-[55%] flex-shrink-0 overflow-hidden bg-[#126776] select-none">
        {/* Background images — crossfade */}
        {SLIDES.map((slide, i) => (
          <img
            key={i}
            src={slide.img}
            alt=""
            draggable={false}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ${i === current ? 'opacity-100' : 'opacity-0'
              }`}
          />
        ))}

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#126776]/60 to-[#126776]/10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#126776] via-[#126776]/10 to-[#126776]/50 pointer-events-none" />

        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/[0.03] pointer-events-none" />
        <div className="absolute top-1/3 -right-16 w-48 h-48 rounded-full bg-white/[0.04] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full h-full p-10">
          {/* Top: Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/ikm_white.png"
              alt="IKM"
              className="h-10 object-contain drop-shadow-lg"
            />
            <div>
              <p className="text-white font-bold text-xl tracking-tight leading-none">Linen Management System</p>
              <p className="text-white text-xs font-medium tracking-wide mt-0.5">
                PT Intersolusi Karya Mandiri
              </p>
            </div>
          </div>

          {/* Bottom: Caption + dots */}
          <div className="space-y-5">
            <div>
              <span className="inline-block text-xs font-semibold text-white/40 uppercase tracking-[0.25em] mb-3">
                {SLIDES[current].accent}
              </span>
              <h2 className="text-white text-2xl xl:text-3xl font-bold leading-snug max-w-[300px] drop-shadow-sm">
                {SLIDES[current].caption}
              </h2>
            </div>

            {/* Dot indicators */}
            <div className="flex items-center gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-[3px] rounded-full transition-all duration-500 cursor-pointer ${i === current
                    ? 'bg-white w-8'
                    : 'bg-white/25 w-2 hover:bg-white/50'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form (Responsive Mobile Card Layout) ── */}
      <div className="w-full lg:flex-1 flex items-center justify-center p-4 lg:p-10 relative">

        {/* Decorative background blurs for desktop */}
        <div className="hidden lg:block absolute top-0 right-0 w-96 h-96 bg-[#1ea59e]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="hidden lg:block absolute bottom-0 left-0 w-80 h-80 bg-[#1ea59e]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        {/* Mobile: full-bleed dark bg — no card, no shadow */}
        <div className="w-full max-w-sm lg:max-w-sm lg:bg-transparent lg:rounded-none transition-all duration-300">

          {/* Mobile: Compact brand bar */}
          <div className="flex items-center gap-2.5 lg:hidden mb-6">
            <img src="/ikm_white.png" alt="IKM" className="h-7 object-contain drop-shadow" />
            <div>
              <p className="text-white font-bold text-sm tracking-tight leading-none">Linen Management</p>
              <p className="text-[#1ea59e]/60 text-xs font-bold tracking-wider mt-0.5 uppercase">PT Intersolusi Karya Mandiri</p>
            </div>
          </div>

          {/* Form Content Wrapper */}
          <div className="lg:p-0">
            {/* Header (Desktop Only) */}
            <div className="hidden lg:block mb-6">
              <div className="flex items-center gap-3 mb-6">
                <img src="/ikm.png" alt="IKM" className="h-8 object-contain" />
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-tight">PT Intersolusi Karya Mandiri</p>
                  <p className="text-xs text-slate-400 font-semibold tracking-wider">Linen Management System</p>
                </div>
              </div>
            </div>

            {/* Welcome Title */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl sm:text-2xl font-bold text-white lg:text-slate-800 tracking-tight">Selamat Datang</h2>
                <Sparkles className="h-4 w-4 text-[#1ea59e] lg:text-[#1ea59e]" />
              </div>
              <p className="text-xs sm:text-sm text-white/70 lg:text-slate-500">
                Masuk ke portal manajemen linen terintegrasi.
              </p>
            </div>

            {/* Error alerts */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 lg:bg-rose-50 lg:border-rose-100 text-rose-300 lg:text-rose-700 text-xs font-medium flex items-start gap-2.5 animate-shake">
                <AlertCircle className="h-4 w-4 text-rose-400 lg:text-rose-500 flex-shrink-0 mt-0.5" />
                <div>{errorMsg}</div>
              </div>
            )}

            {/* Login Inputs Form */}
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-white/50 lg:text-slate-400 uppercase tracking-wider" htmlFor="username">
                  Username
                </label>
                <div className="relative group">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username Anda"
                    className="block w-full pl-10 pr-4 py-2.5 lg:py-3 bg-white/10 lg:bg-white border border-white/15 lg:border-slate-200 rounded-xl text-white lg:text-slate-800 placeholder-white/40 lg:placeholder-slate-400/80 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/20 lg:focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] lg:focus:border-[#1ea59e] transition-all duration-300 text-sm font-medium hover:border-white/30 lg:hover:border-slate-300 backdrop-blur-sm"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-white/70 lg:text-slate-400 group-focus-within:text-[#1ea59e] lg:group-focus-within:text-[#1ea59e] transition-all duration-300" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-white/50 lg:text-slate-400 uppercase tracking-wider" htmlFor="password">
                  Kata Sandi
                </label>
                <div className="relative group">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="block w-full pl-10 pr-10 py-2.5 lg:py-3 bg-white/10 lg:bg-white border border-white/15 lg:border-slate-200 rounded-xl text-white lg:text-slate-800 placeholder-white/40 lg:placeholder-slate-400/80 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/20 lg:focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] lg:focus:border-[#1ea59e] transition-all duration-300 text-sm font-medium hover:border-white/30 lg:hover:border-slate-300 backdrop-blur-sm"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-white/70 lg:text-slate-400 group-focus-within:text-[#1ea59e] lg:group-focus-within:text-[#1ea59e] transition-all duration-300" />
                  </div>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-white/70 lg:text-slate-400 hover:text-white lg:hover:text-slate-600 transition-colors p-1"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Login Button with animations */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full relative flex items-center justify-center gap-2 px-4 py-2.5 lg:py-3 bg-gradient-to-r from-[#126776] to-[#1ea59e] hover:from-[#0e5562] hover:to-[#188b85] text-white rounded-xl font-bold text-sm shadow-md shadow-[#126776]/20 hover:shadow-lg hover:shadow-[#126776]/30 active:scale-[0.98] transition-all duration-200 group overflow-hidden mt-2"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </div>
                ) : (
                  <>
                    <span>Masuk Ke Portal</span>
                    <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform duration-300" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/40 lg:text-slate-400 font-medium">
              &copy; 2026 PT Intersolusi Karya Mandiri. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 2; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        title={toast.title}
        message={toast.message}
        icon={toast.icon}
      />
    </div>
  );
}
