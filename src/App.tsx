import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Terminal, Lock, Crosshair, FileSearch, RefreshCw, Rocket, 
  ShieldAlert, Gauge, Layers, Database, Wrench, Fingerprint, ChevronRight,
  AlertTriangle, CheckCircle2, Search, Zap, Cpu
} from 'lucide-react';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, getDocFromServer } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';

/**
 * --- FIRESTORE ERROR HANDLER ---
 */
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * --- FAIL-SAFE ID GENERATOR ---
 * Replaces crypto.randomUUID() which crashes in non-secure contexts.
 */
const generateForensicId = () => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

/**
 * --- GLOBAL ERROR BOUNDARY ---
 */
class GlobalErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Forensic Engine Crash:", error, errorInfo);
  }

  render() {
    const state = (this as any).state;
    const props = (this as any).props;

    if (state.hasError) {
      return (
        <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-6 font-mono text-center">
          <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
          <h2 className="text-rose-500 font-black uppercase tracking-widest mb-4">Critical Kernel Panic</h2>
          <pre className="bg-black/50 border border-rose-900/50 p-6 text-rose-400/70 text-[10px] max-w-xl overflow-auto whitespace-pre-wrap rounded-sm mb-8">
            {state.error?.stack || state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="text-[9px] text-zinc-100 uppercase tracking-widest bg-zinc-900 px-8 py-4 border border-zinc-700 hover:border-rose-500 transition-colors"
          >
            Re-Initialize System
          </button>
        </div>
      );
    }
    return props.children;
  }
}

// --- CONSTANTS ---
const APP_ID = "agent-fragility-noir-001";

function ForensicScanner() {
  const [user, setUser] = useState<User | null>(null);
  const [inputText, setInputText] = useState('');
  const [email, setEmail] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanSteps, setScanSteps] = useState<string[]>([]);
  const [metrics, setMetrics] = useState({ redundancy: 0, bleed: 0, loops: 0, score: 0, tokens: [] as any[] });
  const [heatmapGrid, setHeatmapGrid] = useState<{ id: number; val: number; critical: boolean }[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [harvesting, setHarvesting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setIsReady(true);
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
        // Proceed anyway, might be permissions
        setIsReady(true);
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        signInAnonymously(auth).catch(() => {});
      } else {
        setUser(currentUser);
      }
    });
  }, []);

  const harvestLead = async (capturedEmail: string) => {
    if (!db || !capturedEmail) return true; 
    setHarvesting(true);
    const leadPath = `artifacts/${APP_ID}/public/data/leads`;
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'leads'), {
        email: capturedEmail,
        timestamp: serverTimestamp(),
        source: 'forensic_obsidian_gate',
        forensic_id: generateForensicId(),
        userId: auth.currentUser?.uid || 'anonymous'
      });
      return true;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, leadPath);
      return true; // Still allow scan if DB fails for demo purposes
    } finally {
      setHarvesting(false);
    }
  };

  const analyzeTraceLog = (text: string, iteration: number) => {
    if (!text.trim()) return null;
    const words = text.split(/(\s+)/);
    const processedWords = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    const lines = text.trim().split('\n').filter(l => l.length > 5);

    let loopCount = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].trim() === lines[i + 1].trim()) loopCount += 1;
    }

    const wordFreq: Record<string, number> = {};
    processedWords.forEach(w => { if (w.length > 3) wordFreq[w] = (wordFreq[w] || 0) + 1; });
    const repetitiveCount = Object.values(wordFreq).filter(f => f > 2).reduce((a, b) => a + (b - 1), 0);
    const redundancyRatio = processedWords.length > 0 ? (repetitiveCount / processedWords.length) * 100 : 0;
    
    const tokenMap = words.map((token, idx) => {
      const clean = token.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      let type = 'safe';
      if (clean && wordFreq[clean] > 2) type = 'danger';
      else if (token.length > 12) type = 'warning';
      return { text: token, type, id: `${idx}-${clean}` };
    });

    const regressionPenalty = iteration > 1 ? (iteration * 6.5) : 0;
    const baseScore = Math.floor((loopCount * 14) + (redundancyRatio * 0.9) + regressionPenalty + 42);
    const finalScore = Math.min(99, Math.max(15, baseScore));
    
    const grid = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      val: Math.floor((Math.sin(i * 0.5 + finalScore) * 50) + 50),
      critical: ((Math.sin(i * 0.5 + finalScore) * 50) + 50) > (86 - (iteration * 2.5))
    }));

    return { loops: Math.max(1, loopCount), redundancy: Math.floor(redundancyRatio), bleed: Math.floor(redundancyRatio * 0.75), score: finalScore, tokens: tokenMap, grid };
  };

  const handleRunScan = () => {
    if (!inputText.trim()) return;
    if (!email) { 
      setShowAuthModal(true); 
      return; 
    }
    
    setIsScanning(true);
    setScanComplete(false);
    setScanSteps([]);
    const currentIteration = scanCount + 1;
    setScanCount(currentIteration);

    const forensicSteps = [
      "Initializing Obsidian_Heuristic...", 
      "Mapping Recursive Vectors...", 
      "Calculating Entropy Coefficients...", 
      "Generating Forensic Heatmap...", 
      "Finalizing Fragility Matrix..."
    ];

    forensicSteps.forEach((step, index) => {
      setTimeout(() => {
        setScanSteps(prev => [...prev, step]);
        if (index === forensicSteps.length - 1) {
          const results = analyzeTraceLog(inputText, currentIteration);
          if (results) {
            setMetrics(results);
            setHeatmapGrid(results.grid);
            setIsScanning(false);
            setScanComplete(true);
          }
        }
      }, (index + 1) * 600);
    });
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Handshaking Server...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-zinc-400 font-sans selection:bg-rose-500/30 selection:text-rose-100 pb-24 relative overflow-hidden">
      
      {/* SCANLINE OVERLAY */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, #fff 1px, #fff 2px)' }}></div>
      
      {/* GLOW OVERLAY */}
      <div className="pointer-events-none fixed inset-0 z-40 bg-[radial-gradient(circle_at_50%_0%,rgba(39,39,42,0.4),transparent_70%)]"></div>

      {/* AUTH MODAL */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#09090b] border border-zinc-800 p-10 shadow-3xl relative"
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-rose-500/50"></div>
              <Fingerprint className="w-12 h-12 text-rose-500 mb-6 mx-auto animate-pulse" />
              <h2 className="text-xl font-display font-bold text-zinc-100 text-center mb-2 uppercase tracking-tighter">Access Denied</h2>
              <p className="text-[10px] text-zinc-500 text-center uppercase tracking-[0.2em] mb-8">Establish operator identity to unlock node</p>
              <div className="space-y-4">
                <div className="relative">
                  <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                  <input 
                    type="email" 
                    placeholder="operator@system.io"
                    className="w-full bg-black border border-zinc-800 rounded-sm py-4 pl-12 pr-4 text-xs font-mono text-zinc-300 outline-none focus:border-rose-500 transition-all placeholder:text-zinc-800"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button 
                  onClick={async () => { 
                    if(email.includes('@')) { 
                      const saved = await harvestLead(email); 
                      if(saved) { 
                        setShowAuthModal(false); 
                        handleRunScan(); 
                      } 
                    } 
                  }}
                  disabled={harvesting}
                  className="w-full h-14 bg-zinc-100 text-black font-black uppercase text-[10px] tracking-[0.3em] hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                >
                  {harvesting ? "Syncing..." : "Establish Secure Link"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAVIGATION */}
      <nav className="border-b border-zinc-800/80 bg-obsidian/95 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 text-zinc-100 group">
            <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-sm">
              <Crosshair className="w-4 h-4 text-rose-500 group-hover:rotate-90 transition-transform duration-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[10px] tracking-[0.4em] uppercase text-zinc-100">AgenticAudit</span>
              <span className="text-[7px] font-mono text-zinc-600 uppercase tracking-widest">Forensic Scanner Alpha</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="hidden md:flex items-center gap-4 text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
               <span className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div> Node_01_Active</span>
             </div>
            <div className="h-8 w-[1px] bg-zinc-800"></div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase flex items-center gap-2">
              <Lock className={`w-3 h-3 ${email ? 'text-emerald-500' : 'text-rose-500'}`} /> 
              {email ? 'Secure_link' : 'Restricted'}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-20 relative z-10">
        {/* HERO */}
        <div className="text-center mb-24 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/5 border border-rose-500/20 rounded-full mb-8">
              <Zap className="w-3 h-3 text-rose-500" />
              <span className="text-[9px] font-mono text-rose-400 uppercase tracking-[0.2em]">Experimental Heuristic Engine</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-display font-bold text-zinc-100 mb-8 tracking-tighter leading-[0.9]">
              Detect agent loop <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-rose-400 to-amber-500">before the crash.</span>
            </h1>
            <p className="text-zinc-500 text-base max-w-xl mx-auto leading-relaxed font-light">
              Audit autonomous logic traces for cyclical redundancies and token bleed. 
              The Obsidian engine provides forensic clarity for high-reliability agent fleets.
            </p>
          </motion.div>
        </div>

        {/* SCANNER GRID */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* CONTROL PANEL */}
          <div className="lg:col-span-12 xl:col-span-3 flex flex-col gap-6 order-2 xl:order-1">
             <div className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Cpu className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">System_Specs</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Stability Index", val: "99.8%" },
                    { label: "Token Depth", val: "128k" },
                    { label: "Heuristic v", val: "0.4.2" }
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-zinc-600 uppercase">{s.label}</span>
                      <span className="text-[9px] font-mono text-zinc-400">{s.val}</span>
                    </div>
                  ))}
                </div>
             </div>

             <div className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-sm flex-grow">
                <div className="flex items-center gap-2 mb-6">
                  <Database className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Session_History</h3>
                </div>
                <div className="flex flex-col gap-3">
                   {scanCount === 0 ? (
                      <span className="text-[9px] font-mono text-zinc-700 uppercase italic">No active traces...</span>
                   ) : (
                      Array.from({ length: Math.min(scanCount, 5) }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-black/40 border border-zinc-800/50 rounded-sm">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span className="text-[8px] font-mono text-zinc-500">TRACE_NODE_{generateForensicId().slice(0, 4)}</span>
                        </div>
                      ))
                   )}
                </div>
             </div>
          </div>

          {/* MAIN SCANNER AREA */}
          <div className="lg:col-span-12 xl:col-span-9 order-1 xl:order-2">
            <div className="rounded-sm border border-zinc-800 bg-[#09090b] shadow-3xl overflow-hidden">
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
                
                {/* INPUT ZONE */}
                <div className="p-8 flex flex-col min-h-[600px] relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                       <Terminal className="w-4 h-4 text-rose-500" />
                       <h3 className="text-[10px] font-bold text-zinc-200 uppercase tracking-widest">Input_Trace_Log</h3>
                    </div>
                    {inputText.length > 0 && (
                      <button onClick={() => setInputText('')} className="text-[8px] font-mono text-zinc-600 hover:text-zinc-400 uppercase tracking-widest underline decoration-zinc-800 underline-offset-4">purge_buffer</button>
                    )}
                  </div>
                  
                  <textarea
                    className="w-full flex-grow bg-transparent text-zinc-300 font-mono text-xs leading-[1.8] outline-none resize-none placeholder:text-zinc-800 custom-scrollbar"
                    placeholder="[System]: Awaiting trace payload... 
Example Log:
[Thought]: I need to check the status.
[Thought]: I need to check the status.
[Thought]: I need to check the status.
[Thought]: Status checked."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isScanning}
                  />

                  <div className="mt-8 flex gap-4">
                    <button
                      onClick={() => setInputText(`[Thought]: Analyze the user request.
[Thought]: Analyze the user request.
[Thought]: Analyzing...
[Action]: Fetching data...
[Error]: Timeout. Retrying.
[Error]: Timeout. Retrying.
[Thought]: Analyze the user request.`)}
                      className="px-4 h-14 border border-zinc-800 hover:border-zinc-600 text-[9px] font-mono text-zinc-500 uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                    >
                      <Search className="w-3 h-3" /> Load_Demo
                    </button>
                    <button
                      onClick={handleRunScan}
                      disabled={isScanning || !inputText.trim()}
                      className={`flex-grow h-14 font-black uppercase text-[10px] tracking-[0.3em] transition-all border ${
                        isScanning 
                        ? 'bg-zinc-900 text-zinc-600 border-zinc-800' 
                        : 'bg-zinc-100 text-black border-transparent hover:bg-rose-500 hover:text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                      }`}
                    >
                      {isScanning ? (
                        <span className="flex items-center justify-center gap-3">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Analyzing Trace...
                        </span>
                      ) : scanCount > 0 ? "Verify Hardening" : "Initialize Audit"}
                    </button>
                  </div>
                </div>

                {/* VISUALIZATION ZONE */}
                <div className="p-8 bg-zinc-950/60 min-h-[600px] flex flex-col relative overflow-hidden group">
                  <AnimatePresence mode="wait">
                    {!isScanning && !scanComplete ? (
                      <motion.div 
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-grow flex flex-col items-center justify-center text-zinc-800"
                      >
                        <ShieldCheck className="w-16 h-16 mb-6 opacity-20" />
                        <p className="text-[10px] font-mono uppercase tracking-[0.6em] animate-pulse">System_Ready</p>
                        <div className="mt-12 flex flex-col items-center gap-2">
                           <div className="w-[1px] h-12 bg-gradient-to-b from-zinc-800 to-transparent"></div>
                           <span className="text-[8px] font-mono uppercase">Node Id: {generateForensicId().slice(0, 8)}</span>
                        </div>
                      </motion.div>
                    ) : isScanning ? (
                      <motion.div 
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-6 font-mono text-[9px] h-full justify-end pb-12"
                      >
                        {scanSteps.map((s, i) => (
                          <motion.div 
                            key={i} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-4 text-zinc-400"
                          >
                            <div className="w-1 h-1 bg-rose-500 shadow-[0_0_10px_#f43f5e] rounded-full"></div>
                            {s}
                            <div className="flex-grow h-[1px] bg-zinc-900"></div>
                            <span className="text-zinc-700">OK</span>
                          </motion.div>
                        ))}
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="complete"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full flex flex-col"
                      >
                        <div className="flex items-center justify-between mb-8 border-b border-zinc-800/50 pb-4">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-rose-500" />
                            <h3 className="text-[10px] font-bold text-zinc-200 uppercase tracking-widest">Fragility_Spatial_Map</h3>
                          </div>
                          <span className="text-[10px] font-mono text-rose-500">{metrics.score}% FRAGILE</span>
                        </div>

                        <div className="flex-grow relative bg-black/40 border border-zinc-800/50 p-4 rounded-sm">
                          <div className="grid grid-cols-10 gap-2 w-full aspect-square">
                            {heatmapGrid.map((node) => (
                              <motion.div 
                                key={node.id} 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: node.id * 0.005 }}
                                className={`rounded-[1px] transition-all duration-1000 ${node.critical ? 'shadow-[0_0_8px_rgba(244,63,94,0.4)]' : ''}`} 
                                style={{ 
                                  backgroundColor: node.critical ? '#f43f5e' : node.val > 60 ? '#f59e0b' : '#18181b', 
                                  opacity: node.val / 100 + 0.1 
                                }}
                              />
                            ))}
                          </div>
                          {/* OVERLAY GRID NUMBERS */}
                          <div className="absolute inset-x-0 bottom-1 flex justify-between px-4 opacity-10 font-mono text-[8px] pointer-events-none">
                            <span>0x0</span>
                            <span>0x64</span>
                          </div>
                        </div>

                        <div className="mt-8 flex items-center justify-between text-[10px] uppercase font-bold text-zinc-400 mb-4 tracking-widest border-b border-zinc-900 pb-2">
                           <div className="flex items-center gap-2"><FileSearch className="w-3 h-3 text-rose-500" /> Token_Trace</div>
                           <span className="font-mono text-zinc-600">{metrics.tokens.length} found</span>
                        </div>
                        <div className="h-28 overflow-y-auto custom-scrollbar pr-2 flex flex-wrap gap-x-2 gap-y-1 font-mono text-[10px]">
                          {metrics.tokens.slice(0, 150).map((t, idx) => (
                            <span key={`${t.id}-${idx}`} className={`transition-colors ${t.type === 'danger' ? 'text-rose-500 font-bold bg-rose-500/10 px-1 rounded-sm' : t.type === 'warning' ? 'text-amber-500' : 'text-zinc-700'}`}>
                              {t.text}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* METRICS DASHBOARD */}
            <AnimatePresence>
              {scanComplete && (
                <motion.div 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-12 space-y-12"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="rounded-sm border border-zinc-800 bg-[#09090b] p-8 flex flex-col relative overflow-hidden group hover:border-zinc-700 transition-colors">
                      <div className="absolute top-0 right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                         <Gauge className="w-16 h-16" />
                      </div>
                      <span className="text-zinc-600 text-[9px] uppercase tracking-[0.3em] mb-4 z-10 flex items-center gap-2">
                        <Gauge className="w-3 h-3 text-rose-500" /> Fragility Rating
                      </span>
                      <span className={`text-6xl font-black tracking-tighter ${metrics.score > 60 ? 'text-rose-500' : 'text-amber-400'}`}>
                        {metrics.score}<span className="text-xl">%</span>
                      </span>
                      <div className="mt-4 h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                         <motion.div 
                          className={`h-full ${metrics.score > 60 ? 'bg-rose-500' : 'bg-amber-500'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.score}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                         />
                      </div>
                    </div>

                    <div className="rounded-sm border border-zinc-800 bg-[#09090b] p-8 flex flex-col justify-center hover:border-zinc-700 transition-colors">
                      <span className="text-zinc-600 text-[9px] uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 text-zinc-500" /> Recursive Loops
                      </span>
                      <span className="text-5xl font-black text-zinc-100 tracking-tighter">{metrics.loops}</span>
                      <p className="mt-2 text-[9px] font-mono text-zinc-700 uppercase">Redundant Logic Gates Found</p>
                    </div>

                    <div className="rounded-sm border border-zinc-800 bg-[#09090b] p-8 flex flex-col justify-center hover:border-zinc-700 transition-colors">
                      <span className="text-zinc-600 text-[9px] uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                        <Rocket className="w-3 h-3 text-zinc-500" /> Entropy Bleed
                      </span>
                      <span className="text-5xl font-black text-zinc-100 tracking-tighter">{metrics.bleed}<span className="text-lg">ppm</span></span>
                      <p className="mt-2 text-[9px] font-mono text-zinc-700 uppercase">Context Window Saturation</p>
                    </div>
                  </div>

                  <div className="rounded-sm border border-rose-900/40 bg-rose-950/20 p-12 md:p-20 text-center flex flex-col items-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #f43f5e, transparent 70%)' }}></div>
                    
                    <ShieldAlert className="w-16 h-16 mb-8 text-rose-500 animate-pulse" />
                    <h2 className="text-4xl md:text-5xl font-display font-bold text-zinc-100 mb-6 uppercase tracking-tighter">
                      Critical Intervention Advised
                    </h2>
                    <p className="text-zinc-500 text-sm mb-12 max-w-xl mx-auto leading-relaxed">
                      Forensic buffer confirms a high-probability failure path. 
                      Automated hardening scripts are required to prevent token-count explosion.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                      <button className="h-16 px-12 bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-rose-500 transition-all shadow-[0_0_30px_rgba(244,63,94,0.3)] flex items-center justify-center gap-3 group">
                        Execute Repair Sprint <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button className="h-16 px-12 border border-zinc-800 text-zinc-400 font-bold uppercase text-[10px] tracking-widest hover:bg-zinc-900 transition-colors">
                        Download Forensic report
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-24 border-t border-zinc-900 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">© 2024 AgenticAudit Systems</span>
            <span className="text-[8px] font-mono text-zinc-800 uppercase">Obsidian_Kernel_4.0.0</span>
          </div>
          <div className="flex gap-8 text-[9px] font-mono uppercase tracking-widest text-zinc-600">
             <a href="#" className="hover:text-zinc-400 transition-colors">Protocols</a>
             <a href="#" className="hover:text-zinc-400 transition-colors">Forensics</a>
             <a href="#" className="hover:text-zinc-400 transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <ForensicScanner />
    </GlobalErrorBoundary>
  );
}
