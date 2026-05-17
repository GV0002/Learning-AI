import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  MapPin, 
  Briefcase, 
  Zap, 
  Mail, 
  Copy, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Layout,
  MousePointer2,
  Lock,
  Loader2,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { US_CITIES, NICHES } from "./constants";

interface Lead {
  id: string;
  name: string;
  website: string;
  address: string;
  city: string;
  state: string;
  foundEmail?: string;
  audit?: {
    score: number;
    findings: { observation: string; insight: string; gap: string }[];
    specificDetail: string;
  };
  draft?: {
    subject: string;
    body: string;
  };
  screenshotUrl?: string;
}

type Step = 'none' | 'scraping' | 'geocoding' | 'analyzing' | 'done';

export default function App() {
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedNiche, setSelectedNiche] = useState(NICHES[0].id);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  // Auto-map city to state
  useEffect(() => {
    const cityData = US_CITIES.find(c => c.id === selectedCity);
    if (cityData) {
      setSelectedState(cityData.state);
    }
  }, [selectedCity]);

  const searchLeads = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCity) return;

    const cityData = US_CITIES.find(c => c.id === selectedCity);
    const cityName = cityData ? cityData.city : selectedCity;

    setLoading(true);
    setLeads([]);
    setStatus("Geocoding location...");
    
    try {
      // 1. Geocode
      const geoRes = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: cityName, state: selectedState }),
      });
      const geoData = await geoRes.json();
      
      if (!geoRes.ok) throw new Error(geoData.error);

      // 2. Fetch Leads
      setStatus("Scraping leads from Geoapify...");
      const leadsRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          place_id: geoData.place_id, 
          categories: selectedNiche,
          lat: geoData.lat,
          lon: geoData.lon
        }),
      });
      const leadsData = await leadsRes.json();
      
      if (!leadsRes.ok) throw new Error(leadsData.error);
      
      setLeads(leadsData.leads);
      setStatus("");
    } catch (err: any) {
      console.error(err);
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const processLead = async (lead: Lead) => {
    setProcessingId(lead.id);
    
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: lead.website, name: lead.name }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...data } : l));
    } catch (err: any) {
      console.error("Process error:", err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6"
          >
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">ProspectPilot v1.0</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6"
          >
            Scale Your Agency <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">
              With AI Intelligence
            </span>
          </motion.h1>
          <motion.p 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.2 }}
             className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed"
          >
            Scrape local leads, audit their websites with Gemini Vision, 
            and draft hyper-personalized cold emails in seconds.
          </motion.p>
        </header>

        {/* Search Section */}
        <section className="max-w-4xl mx-auto mb-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl overflow-hidden relative"
          >
            <form onSubmit={searchLeads} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 ml-1">Niche</label>
                <div className="relative group">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400" />
                  <select 
                    value={selectedNiche}
                    onChange={(e) => setSelectedNiche(e.target.value)}
                    className="w-full bg-slate-800 border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-slate-800/80"
                  >
                    {NICHES.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 ml-1">City</label>
                <div className="relative group">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400" />
                  <select 
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full bg-slate-800 border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-slate-800/80"
                  >
                    <option value="">Select City</option>
                    {US_CITIES.map(c => <option key={c.id} value={c.id}>{c.city}, {c.state}</option>)}
                  </select>
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 ml-1">State</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input 
                    type="text"
                    value={selectedState}
                    disabled
                    placeholder="Auto-set"
                    className="w-full bg-slate-950/50 border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? "Finding..." : "Search Leads"}
              </button>
            </form>
            
            {status && (
              <div className="mt-6 flex items-center gap-3 text-xs text-indigo-400 bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/10">
                <Loader2 className="w-3 h-3 animate-spin" />
                {status}
              </div>
            )}
          </motion.div>
        </section>

        {/* Results Section */}
        <section className="space-y-8">
          <AnimatePresence mode="popLayout">
            {leads.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between mb-8"
              >
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Found {leads.length} Qualified Leads
                </h2>
              </motion.div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {leads.map((lead, index) => (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  index={index} 
                  isProcessing={processingId === lead.id}
                  onProcess={() => processLead(lead)}
                />
              ))}
            </div>
          </AnimatePresence>

          {leads.length === 0 && !loading && !status && (
            <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-dashed border-white/5">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-500">Select a city and niche to start pilotting your prospects.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface LeadCardProps {
  lead: Lead;
  index: number;
  onProcess: () => Promise<void> | void;
  isProcessing: boolean;
}

const LeadCard: React.FC<LeadCardProps> = ({ 
  lead, 
  index, 
  onProcess, 
  isProcessing 
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'email'>('audit');
  const [copiedId, setCopiedId] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 75) return "bg-green-500/10 border-green-500/20";
    if (score >= 50) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden group hover:border-indigo-500/30 transition-all duration-300 shadow-xl flex flex-col h-full"
    >
      {/* Top Info */}
      <div className="p-6 border-b border-white/5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
              {lead.name}
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {lead.city}, {lead.state}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" /> 
                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 hover:underline flex items-center gap-0.5">
                  {(() => {
                    try {
                      return new URL(lead.website).hostname;
                    } catch (e) {
                      return "website";
                    }
                  })()} <ExternalLink className="w-2 h-2" />
                </a>
              </span>
            </div>
          </div>
          
          {lead.audit && (
            <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border ${getScoreBg(lead.audit.score)}`}>
              <span className={`text-xl font-black ${getScoreColor(lead.audit.score)}`}>{lead.audit.score}</span>
              <span className="text-[8px] uppercase font-bold tracking-tighter opacity-50">Score</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-2 h-10 px-3 bg-slate-950/50 rounded-xl border border-white/5">
            <Mail className="w-4 h-4 text-slate-500" />
            <span className={`text-sm flex-1 truncate ${lead.foundEmail ? "text-green-400" : "text-slate-500 italic"}`}>
              {lead.foundEmail || "Email needed"}
            </span>
            {lead.foundEmail && (
              <button 
                onClick={() => copyToClipboard(lead.foundEmail!)}
                className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500"
              >
                {copiedId ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
          
          <button 
            onClick={onProcess}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
              lead.audit 
                ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white" 
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : lead.audit ? "Re-Audit" : "Analyze Lead"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-6 min-h-[300px]">
        {!lead.audit ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-slate-700">
              <MousePointer2 className="w-6 h-6" />
            </div>
            <p className="text-slate-500 text-sm max-w-[240px]">
              Ready to automate. Click "Analyze" to audit the website and draft an email.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col space-y-4">
            {/* Tabs */}
            <div className="flex p-1 bg-slate-950/50 rounded-xl border border-white/5">
              {(['audit', 'email'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all ${
                    activeTab === tab ? "bg-slate-800 text-white shadow-lg shadow-black/20" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab === 'audit' ? 'Website Audit' : 'Email Draft'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'audit' ? (
                <motion.div 
                  key="audit"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <div className="aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-white/5 ring-1 ring-white/5 shadow-inner">
                    <img 
                      src={lead.screenshotUrl} 
                      alt="Audit Source"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {lead.audit.findings.map((f, i) => (
                      <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs">
                        <div className="flex items-center gap-2 mb-1.5">
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          <span className="font-bold text-slate-300 uppercase tracking-tighter text-[10px]">Gap Found</span>
                        </div>
                        <p className="text-slate-400 font-medium italic mb-1">"{f.observation}"</p>
                        <p className="text-indigo-400/90 leading-relaxed font-semibold">{f.gap}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="email"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20 w-max">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">To: {lead.foundEmail || "prospect@email.com"}</span>
                    </div>
                    
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 space-y-3 relative group/email">
                      <div className="flex justify-between items-center pb-3 border-b border-white/5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Subject: {lead.draft?.subject}</span>
                        <button 
                          onClick={() => copyToClipboard(lead.draft?.body || "")}
                          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          Copy Body
                        </button>
                      </div>
                      <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap font-medium h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                        {lead.draft?.body}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-6">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 border-t-2 border-indigo-500 rounded-full"
              />
              <Zap className="w-8 h-8 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Analyzing Architecture</h4>
            <div className="w-full max-w-[200px] h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
              <motion.div 
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-1/2 h-full bg-indigo-500"
              />
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-black animate-pulse">Running Gemini Vision Audit...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
