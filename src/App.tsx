import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Camera, 
  History, 
  User, 
  BookOpen, 
  ChevronRight,
  Sparkles,
  ArrowLeft,
  X,
  Target,
  Mic,
  Volume2,
  Plus,
  Zap,
  Bookmark,
  Beaker,
  HeartPulse,
  Users,
  ArrowRightLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePaystackPayment } from 'react-paystack';
import { loadStripe } from '@stripe/stripe-js';
import { solveQuestion as solveQuestionAI, SolveResult, simplifyExplanation } from './lib/gemini';
import { saveQuestion, getHistory, loginWithGoogle, onAuthChange, auth } from './lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

// --- Types ---
type Screen = 'home' | 'solver' | 'history' | 'profile';
interface HistoryItem extends SolveResult {
  id: string;
  timestamp: any;
  questionText: string;
}

// --- Components ---
const Navbar = ({ active, setScreen, onInstall }: { active: Screen; setScreen: (s: Screen) => void; onInstall: () => void }) => (
  <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto nav-blur z-50 h-24 flex items-center justify-between px-6 border-t border-slate-100 bg-white/90 backdrop-blur-md pb-4">
    <motion.button 
      whileTap={{ scale: 0.8 }}
      onClick={() => setScreen('home')} 
      className={`flex flex-col items-center gap-1 transition-colors ${active === 'home' || active === 'solver' ? 'text-brand' : 'text-slate-400'}`}
    >
      <Search size={20} />
      <span className="text-[9px] font-black uppercase tracking-tight">Scanner</span>
    </motion.button>
    
    <motion.button 
      whileTap={{ scale: 0.8 }}
      onClick={() => setScreen('history')} 
      className={`flex flex-col items-center gap-1 transition-colors ${active === 'history' ? 'text-brand' : 'text-slate-400'}`}
    >
      <History size={20} />
      <span className="text-[9px] font-black uppercase tracking-tight">Records</span>
    </motion.button>

    <div className="relative -top-8">
      <motion.button 
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        whileHover={{ y: -5, scale: 1.05 }}
        whileTap={{ scale: 0.9, y: 0 }}
        onClick={() => setScreen('home')}
        className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-400 border-4 border-white rotate-45"
      >
        <div className="-rotate-45">
          <Camera size={24} />
        </div>
      </motion.button>
    </div>

    <motion.button 
      whileTap={{ scale: 0.8 }}
      onClick={() => setScreen('profile')} 
      className={`flex flex-col items-center gap-1 transition-colors ${active === 'profile' ? 'text-brand' : 'text-slate-400'}`}
    >
      <User size={20} />
      <span className="text-[9px] font-black uppercase tracking-tight">Pilot</span>
    </motion.button>

    <motion.button 
      whileTap={{ scale: 0.8 }}
      onClick={onInstall} 
      className="flex flex-col items-center gap-1 text-emerald-500 animate-pulse"
    >
      <Zap size={20} fill="currentColor" />
      <span className="text-[9px] font-black uppercase tracking-tight">App</span>
    </motion.button>
  </nav>
);

const PaystackButton = ({ plan, user, onSuccess, onClose }: { plan: any, user: FirebaseUser | null, onSuccess: () => void, onClose: () => void }) => {
  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || 'guest@exampilot.ai',
    amount: parseInt(plan.price.replace(/[^\d]/g, '')) * 100, // Amount in kobo
    // @ts-ignore
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
    metadata: {
      custom_fields: [
        {
          display_name: "Plan Name",
          variable_name: "plan_name",
          value: plan.name
        },
        {
          display_name: "User ID",
          variable_name: "user_id",
          value: user?.uid || 'anonymous'
        }
      ]
    },
  };

  const handlePaystack = usePaystackPayment(config);

  return (
    <button 
      onClick={() => {
        if (!config.publicKey) {
          alert("Paystack Public Key missing.");
          return;
        }
        handlePaystack({
          onSuccess: (reference: any) => {
            console.log('Payment Successful', reference);
            onSuccess();
          },
          onClose: () => onClose(),
        });
      }}
      className="w-full py-4 rounded-2xl bg-brand text-white font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
    >
      <Target size={14} /> Pay with Paystack
    </button>
  );
};

const StripeButton = ({ plan, user }: { plan: any, user: FirebaseUser | null }) => {
  const handleStripe = async () => {
    // @ts-ignore
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      alert("Stripe Publishable Key missing.");
      return;
    }

    const stripe = await loadStripe(publishableKey);
    if (!stripe) return;

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          planPrice: plan.price,
          userEmail: user?.email || 'guest@exampilot.ai',
        }),
      });

      const session = await response.json();
      if (session.error) throw new Error(session.error);

      // @ts-ignore
      const result = await stripe.redirectToCheckout({
        sessionId: session.id,
      });

      if (result.error) alert(result.error.message);
    } catch (err: any) {
      console.error(err);
      alert("Failed to initiate Stripe checkout.");
    }
  };

  return (
    <button 
      onClick={handleStripe}
      className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
    >
      <Zap size={14} fill="white" /> Pay with Stripe
    </button>
  );
};

const DirectTransferButton = ({ plan, user }: { plan: any, user: FirebaseUser | null }) => {
  const [showDetails, setShowDetails] = useState(false);

  // You can customize these bank details
  const bankDetails = {
    bank: "Moniepoint Microfinance Bank",
    accountName: "AYOOLUWA CHAMPION OMOTOLA",
    accountNumber: "9064049817",
    reference: `EP-${user?.uid?.slice(0, 5)}-${plan.id}`.toUpperCase()
  };

  if (showDetails) {
    return (
      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Bank Details</span>
          <button onClick={() => setShowDetails(false)} className="text-white/40 hover:text-white">
            <X size={14} />
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[10px] text-white/60">Bank:</span>
            <span className="text-[10px] font-bold text-white tracking-tight">{bankDetails.bank}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-white/60">Account:</span>
            <span className="text-[10px] font-bold text-white tracking-tight">{bankDetails.accountNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-white/60">Name:</span>
            <span className="text-[10px] font-bold text-white tracking-tight">{bankDetails.accountName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-white/60">Ref:</span>
            <span className="text-[10px] font-bold text-brand tracking-tight">{bankDetails.reference}</span>
          </div>
        </div>
        <button 
          onClick={() => {
            alert("Payment notification sent! Our team will verify and activate your account within 24 hours.");
            setShowDetails(false);
          }}
          className="w-full py-3 rounded-xl bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-500/20"
        >
          I've Sent the Money
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={() => setShowDetails(true)}
      className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
    >
      <ArrowRightLeft size={14} className="text-white/60" /> Direct Bank Transfer
    </button>
  );
};

const PaymentOptions = ({ plan, user, onSuccess, onClose }: { plan: any, user: FirebaseUser | null, onSuccess: () => void, onClose: () => void }) => {
  if (plan.id === 'free') {
    return (
      <button 
        disabled
        className="w-full py-4 rounded-2xl bg-white/10 text-white/40 font-black text-xs uppercase tracking-widest"
      >
        Current Plan
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <PaystackButton plan={plan} user={user} onSuccess={onSuccess} onClose={onClose} />
      <StripeButton plan={plan} user={user} />
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
        <div className="relative flex justify-center text-[8px] uppercase tracking-[0.3em] font-black"><span className="bg-[#0f172a] px-3 text-white/20 italic">Manual Option</span></div>
      </div>
      <DirectTransferButton plan={plan} user={user} />
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const [showInstallModal, setShowInstallModal] = useState(false);
  const handleInstallApp = async () => {
    // Check if in iframe
    const inIframe = window.self !== window.top;
    if (inIframe) {
      alert("⚠️ Iframe detected: To install the app, you must open it in a new browser tab first using the icon at the top right.");
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      setShowInstallModal(true);
      return;
    }

    if (!deferredPrompt) {
      setShowInstallModal(true);
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallModal(false);
    }
  };

  const InstallModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-white/10 p-8 rounded-[2rem] w-full max-w-sm text-center space-y-6 shadow-2xl"
      >
        <div className="w-20 h-20 bg-brand/20 rounded-3xl flex items-center justify-center mx-auto text-brand mb-4">
          <Zap size={40} fill="currentColor" />
        </div>
        <h3 className="text-2xl font-black text-white italic">INSTALL EXAMPILOT</h3>
        <p className="text-sm text-white/60 leading-relaxed">
          Get the full native experience on your device.
        </p>
        
        <div className="bg-white/5 p-4 rounded-2xl text-left space-y-3">
          {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
            <>
              <div className="flex gap-3 items-center">
                <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center text-[10px] font-black">1</div>
                <p className="text-[11px] text-white/80 font-medium">Tap the <span className="text-blue-400 font-bold">Share icon</span> in Safari</p>
              </div>
              <div className="flex gap-3 items-center">
                <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center text-[10px] font-black">2</div>
                <p className="text-[11px] text-white/80 font-medium">Select <span className="text-white font-bold">'Add to Home Screen'</span></p>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3 items-center">
                <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center text-[10px] font-black">1</div>
                <p className="text-[11px] text-white/80 font-medium">Tap the browser menu <span className="text-white font-bold">(⋮)</span></p>
              </div>
              <div className="flex gap-3 items-center">
                <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center text-[10px] font-black">2</div>
                <p className="text-[11px] text-white/80 font-medium">Select <span className="text-emerald-400 font-bold">'Install app'</span> or 'Add to home screen'</p>
              </div>
            </>
          )}
        </div>

        <button 
          onClick={() => setShowInstallModal(false)}
          className="w-full py-4 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-widest shadow-xl"
        >
          Got it
        </button>
      </motion.div>
    </div>
  );
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<SolveResult[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState('Universal');
  const [stagedFile, setStagedFile] = useState<{ base64: string, type: string, name: string } | null>(null);

  const tacticalUnits = [
    { id: 'Universal', label: 'All Subjects', icon: Zap },
    { id: 'Mathematics', label: 'Math AI', icon: Target },
    { id: 'Physics', label: 'Physics AI', icon: Zap },
    { id: 'Chemistry', label: 'Chemistry AI', icon: Beaker },
    { id: 'Biology', label: 'Biology AI', icon: HeartPulse },
    { id: 'English', label: 'English AI', icon: BookOpen },
    { id: 'Arts', label: 'Arts & Govt', icon: Users },
  ];
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    // Hide splash after 3 seconds
    const timer = setTimeout(() => setShowSplash(false), 3500);
    
    // Check for payment success URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setIsPro(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        const data = await getHistory(u.uid);
        setHistory(data as HistoryItem[]);
      } else {
        // Clear user-specific data on logout
        setHistory([]);
        setBookmarks([]);
        setResult(null);
        setQuery('');
        setStagedFile(null);
      }
    });
    return () => unsub();
  }, []);

  // --- Speech To Text (STT) ---
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported in this browser.");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // --- Text To Speech (TTS) ---
  const speak = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const toggleBookmark = (item: SolveResult) => {
    setBookmarks(prev => {
      const exists = prev.find(b => b.solution === item.solution);
      if (exists) {
        return prev.filter(b => b.solution !== item.solution);
      }
      return [...prev, item];
    });
  };

  const isBookmarked = (solution: string) => {
    return bookmarks.some(b => b.solution === solution);
  };

  const handleSolve = async (text: string) => {
    if (!user) return;
    if (!text.trim() && !stagedFile) return;
    
    setLoading(true);
    setScreen('solver');
    
    const finalPrompt = stagedFile 
      ? `Extract and solve the question in this image or document. Specific instructions: ${text || 'Solve step-by-step.'}`
      : text;

    try {
      const data = await solveQuestionAI(finalPrompt, stagedFile?.base64, stagedFile?.type, selectedModel);
      setResult(data);
      
      const historyText = text.trim() 
        ? text 
        : (stagedFile ? `${stagedFile.type.includes('pdf') ? 'PDF' : 'Image'} Question` : 'Unknown');

      await saveQuestion(user.uid, {
        questionText: historyText,
        ...data,
      });
      
      const refreshed = await getHistory(user.uid);
      setHistory(refreshed as HistoryItem[]);
      setStagedFile(null); // Clear after solve
    } catch (error) {
       console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("File is too large! Please upload a file smaller than 20MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setStagedFile({
        base64,
        type: file.type,
        name: file.name
      });
      // Optionally pre-fill query or just let user type notes
    };
    reader.readAsDataURL(file);
  };

  const handleSimplify = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const simpler = await simplifyExplanation(query, result.explanation.beginner);
      setResult({
        ...result,
        explanation: {
          ...result.explanation,
          beginner: `[ANALOGY MODE] ${simpler}`
        }
      });
      setDifficulty('beginner');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-container pb-20 select-none">
      <input 
        type="file" 
        id="camera-input" 
        accept="image/*,application/pdf" 
        capture="environment" 
        className="hidden" 
        onChange={handleFileChange}
      />
      <AnimatePresence mode="wait">
        {showSplash ? (
          <motion.div 
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            transition={{ duration: 0.8, ease: 'circOut' }}
            className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center overflow-hidden"
          >
             {/* Background Effects */}
             <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0%,transparent_70%)]" />
                <motion.div 
                   animate={{ 
                     opacity: [0.1, 0.3, 0.1],
                     scale: [1, 1.1, 1] 
                   }}
                   transition={{ duration: 4, repeat: Infinity }}
                   className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"
                />
             </div>

             {/* Scanning Line */}
             <motion.div 
               animate={{ top: ['0%', '100%'] }}
               transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
               className="absolute left-0 right-0 h-[2px] bg-brand/30 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10"
             />

             {/* Content */}
             <div className="relative z-20 flex flex-col items-center">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                  className="w-24 h-24 bg-brand rounded-[2.5rem] flex items-center justify-center text-white font-black text-5xl shadow-[0_0_50px_rgba(59,130,246,0.4)] mb-6 border-4 border-white/20"
                >
                   Σ
                </motion.div>
                
                <div className="overflow-hidden mb-2">
                  <motion.h1 
                    initial={{ y: 50 }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.5, duration: 0.5, ease: 'circOut' }}
                    className="text-4xl font-black italic tracking-tighter text-white"
                  >
                    PILOT PRO<span className="text-brand">.</span>
                  </motion.h1>
                </div>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 1 }}
                  className="text-[10px] text-white font-black uppercase tracking-[0.4em]"
                >
                  Academic Defense System
                </motion.p>
             </div>

             {/* Progress Bar (Gaming Style) */}
             <div className="absolute bottom-16 left-12 right-12">
               <div className="flex justify-between items-end mb-2">
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="text-[8px] text-brand font-black uppercase tracking-widest"
                  >
                    Loading Syllabus...
                  </motion.span>
                  <motion.span 
                    className="text-[10px] text-white/40 font-mono"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Ver. 3.0.4
                  </motion.span>
               </div>
               <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2.8, ease: 'easeInOut', delay: 0.2 }}
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 relative"
                  >
                    <motion.div 
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 w-1/2 bg-white/20 skew-x-[45deg]"
                    />
                  </motion.div>
               </div>
             </div>

             {/* Footer Legal */}
             <div className="absolute bottom-6 text-center">
                <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest">
                  © 2026 ExamPilot Global • Secure Connection Established
                </p>
             </div>
          </motion.div>
        ) : !user ? (
          <motion.div 
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900 text-white text-center"
          >
             <div className="w-20 h-20 bg-brand rounded-3xl flex items-center justify-center text-white font-bold text-4xl shadow-2xl shadow-blue-500/20 mb-8">
                Σ
             </div>
             <h1 className="text-4xl font-black tracking-tighter mb-3 italic">PILOT PRO.</h1>
             <p className="text-slate-400 text-sm mb-12 max-w-[280px] leading-relaxed">
               The World's Fastest AI Academic Specialist.<br/>
               <span className="text-brand font-bold">Subscription Required for All Solves.</span>
             </p>
             <div className="w-full space-y-4">
                <button 
                    onClick={loginWithGoogle}
                    className="w-full bg-white text-slate-900 py-4 rounded-2xl font-bold border-none shadow-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-3"
                >
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="google" />
                    Continue with Google
                </button>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] pt-4">
                  Powered by Gemini 3.0 Specialist
                </p>
             </div>
          </motion.div>
        ) : (
          <>
            {screen === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                transition={{ type: 'spring', damping: 20 }}
                className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden"
              >
                {/* Simulated Camera Viewfinder */}
                <div className="flex-1 relative flex flex-col justify-center items-center">
                  <div className="absolute inset-0 flex items-center justify-center viewfinder-overlay">
                    <motion.div 
                      animate={{ opacity: [0.05, 0.15, 0.05] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <Camera size={160} className="text-white" />
                    </motion.div>
                    
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute inset-12 border-2 border-white/20 rounded-[3rem] border-dashed" 
                    />
                    
                    {/* Animated Corner accents */}
                    {[0, 90, 180, 270].map((rotate, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 + (i * 0.1) }}
                        style={{ rotate: `${rotate}deg` }}
                        className="absolute top-12 left-12 w-10 h-10 border-t-4 border-l-4 border-brand rounded-tl-2xl shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      />
                    ))}
                  </div>
                  
                  <div className="z-10 text-center">
                    <motion.p 
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-white/80 text-[10px] font-black uppercase tracking-[0.4em] mb-8"
                    >
                      Target Lock: Active
                    </motion.p>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => document.getElementById('camera-input')?.click()}
                      className="group relative"
                    >
                      <div className="absolute inset-[-10px] bg-brand/20 blur-xl rounded-full group-hover:bg-brand/40 transition-colors" />
                      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl relative">
                        <div className="w-20 h-20 border-4 border-brand rounded-full flex items-center justify-center">
                          <div className="w-16 h-16 bg-brand rounded-full shadow-inner" />
                        </div>
                      </div>
                    </motion.button>
                  </div>
                </div>

                {/* Input Tray with Staggered children */}
                <motion.div 
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  transition={{ type: 'spring', damping: 25, delay: 0.3 }}
                  className="bg-white rounded-t-[3rem] p-8 pb-32 space-y-6 shadow-[0_-20px_40px_rgba(0,0,0,0.3)] relative z-20"
                >
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 shadow-inner"
                  >
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight italic">COMMAND CENTER.</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Awaiting Input Sequence</p>
                    </div>
                    {!isPro ? (
                      <button 
                        onClick={() => setShowPricing(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 group overflow-hidden relative"
                      >
                        <div className="absolute inset-0 bg-brand/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Zap size={12} fill="white" className="relative z-10" /> <span className="relative z-10">Upgrade to Active</span>
                      </button>
                    ) : (
                      <button 
                         onClick={() => setShowPricing(true)}
                         className="badge bg-emerald-500 text-white shadow-lg shadow-emerald-200 px-4 py-1.5"
                      >
                        ACTIVE PRO
                      </button>
                    )}
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.55 }}
                    className="flex overflow-x-auto gap-3 pb-2 no-scrollbar"
                  >
                    {tacticalUnits.map((unit) => (
                      <button
                        key={unit.id}
                        onClick={() => setSelectedModel(unit.id)}
                        className={`flex-shrink-0 px-5 py-3 rounded-2xl flex items-center gap-2 border-2 transition-all font-black text-[10px] uppercase tracking-tighter ${
                          selectedModel === unit.id 
                            ? 'bg-brand text-white border-brand shadow-lg shadow-blue-200 scale-105' 
                            : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <unit.icon size={14} fill={selectedModel === unit.id ? 'currentColor' : 'none'} />
                        {unit.label}
                      </button>
                    ))}
                  </motion.div>

                  {stagedFile && (
                    <motion.div 
                      key="staged"
                      initial={{ x: 50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -50, opacity: 0 }}
                      className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden border border-white/10">
                          {stagedFile.type.includes('image') ? (
                            <img src={`data:${stagedFile.type};base64,${stagedFile.base64}`} className="w-full h-full object-cover" alt="preview" />
                          ) : (
                            <BookOpen size={20} className="text-brand" />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-black truncate max-w-[150px] uppercase tracking-tighter">{stagedFile.name}</p>
                          <p className="text-[8px] text-brand font-black uppercase tracking-widest">Payload Attached</p>
                        </div>
                      </div>
                      <motion.button 
                        whileTap={{ scale: 0.8 }}
                        onClick={() => setStagedFile(null)}
                        className="p-2 text-white/40 hover:text-red-400"
                      >
                        <X size={18} />
                      </motion.button>
                    </motion.div>
                  )}

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="relative"
                  >
                    <textarea 
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={stagedFile ? "Specific mission constraints..." : "Input problem logic here..."}
                      className="w-full h-36 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-sm leading-relaxed resize-none focus:bg-white focus:border-brand focus:ring-0 transition-all placeholder:text-slate-300 font-bold"
                    />
                    <div className="absolute bottom-4 right-4 flex gap-3">
                       <motion.button 
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={startListening}
                        className={`p-3.5 rounded-2xl transition-all shadow-xl ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-800'}`}
                      >
                        <Mic size={20} />
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSolve(query)}
                        className="bg-brand text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-xl shadow-blue-200"
                      >
                        <Zap size={14} fill="currentColor" /> ACTIVE SOLVE
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}

        {screen === 'solver' && (
          <motion.div 
            key="solver"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-1 overflow-y-auto bg-white pt-10 pb-32"
          >
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="px-6 flex items-center justify-between mb-8"
            >
              <div className="flex items-center gap-4">
                <motion.button 
                  whileHover={{ x: -3 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setScreen('home')} 
                  className="p-3 bg-slate-50 rounded-2xl transition-colors border border-slate-100"
                >
                  <ArrowLeft size={20} />
                </motion.button>
                <div>
                  <h2 className="text-xl font-black italic tracking-tighter">DATA LINK ACQUIRED.</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Processing Question Set</p>
                </div>
              </div>
              {result && (
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleBookmark(result)}
                  className={`p-3.5 rounded-2xl transition-all shadow-xl ${isBookmarked(result.solution) ? 'bg-brand text-white' : 'bg-slate-50 text-slate-400'}`}
                >
                  <Bookmark size={18} fill={isBookmarked(result.solution) ? "currentColor" : "none"} />
                </motion.button>
              )}
            </motion.div>

            <div className="px-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-8">
                  <div className="relative">
                    <motion.div 
                      animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                      transition={{ 
                        rotate: { repeat: Infinity, duration: 1, ease: 'linear' },
                        scale: { repeat: Infinity, duration: 2 }
                      }}
                      className="w-24 h-24 border-[8px] border-brand/10 border-t-brand rounded-full shadow-2xl"
                    />
                    <motion.div 
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand"
                    >
                      <Zap size={32} fill="currentColor" />
                    </motion.div>
                  </div>
                  <div className="text-center">
                    <motion.p 
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-slate-900 font-black text-2xl tracking-tighter mb-2 italic"
                    >
                      PILOT AI IS DECODING...
                    </motion.p>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em]">Accessing Global Syllabus</p>
                  </div>
                </div>
              ) : result ? (
                <div className="space-y-10">
                  {/* Progressive Disclosure: Solution First */}
                   <motion.section 
                    initial={{ y: 30, opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                    animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.6, type: 'spring' }}
                    className="bg-slate-950 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group"
                   >
                    <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-transparent pointer-events-none" />
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand">Final Answer</span>
                      <motion.div 
                         animate={{ opacity: [0.5, 1, 0.5] }}
                         transition={{ duration: 2, repeat: Infinity }}
                         className="bg-brand/20 text-brand px-3 py-1 rounded-full text-[9px] font-black border border-brand/30"
                      >
                        CONFIRMED 100%
                      </motion.div>
                    </div>
                    <p className="text-3xl font-black tracking-tighter leading-tight whitespace-pre-wrap relative z-10 italic">{result.solution}</p>
                  </motion.section>

                  <motion.section 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-slate-50 p-7 rounded-[2.5rem] border-2 border-slate-100"
                  >
                    <div className="flex items-center justify-between mb-4">
                       <span className="bg-white px-4 py-1.5 rounded-full text-[10px] font-black text-brand shadow-sm border border-slate-100">{result.subject}</span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{result.topic}</span>
                    </div>
                    <p className="text-sm italic font-medium text-slate-600 leading-relaxed">"{query}"</p>
                  </motion.section>

                  <motion.section 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Tutorial Hub</h3>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => speak(result.explanation[difficulty])}
                          className={`p-3 rounded-2xl transition-all shadow-xl ${isSpeaking ? 'bg-brand text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          <Volume2 size={18} />
                        </motion.button>
                      </div>
                      <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200/50">
                        {(['beginner', 'intermediate', 'advanced'] as const).map(lev => (
                          <motion.button 
                            key={lev}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDifficulty(lev)}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${difficulty === lev ? 'bg-white shadow-xl text-brand' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {lev}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    <motion.div 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100 text-sm leading-relaxed text-slate-700 shadow-inner"
                    >
                      <motion.p 
                        key={difficulty}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="whitespace-pre-wrap font-bold"
                      >
                        {result.explanation[difficulty]}
                      </motion.p>
                    </motion.div>
                  </motion.section>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-emerald-50 rounded-3xl border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-700 mb-2 uppercase tracking-widest">Shortcut</p>
                      <p className="text-[11px] text-emerald-800 font-bold leading-relaxed">{result.shortcuts[0] || 'Use elimination.'}</p>
                    </div>
                    <div className="p-5 bg-amber-50 rounded-3xl border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-700 mb-2 uppercase tracking-widest">Mistake</p>
                      <p className="text-[11px] text-amber-800 font-bold leading-relaxed">{result.commonMistakes[0] || 'Check units.'}</p>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100 space-y-6">
                    <h3 className="font-extrabold text-center text-slate-400 uppercase text-[10px] tracking-[0.3em]">How confident do you feel?</h3>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-2xl">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          onClick={() => setConfidence(num)}
                          className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all ${
                            confidence === num 
                              ? 'bg-brand text-white shadow-md scale-110' 
                              : 'text-slate-400 hover:bg-white hover:text-brand'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    {confidence !== null && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                      >
                        <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-100 inline-block">
                          <p className="text-[11px] font-bold text-slate-700">
                            {confidence <= 4 ? "💡 Try 'Beginner' mode for a simpler story-based explanation!" : 
                             confidence >= 8 ? "🔥 Mastered! You're ready for the exam." : 
                             "🚀 Getting there! Review the shortcuts to save time."}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    <div className="flex gap-4">
                      <button 
                        onClick={handleSimplify}
                        className="flex-1 py-4 px-6 bg-slate-900 text-white rounded-2xl font-bold text-xs shadow-lg active:scale-95 transition-all"
                      >
                        Explain Simpler
                      </button>
                      <button 
                        onClick={() => { setScreen('home'); setConfidence(null); }}
                        className="flex-1 py-4 px-6 bg-brand text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-100 active:scale-95 transition-all"
                      >
                        Done & Continue
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                    <p className="text-slate-400 font-bold">Failed to load solution.</p>
                    <button onClick={() => setScreen('home')} className="mt-4 text-blue-600 font-bold">Try again</button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {screen === 'history' && (
          <motion.div 
            key="history"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="flex-1 overflow-y-auto px-6 py-10 pb-32 bg-slate-50"
          >
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <h2 className="text-3xl font-black tracking-tighter italic uppercase text-slate-900">Black Box.</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Retrieved Question Logs</p>
            </motion.div>

            <div className="space-y-4">
              {history.length > 0 ? history.map((item, idx) => (
                <motion.div 
                  key={item.id} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setResult(item); setScreen('solver'); }}
                  className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black bg-brand/10 text-brand px-2 py-0.5 rounded-full uppercase">{item.subject}</span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{new Date(item.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-black text-slate-900 truncate tracking-tight">{item.questionText}</p>
                  </div>
                  <motion.div 
                    whileHover={{ x: 3 }}
                    className="p-3 bg-slate-50 rounded-xl text-brand group-hover:bg-brand group-hover:text-white transition-colors"
                  >
                    <ChevronRight size={18} />
                  </motion.div>
                </motion.div>
              )) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200"
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <History size={32} />
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Storage Logs Empty</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
        {screen === 'profile' && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            transition={{ type: 'spring', damping: 20 }}
            className="px-6 py-10 h-full overflow-y-auto bg-white pb-32"
          >
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center mb-10"
            >
              <div className="relative inline-block">
                <motion.div 
                   animate={{ scale: [1, 1.05, 1] }}
                   transition={{ duration: 4, repeat: Infinity }}
                   className="absolute inset-[-10px] bg-brand/5 blur-2xl rounded-full" 
                />
                <img src={user?.photoURL || ''} className="w-24 h-24 rounded-[2.5rem] mx-auto border-4 border-white shadow-2xl mb-4 relative z-10" alt="avatar" />
                <motion.div 
                  initial={{ rotate: -20, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="absolute -bottom-1 -right-1 bg-brand text-white p-2.5 rounded-2xl shadow-xl border-4 border-white z-20"
                >
                  <Zap size={18} fill="currentColor" />
                </motion.div>
              </div>
              <h2 className="text-3xl font-black tracking-tighter text-slate-900 mt-4 italic uppercase">Mission Pilot.</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-[10px] font-black text-brand uppercase tracking-[0.2em] bg-brand/5 px-4 py-1.5 rounded-full border border-brand/10">{user?.displayName?.split(' ')[0]}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• {isPro ? 'Platinum Member' : 'Level 14'}</span>
              </div>
            </motion.div>

            {!isPro && (
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: '#000' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowPricing(true)}
                className="w-full mb-8 p-6 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-between shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-brand/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center shadow-lg">
                    <Zap size={24} fill="white" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black uppercase tracking-widest text-brand">Upgrade to Pro</p>
                    <p className="text-[10px] text-white/60 font-bold">Unleash Einstein-Level AI</p>
                  </div>
                </div>
                <ChevronRight size={20} className="relative z-10" />
              </motion.button>
            )}

            <div className="space-y-6">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand/20 blur-3xl rounded-full -mr-16 -mt-16" />
                <h3 className="text-[10px] font-black text-brand uppercase tracking-[0.4em] mb-4 relative z-10">Neural Library</h3>
                <div className="space-y-3 relative z-10">
                  {bookmarks.length > 0 ? bookmarks.map((item, idx) => (
                    <motion.div 
                      key={idx} 
                      whileHover={{ x: 5, backgroundColor: 'rgba(255,255,255,0.15)' }}
                      whileTap={{ scale: 0.98 }}
                      className="p-4 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-between cursor-pointer border border-white/10"
                      onClick={() => { setResult(item); setScreen('solver'); }}
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-[10px] font-black text-white truncate uppercase tracking-tighter">{item.topic}</p>
                        <p className="text-[8px] text-white/40 font-black uppercase tracking-widest">{item.subject}</p>
                      </div>
                      <Bookmark size={14} className="text-brand" fill="currentColor" />
                    </motion.div>
                  )) : (
                    <p className="text-[10px] text-white/40 font-black py-4 uppercase tracking-widest text-center border-2 border-dashed border-white/5 rounded-2xl">No Data Points Saved</p>
                  )}
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100"
              >
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-5">Deployment Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'SOLVED', val: history.length, icon: Zap, color: 'text-brand' },
                    { label: 'SAVED', val: bookmarks.length, icon: Bookmark, color: 'text-amber-500' },
                  ].map((stat, i) => (
                    <motion.div 
                      key={i} 
                      whileHover={{ y: -5 }}
                      className="bg-white p-5 rounded-[2.5rem] shadow-lg shadow-slate-200 border border-slate-100 flex flex-col items-center"
                    >
                      <div className={`p-3 rounded-2xl bg-slate-50 mb-3 ${stat.color}`}>
                        <stat.icon size={20} fill="currentColor" />
                      </div>
                      <span className="text-2xl font-black text-slate-900 tracking-tighter italic">{stat.val}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                onClick={() => auth.signOut()}
                className="w-full py-5 rounded-[2.5rem] bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-200 transition-all shadow-lg active:scale-95"
              >
                Switch Account / Logout
              </motion.button>
            </div>
          </motion.div>
        )}
          </>
        )}
      </AnimatePresence>

      {/* Pricing Activation Terminal */}
      <AnimatePresence>
        {showPricing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-xl flex flex-col p-6 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-10">
              <button onClick={() => setShowPricing(false)} className="p-3 bg-white/5 rounded-2xl text-white">
                <X size={24} />
              </button>
              <div className="text-right">
                <h2 className="text-xl font-black italic text-white tracking-tighter">LEVEL UP.</h2>
                <p className="text-[10px] text-brand font-black uppercase tracking-widest">Select Your Arsenal</p>
              </div>
            </div>

            <div className="space-y-6 max-w-sm mx-auto w-full">
              {[
                { id: 'free', name: 'Recruit', price: 'Free', color: 'bg-slate-800', desc: 'Standard 2026 Curriculum access', unit: '' },
                { id: 'master', name: 'Master', price: '₦2,500', color: 'bg-brand', desc: 'Unlimited AI Scans + WAEC/JAMB Tips', featured: true, unit: '/ MONTH' },
                { id: 'lifetime', name: 'Legend', price: '₦10,000', color: 'bg-indigo-500', desc: 'Active Forever. All Subjects + Career Path.', unit: 'ONCE' },
              ].map((plan, i) => (
                <motion.div 
                  key={plan.id}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 * i }}
                  whileHover={{ scale: 1.02 }}
                  className={`p-6 rounded-[3rem] border-2 ${plan.featured ? 'border-brand shadow-lg shadow-brand/20' : 'border-white/10'} bg-slate-900 relative overflow-hidden`}
                >
                  {plan.featured && (
                    <div className="absolute top-4 right-6 bg-brand text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Recommended</div>
                  )}
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black italic text-white uppercase mb-1">{plan.name}</h3>
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] mb-6">{plan.desc}</p>
                    <div className="flex items-baseline gap-1 mb-8">
                      <span className="text-4xl font-black text-white">{plan.price}</span>
                      <span className="text-[10px] text-white/40 font-bold">{plan.unit}</span>
                    </div>
                    <PaymentOptions 
                      plan={plan} 
                      user={user} 
                      onSuccess={() => { setIsPro(true); setShowPricing(false); }} 
                      onClose={() => {}}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="mt-10 py-10 text-center text-[10px] text-white/20 font-bold leading-relaxed uppercase tracking-widest">
              Secure checkout via ExamPilot Pay Terminal.<br/>
              No hidden cycles. Cancel mission anytime.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install App Guide */}
      <AnimatePresence>
        {showInstallModal && <InstallModal />}
      </AnimatePresence>

      {user && <Navbar active={screen} setScreen={setScreen} onInstall={handleInstallApp} />}
    </div>
  );
}
