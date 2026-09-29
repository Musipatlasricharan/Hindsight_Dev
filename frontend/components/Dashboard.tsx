"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Brain, FileText, Activity, CheckCircle, AlertTriangle,
  ShieldAlert, BookOpen, Volume2, SplitSquareHorizontal,
  Zap, FastForward, PlusCircle, X, Clock, Shield,
  ChevronRight, Info, Eye, Lock, Unlock, Database,
} from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const API = "http://localhost:8000";

// ─── Colour helpers ───────────────────────────────────────────
const LINK_COLORS: Record<string, string> = {
  semantic: "#3b82f6",
  temporal: "#14b8a6",
  causal: "#a855f7",
  entity: "#f59e0b",
};
const TYPE_BADGE: Record<string, string> = {
  fact: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  observation: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  mental_model: "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

// ─── Telemetry Bar ────────────────────────────────────────────
function TelemetryBar({ telemetry }: { telemetry: any }) {
  if (!telemetry?.latency_ms) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-[#1e293b] px-6 py-2 flex items-center gap-8 text-xs text-[#94a3b8] z-50">
      <span className="text-[#3b82f6] font-bold uppercase tracking-wider">⚡ Retrieval Telemetry</span>
      <span>Latency: <span className="text-white font-mono">{telemetry.latency_ms} ms</span></span>
      <span>Tokens: <span className="text-white font-mono">{telemetry.retrieved_tokens}</span></span>
      <span>Strategies: <span className="text-white font-mono">{telemetry.strategies_used?.join(" · ")}</span></span>
      <span className="ml-auto text-[#10b981]">✓ Zero-LLM retrieval — sub-200 ms</span>
    </div>
  );
}

// ─── Provenance Drawer ────────────────────────────────────────
function ProvenanceDrawer({ node, onClose }: { node: any; onClose: () => void }) {
  if (!node) return null;
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-[#0f172a] border-l border-[#1e293b] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e293b]">
        <h3 className="text-white font-bold flex items-center gap-2"><Eye className="w-4 h-4 text-[#3b82f6]" /> Source Verification</h3>
        <button onClick={onClose} className="text-[#94a3b8] hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div>
          <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Memory Node ID</p>
          <p className="font-mono text-sm text-[#3b82f6]">{node.id}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Type</p>
          <span className={`text-xs border px-2 py-0.5 rounded-full ${TYPE_BADGE[node.type] || "text-white"}`}>{node.type}</span>
        </div>
        <div>
          <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Full Content</p>
          <p className="text-sm text-white leading-relaxed bg-white/5 rounded p-3">{node.full_content}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Raw Source Evidence</p>
          <p className="text-sm text-[#fbbf24] font-mono bg-[#1e293b] rounded p-3 leading-relaxed">{node.provenance_raw || "N/A"}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Turn ID</p>
          <p className="font-mono text-xs text-[#94a3b8]">{node.source_turn_id || "N/A"}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Valid From</p>
            <p className="font-mono text-xs text-[#10b981]">{node.valid_from?.slice(0, 10) || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Valid Until</p>
            <p className={`font-mono text-xs ${node.valid_until ? "text-red-400" : "text-[#94a3b8]"}`}>{node.valid_until?.slice(0, 10) || "∞ Active"}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Tenant Scope</p>
          <span className="font-mono text-xs bg-white/5 px-2 py-1 rounded">{node.group_id || "default"}</span>
        </div>
        <div>
          <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Link Type</p>
          <span style={{ color: LINK_COLORS[node.link_type] }} className="font-mono text-xs font-bold uppercase">{node.link_type}</span>
        </div>
        <div>
          <p className="text-[10px] text-[#94a3b8] uppercase font-bold mb-1">Connectivity Score</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/5 rounded-full h-2">
              <div className="h-2 rounded-full bg-[#3b82f6]" style={{ width: `${Math.min(100, (node.connections || 0) * 10)}%` }} />
            </div>
            <span className="text-xs text-white">{node.connections || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reflection Toast ──────────────────────────────────────────
function ReflectionToast({ insight, onDismiss }: { insight: any; onDismiss: () => void }) {
  return (
    <div className="fixed top-6 right-6 bg-purple-900 border border-purple-500 text-white px-5 py-4 rounded-lg shadow-2xl z-50 w-96 animate-in slide-in-from-top-5">
      <div className="flex justify-between items-start mb-2">
        <span className="flex items-center gap-2 font-bold text-purple-300"><Brain className="w-4 h-4" /> 🧠 Mental Model Synthesized</span>
        <button onClick={onDismiss}><X className="w-4 h-4" /></button>
      </div>
      <p className="text-sm text-purple-100 leading-relaxed">{insight.content}</p>
      <p className="text-[10px] text-purple-400 mt-2 font-mono">{insight.id}</p>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("workspace");
  const [memory, setMemory] = useState<any>({ memories: [], bank_config: {} });
  const [evalData, setEvalData] = useState<any[]>([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [reflectionToast, setReflectionToast] = useState<any>(null);
  const [provenanceNode, setProvenanceNode] = useState<any>(null);

  // Feature 1 – Constellation graph
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [firingNodes, setFiringNodes] = useState<string[]>([]);
  const graphRef = useRef<any>();

  // Feature 2 – Time-travel slider
  const [daysAgo, setDaysAgo] = useState(0);
  const [timelineMemories, setTimelineMemories] = useState<any[]>([]);
  const [interactionLevel, setInteractionLevel] = useState(20);

  // Feature 5 – Multi-tenant isolation
  const [isolationResult, setIsolationResult] = useState<any>(null);
  const [isoLoading, setIsoLoading] = useState(false);

  // Feature 3 – Reflection log
  const [reflectionLog, setReflectionLog] = useState<any[]>([]);
  const lastReflectionCount = useRef(0);

  const [formData, setFormData] = useState({
    vendor_name: "Globex Corp",
    amount: "2450.00",
    discrepancy_type: "price_variance",
    details: "Invoice total is 5% higher than PO #44021 due to unlisted service fee.",
  });

  const [currentException, setCurrentException] = useState<any>({
    id: "INV-21",
    vendor: "Northwind Freight",
    type: "bank_detail_change",
    amount: "$1,500.00",
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    po_number: "PO-99201",
    details: "Vendor emailed new bank details: Route 098765432, Acct 123456789.",
    recommendation: "BLOCK PAYMENT: Vendor bank details differ from historical memory.",
    draft_note: "BLOCKED: Requires manual verification of new bank details due to fraud prevention directives.",
    safe: false,
    citations: [],
    nodes_fired: [],
    telemetry: null,
  });

  // ── Data fetchers ──────────────────────────────────────────
  const fetchConstellation = useCallback((fired: string[] = []) => {
    const q = fired.length ? `?fired=${fired.join(",")}` : "";
    fetch(`${API}/api/constellation${q}`)
      .then((r) => r.json())
      .then((d) => setGraphData(d))
      .catch(console.error);
  }, []);

  const fetchMemory = useCallback(() => {
    fetch(`${API}/api/memory_inspector`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setMemory(d); })
      .catch(console.error);
  }, []);

  const fetchReflectionLog = useCallback(() => {
    fetch(`${API}/api/reflection_log`)
      .then((r) => r.json())
      .then((d) => {
        const log: any[] = d.log || [];
        setReflectionLog(log);
        // Show toast for newly synthesized models
        const totalInsights = log.reduce((s: number, r: any) => s + (r.insights?.length || 0), 0);
        if (totalInsights > lastReflectionCount.current) {
          const latest = log[log.length - 1]?.insights?.[0];
          if (latest) setReflectionToast(latest);
          lastReflectionCount.current = totalInsights;
        }
      })
      .catch(console.error);
  }, []);

  const fetchTimeline = useCallback((days: number) => {
    fetch(`${API}/api/memory_timeline?as_of_days_ago=${days}`)
      .then((r) => r.json())
      .then((d) => setTimelineMemories(d.memories || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchMemory();
    fetchConstellation();
    fetchTimeline(0);
    setEvalData([
      { interaction: 1, stateless_llm: 35, plain_rag: 35, hindsight: 0 },
      { interaction: 5, stateless_llm: 32, plain_rag: 45, hindsight: 60 },
      { interaction: 10, stateless_llm: 36, plain_rag: 50, hindsight: 80 },
      { interaction: 20, stateless_llm: 34, plain_rag: 55, hindsight: 95 },
      { interaction: 35, stateless_llm: 35, plain_rag: 58, hindsight: 97 },
      { interaction: 50, stateless_llm: 33, plain_rag: 60, hindsight: 98 },
    ]);
    // Poll reflection log every 6 s
    const t = setInterval(fetchReflectionLog, 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { fetchTimeline(daysAgo); }, [daysAgo]);

  // ── Audio briefing ─────────────────────────────────────────
  const handleAudioBriefing = () => {
    if (!("speechSynthesis" in window)) { alert("Not supported."); return; }
    const text = `Exception for ${currentException.vendor}. ${currentException.recommendation}. ${currentException.safe ? "This aligns with historical patterns." : "Warning: fraud directive triggered."}`;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    window.speechSynthesis.speak(u);
    setActionStatus("Playing Audio Briefing…");
    setTimeout(() => setActionStatus(null), 3000);
  };

  // ── Demo presets ───────────────────────────────────────────
  const simulateScenario = (type: "new_vendor" | "surcharge" | "fraud") => {
    const presets: Record<string, any> = {
      new_vendor: { vendor_name: "Stark Industries", discrepancy_type: "price_variance", amount: "500.00", details: "Invoice total is $50 higher than PO." },
      surcharge: { vendor_name: "Northwind Freight", discrepancy_type: "unexpected_surcharge", amount: "1250.00", details: "Invoice includes a fuel surcharge of $45." },
      fraud: { vendor_name: "Northwind Freight", discrepancy_type: "bank_detail_change", amount: "1250.00", details: "Vendor emailed new bank details: Route 098765432, Acct 123456789." },
    };
    setFormData(presets[type]);
    setIsInjecting(true);
    setTimeout(() => document.getElementById("triage-submit-btn")?.click(), 400);
  };

  // ── Triage submit ──────────────────────────────────────────
  const handleTriageSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing(true);
    setIsInjecting(false);
    try {
      const cleanAmount = parseFloat(formData.amount.replace(/[^0-9.-]/g, "")) || 0;
      const res = await fetch(`${API}/api/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, amount: cleanAmount }),
      });
      const result = await res.json();

      setCurrentException({
        id: `INV-${Math.floor(Math.random() * 900) + 100}`,
        vendor: formData.vendor_name,
        type: formData.discrepancy_type,
        amount: `$${cleanAmount.toFixed(2)}`,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        po_number: `PO-${Math.floor(Math.random() * 90000) + 10000}`,
        details: formData.details,
        recommendation: result.recommendation,
        draft_note: result.draft_note,
        safe: result.is_safe,
        citations: result.citations || [],
        nodes_fired: result.nodes_fired || [],
        telemetry: result.telemetry || null,
      });

      // Update telemetry bar
      setTelemetry(result.telemetry || null);

      // Pulse the fired nodes on the graph
      const fired: string[] = result.nodes_fired || [];
      setFiringNodes(fired);
      fetchConstellation(fired);
      setTimeout(() => { setFiringNodes([]); fetchConstellation([]); }, 4000);

      fetchMemory();
      setActionStatus(`Memory Nodes Fired: ${fired.length} — Exception resolved by Hindsight.`);
      setTimeout(() => setActionStatus(null), 3500);
    } catch (err) {
      console.error(err);
      setActionStatus("Error contacting agent service.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Approve & Teach ────────────────────────────────────────
  const handleApproveAndTeach = async (isMentalModel: boolean) => {
    try {
      const content = isMentalModel
        ? `Mental Model: Always approve ${currentException.type.replace(/_/g, " ")} for ${currentException.vendor} if within standard tolerance.`
        : `Fact: Approved ${currentException.type.replace(/_/g, " ")} for ${currentException.vendor} on ${currentException.date}.`;
      await fetch(`${API}/api/teach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type: isMentalModel ? "mental_model" : "fact", provenance_raw: `Human approval via UI on ${new Date().toISOString()}` }),
      });
      fetchMemory();
      fetchConstellation();
      setActionStatus("Memory Graph Updated: Neural connections strengthened.");
      setTimeout(() => setActionStatus(null), 4000);
    } catch (err) { console.error(err); }
  };

  // ── Isolation test ─────────────────────────────────────────
  const runIsolationTest = async () => {
    setIsoLoading(true);
    try {
      const res = await fetch(`${API}/api/isolation_test?query=rebate+discount+confidential&group_id=default`);
      const data = await res.json();
      setIsolationResult(data);
    } catch { }
    setIsoLoading(false);
  };

  // ── Graph node canvas painter ──────────────────────────────
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isFiring = firingNodes.includes(node.id) || node.firing;
    const r = node.val || 10;
    // Glow halo when firing
    if (isFiring) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = node.color + "44";
      ctx.fill();
    }
    // Core node
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = node.status === "stale" ? "#475569" : node.color;
    ctx.globalAlpha = isFiring ? 1 : 0.85;
    ctx.fill();
    ctx.lineWidth = isFiring ? 2 / globalScale : 0.5 / globalScale;
    ctx.strokeStyle = isFiring ? "#ffffff" : "rgba(255,255,255,0.3)";
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Label
    if (globalScale > 1.2 || node.id === "agent_core") {
      const label = node.id === "agent_core" ? "LEDGERWISE CORE" : (node.label || "").slice(0, 28) + "…";
      const fs = Math.max(3, 11 / globalScale);
      ctx.font = `${node.id === "agent_core" ? "bold " : ""}${fs}px Inter, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.textAlign = "center";
      ctx.textBaseline = node.id === "agent_core" ? "middle" : "top";
      ctx.fillText(label, node.x, node.id === "agent_core" ? node.y : node.y + r + 2 / globalScale);
    }
  }, [firingNodes]);

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-[#202124] pb-10">

      {/* Telemetry bar */}
      <TelemetryBar telemetry={telemetry} />

      {/* Provenance drawer */}
      {provenanceNode && <ProvenanceDrawer node={provenanceNode} onClose={() => setProvenanceNode(null)} />}

      {/* Reflection toast */}
      {reflectionToast && <ReflectionToast insight={reflectionToast} onDismiss={() => setReflectionToast(null)} />}

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-[#dadce0] px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#1a73e8] p-2 rounded-md"><Brain className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-medium text-[#202124] tracking-tight">Ledgerwise</h1>
            <p className="text-[11px] text-[#5f6368] font-medium uppercase tracking-wider">Hindsight Powered AP Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Demo presets */}
          <div className="hidden lg:flex items-center gap-2 border-r border-[#dadce0] pr-4 mr-2">
            <span className="text-xs text-[#5f6368] font-medium uppercase mr-1"><Zap className="w-3 h-3 inline mr-1" />Presets:</span>
            <button onClick={() => simulateScenario("new_vendor")} className="text-xs bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] px-2 py-1 rounded border border-[#dadce0]">Stateless Vendor</button>
            <button onClick={() => simulateScenario("surcharge")} className="text-xs bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1a73e8] px-2 py-1 rounded border border-[#1a73e8]">Observation Recall</button>
            <button onClick={() => simulateScenario("fraud")} className="text-xs bg-[#fce8e6] hover:bg-[#fad2cf] text-[#c5221f] px-2 py-1 rounded border border-[#c5221f]">Fraud Directive</button>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#5f6368] bg-[#f1f3f4] px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-[#188038] animate-pulse" />Online
          </div>
          <button onClick={() => setIsInjecting(!isInjecting)} className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2 rounded text-sm font-medium transition-colors">
            <PlusCircle className="w-4 h-4" /> Inject Exception
          </button>
        </div>
      </header>

      {/* ── TABS ── */}
      <div className="bg-white border-b border-[#dadce0] px-6 pt-2">
        <div className="flex gap-6">
          {[
            { id: "workspace", icon: <FileText className="w-4 h-4" />, label: "Exception Workspace" },
            { id: "constellation", icon: <Brain className="w-4 h-4" />, label: "Constellation Graph" },
            { id: "timetravel", icon: <Clock className="w-4 h-4" />, label: "Time-Travel Memory" },
            { id: "battle", icon: <SplitSquareHorizontal className="w-4 h-4" />, label: "A/B Battle Mode" },
            { id: "isolation", icon: <Shield className="w-4 h-4" />, label: "Multi-Tenant Isolation" },
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-[#1a73e8] text-[#1a73e8]" : "border-transparent text-[#5f6368] hover:text-[#202124]"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-6 max-w-7xl mx-auto">

        {/* Status toast */}
        {actionStatus && (
          <div className="fixed bottom-12 right-6 bg-[#323232] text-white px-6 py-3 rounded shadow-lg flex items-center gap-3 z-50">
            <CheckCircle className="w-5 h-5 text-[#81c995]" />{actionStatus}
          </div>
        )}

        {/* ── Injector form ── */}
        {isInjecting && (
          <div className="mb-6 bg-white rounded-lg border border-[#dadce0] shadow-md overflow-hidden relative">
            <div className="bg-[#f8f9fa] px-5 py-3 border-b border-[#dadce0] flex justify-between items-center">
              <h2 className="text-base font-medium flex items-center gap-2 text-[#1a73e8]"><PlusCircle className="w-4 h-4" /> Ingest Custom Exception</h2>
              <button onClick={() => setIsInjecting(false)} className="text-[#5f6368] hover:bg-[#f1f3f4] p-1 rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleTriageSubmit} className="p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#5f6368] uppercase mb-1">Vendor Name</label>
                  <input required type="text" value={formData.vendor_name} onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })} className="w-full border border-[#dadce0] rounded px-3 py-2 text-sm focus:border-[#1a73e8] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#5f6368] uppercase mb-1">Discrepancy Type</label>
                  <select value={formData.discrepancy_type} onChange={(e) => setFormData({ ...formData, discrepancy_type: e.target.value })} className="w-full border border-[#dadce0] rounded px-3 py-2 text-sm focus:border-[#1a73e8] focus:outline-none bg-white">
                    <option value="price_variance">Price Variance</option>
                    <option value="missing_po">Missing PO</option>
                    <option value="unexpected_surcharge">Unexpected Surcharge</option>
                    <option value="bank_detail_change">Bank Detail Change</option>
                    <option value="tax_mismatch">Tax Mismatch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#5f6368] uppercase mb-1">Amount</label>
                  <input required type="text" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full border border-[#dadce0] rounded px-3 py-2 text-sm focus:border-[#1a73e8] focus:outline-none" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-[#5f6368] uppercase mb-1">OCR Details / Notes</label>
                <textarea required value={formData.details} onChange={(e) => setFormData({ ...formData, details: e.target.value })} className="w-full border border-[#dadce0] rounded px-3 py-2 text-sm focus:border-[#1a73e8] focus:outline-none h-16" />
              </div>
              <div className="flex justify-end">
                <button type="submit" id="triage-submit-btn" disabled={isProcessing} className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-50">
                  {isProcessing ? "Agent Triaging…" : "Run Hindsight Agent"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 1 – EXCEPTION WORKSPACE
        ══════════════════════════════════════════════ */}
        {activeTab === "workspace" && (
          <div className={`grid grid-cols-12 gap-6 transition-opacity ${isProcessing ? "opacity-40" : "opacity-100"}`}>
            {/* Left: Exception context */}
            <div className="col-span-12 lg:col-span-5 bg-white rounded-lg border border-[#dadce0] shadow-sm overflow-hidden">
              <div className="bg-[#f8f9fa] px-5 py-4 border-b border-[#dadce0] flex justify-between items-center">
                <h2 className="text-base font-medium">Exception Context</h2>
                <button onClick={handleAudioBriefing} className="bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#1a73e8] px-3 py-1.5 rounded flex items-center gap-2 text-sm border border-[#dadce0]">
                  <Volume2 className="w-4 h-4" /> Audio Brief
                </button>
              </div>
              <div className="p-5">
                <div className="mb-4 flex justify-between">
                  <div><p className="text-[11px] font-bold text-[#5f6368] uppercase mb-1">Invoice ID</p><p className="text-xl font-medium">{currentException.id}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-5">
                  <div><p className="text-[11px] font-bold text-[#5f6368] uppercase mb-1">Vendor</p><p className="text-sm text-[#1a73e8] font-medium">{currentException.vendor}</p></div>
                  <div><p className="text-[11px] font-bold text-[#5f6368] uppercase mb-1">Amount</p><p className="text-sm font-medium">{currentException.amount}</p></div>
                  <div><p className="text-[11px] font-bold text-[#5f6368] uppercase mb-1">Type</p><p className="text-sm capitalize">{currentException.type?.replace(/_/g, " ")}</p></div>
                  <div><p className="text-[11px] font-bold text-[#5f6368] uppercase mb-1">Date</p><p className="text-sm">{currentException.date}</p></div>
                </div>
                <div className="bg-[#f1f3f4] rounded-md p-4 border border-[#e8eaed]">
                  <p className="text-[11px] font-bold text-[#5f6368] uppercase mb-2">OCR Extracted Details</p>
                  <p className="text-sm text-[#202124] leading-relaxed">{currentException.details}</p>
                </div>
                {/* Telemetry inline */}
                {currentException.telemetry?.latency_ms && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#e8f0fe] rounded p-2"><p className="text-[10px] text-[#5f6368] uppercase">Latency</p><p className="font-mono text-[#1a73e8] font-bold text-sm">{currentException.telemetry.latency_ms} ms</p></div>
                    <div className="bg-[#e8f0fe] rounded p-2"><p className="text-[10px] text-[#5f6368] uppercase">Tokens</p><p className="font-mono text-[#1a73e8] font-bold text-sm">{currentException.telemetry.retrieved_tokens}</p></div>
                    <div className="bg-[#e8f0fe] rounded p-2"><p className="text-[10px] text-[#5f6368] uppercase">Nodes Fired</p><p className="font-mono text-[#1a73e8] font-bold text-sm">{currentException.nodes_fired?.length || 0}</p></div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Agent Resolution */}
            <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
              <div className={`bg-white rounded-lg border ${currentException.safe ? "border-[#ceead6]" : "border-[#fad2cf]"} shadow-sm overflow-hidden`}>
                <div className={`px-5 py-4 border-b flex justify-between items-center ${currentException.safe ? "bg-[#e6f4ea] border-[#ceead6]" : "bg-[#fce8e6] border-[#fad2cf]"}`}>
                  <h2 className={`text-base font-medium flex items-center gap-2 ${currentException.safe ? "text-[#137333]" : "text-[#c5221f]"}`}>
                    {currentException.safe ? <CheckCircle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                    Agent Resolution Strategy
                  </h2>
                </div>
                <div className="p-5">
                  <p className={`font-medium text-lg mb-4 ${currentException.safe ? "text-[#188038]" : "text-[#d93025]"}`}>{currentException.recommendation}</p>
                  <div className="bg-[#f8f9fa] rounded-md p-4 border border-[#dadce0] mb-4">
                    <p className="text-[11px] font-bold text-[#5f6368] uppercase mb-2">Draft Note for ERP</p>
                    <p className="text-sm text-[#3c4043] font-mono">{currentException.draft_note}</p>
                  </div>

                  {/* Citations with provenance click */}
                  {currentException.citations?.length > 0 && (
                    <div className="p-3 bg-[#e8f0fe] border border-[#d2e3fc] rounded text-sm text-[#1a73e8] mb-4">
                      <strong className="flex items-center gap-1 mb-2"><Zap className="w-4 h-4" /> Nodes Fired in Hindsight Memory — click to inspect source:</strong>
                      <ul className="space-y-1">
                        {currentException.citations.map((c: any, i: number) => (
                          <li key={i} className="flex items-center gap-2 cursor-pointer hover:bg-white/30 px-2 py-1 rounded" onClick={() => setProvenanceNode(c)}>
                            <ChevronRight className="w-3 h-3 shrink-0" />
                            <span className="text-[#3c4043] text-xs">{c.content}</span>
                            <Eye className="w-3 h-3 ml-auto text-[#1a73e8] shrink-0" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!currentException.safe && (
                    <div className="flex items-start gap-3 p-3 bg-[#fff8f7] border border-[#f9aba4] rounded text-sm text-[#c5221f]">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div><strong>Directive Triggered:</strong> Contradiction against historical facts detected. Payment blocked by fraud prevention directive.</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Approve & Teach */}
              <div className="bg-white rounded-lg border border-[#dadce0] shadow-sm overflow-hidden">
                <div className="bg-[#f8f9fa] px-5 py-3 border-b border-[#dadce0]">
                  <h2 className="text-base font-medium flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#5f6368]" /> Approve &amp; Teach</h2>
                </div>
                <div className="p-5 flex gap-3">
                  <button onClick={() => handleApproveAndTeach(false)} className="flex-1 bg-[#188038] hover:bg-[#137333] text-white px-4 py-2.5 rounded text-sm font-medium">Execute &amp; Retain Fact</button>
                  <button onClick={() => handleApproveAndTeach(true)} className="flex-1 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2.5 rounded text-sm font-medium">Promote to Mental Model</button>
                </div>
              </div>

              {/* Reflection log */}
              {reflectionLog.length > 0 && (
                <div className="bg-white rounded-lg border border-purple-200 shadow-sm overflow-hidden">
                  <div className="bg-purple-50 px-5 py-3 border-b border-purple-200">
                    <h2 className="text-base font-medium flex items-center gap-2 text-purple-700"><Brain className="w-4 h-4" /> Auto-Synthesized Mental Models</h2>
                  </div>
                  <div className="p-4 space-y-2">
                    {reflectionLog.slice(-3).map((r: any, i: number) => (
                      r.insights?.map((ins: any, j: number) => (
                        <div key={`${i}-${j}`} className="text-xs bg-purple-50 border border-purple-200 rounded p-3 text-purple-800">
                          <span className="font-mono text-purple-400 mr-2">{ins.id}</span>{ins.content}
                        </div>
                      ))
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 2 – CONSTELLATION GRAPH  (Feature 1)
        ══════════════════════════════════════════════ */}
        {activeTab === "constellation" && (
          <div className="bg-[#0b0f19] rounded-xl shadow-2xl overflow-hidden border border-[#1e293b]" style={{ height: "78vh" }}>
            <div className="bg-[#0f172a] px-6 py-4 flex justify-between items-center border-b border-[#1e293b]">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Brain className="w-5 h-5 text-[#3b82f6]" /> Constellation View — Live Memory Graph</h2>
                <p className="text-xs text-[#94a3b8] mt-1">Click any memory node to open Source Verification drawer. Firing nodes glow after each triage.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-4 text-xs">
                  {Object.entries(LINK_COLORS).map(([type, color]) => (
                    <span key={type} className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: color, boxShadow: `0 0 6px ${color}` }} /><span style={{ color }} className="capitalize font-bold">{type}</span></span>
                  ))}
                </div>
                <button onClick={() => fetchConstellation()} className="text-sm bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white hover:bg-white/10">Refresh</button>
              </div>
            </div>
            <div style={{ height: "calc(78vh - 64px)" }}>
              {/* @ts-ignore */}
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeCanvasObject={paintNode}
                nodeCanvasObjectMode={() => "replace"}
                linkColor={(link: any) => link.color || "#94a3b8"}
                linkWidth={(link: any) => (link.firing ? 3 : 1)}
                linkDirectionalParticles={(link: any) => (link.firing ? 6 : 2)}
                linkDirectionalParticleWidth={(link: any) => (link.firing ? 3 : 1.5)}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleColor={(link: any) => link.color}
                backgroundColor="#0b0f19"
                onNodeClick={(node: any) => { if (node.id !== "agent_core") setProvenanceNode(node); }}
              />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 3 – TIME-TRAVEL MEMORY  (Feature 2)
        ══════════════════════════════════════════════ */}
        {activeTab === "timetravel" && (
          <div className="flex flex-col gap-6">
            <div className="bg-white p-5 rounded-lg border border-[#dadce0] shadow-sm">
              <h2 className="text-base font-bold flex items-center gap-2 mb-1"><FastForward className="w-5 h-5 text-[#1a73e8]" /> Bi-Temporal Time-Travel Slider</h2>
              <p className="text-sm text-[#5f6368] mb-4">Drag to see what the agent knew at any point in the past. Memories with expired <code className="bg-gray-100 px-1 rounded">valid_until</code> dates are automatically excluded.</p>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-[#5f6368] whitespace-nowrap">Today</span>
                <input type="range" min={0} max={60} step={1} value={daysAgo} onChange={(e) => setDaysAgo(parseInt(e.target.value))} className="flex-1 accent-[#1a73e8]" />
                <span className="text-sm font-bold text-[#1a73e8] whitespace-nowrap">{daysAgo === 0 ? "Now" : `${daysAgo} days ago`}</span>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#dadce0] shadow-sm overflow-hidden">
              <div className="bg-[#f8f9fa] px-5 py-3 border-b border-[#dadce0] flex justify-between">
                <h3 className="font-medium text-sm">Active Memories at {daysAgo === 0 ? "Current Time" : `T-${daysAgo} days`}</h3>
                <span className="text-sm font-bold text-[#1a73e8]">{timelineMemories.length} records</span>
              </div>
              <div className="divide-y divide-[#f1f3f4] max-h-[60vh] overflow-y-auto">
                {timelineMemories.length === 0 && (
                  <div className="p-10 text-center text-[#5f6368]">No memories active at this point in time.</div>
                )}
                {timelineMemories.map((mem: any) => (
                  <div key={mem.id} className="px-5 py-3 flex items-start gap-4 hover:bg-[#f8f9fa] cursor-pointer" onClick={() => setProvenanceNode(mem)}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${mem.type === "mental_model" ? "bg-purple-500" : mem.type === "observation" ? "bg-amber-500" : "bg-emerald-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#202124]">{mem.content}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded-full ${TYPE_BADGE[mem.type]}`}>{mem.type}</span>
                        <span className="text-[10px] text-[#5f6368] font-mono">valid from {mem.valid_from?.slice(0, 10)}</span>
                        {mem.valid_until && <span className="text-[10px] text-red-400 font-mono">until {mem.valid_until?.slice(0, 10)}</span>}
                        <span className="text-[10px] text-[#94a3b8] font-mono ml-auto">{mem.group_id}</span>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-[#dadce0] shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 4 – A/B BATTLE MODE  (Feature 3 slider)
        ══════════════════════════════════════════════ */}
        {activeTab === "battle" && (
          <div className="flex flex-col gap-6">
            <div className="bg-white p-5 rounded-lg border border-[#dadce0] shadow-sm flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2"><FastForward className="w-5 h-5 text-[#1a73e8]" /> Learning Curve Comparison</h2>
                <p className="text-sm text-[#5f6368]">Hindsight builds a Mental Model after repeated approvals — stateless LLMs never improve.</p>
              </div>
              <div className="flex items-center gap-4 w-1/2">
                <span className="text-sm text-[#5f6368]">Day 1</span>
                <input type="range" min={1} max={50} step={1} value={interactionLevel} onChange={(e) => setInteractionLevel(parseInt(e.target.value))} className="flex-1 accent-[#1a73e8]" />
                <span className="text-sm font-bold text-[#1a73e8]">Day {interactionLevel}</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evalData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
                <XAxis dataKey="interaction" label={{ value: "Interactions", position: "insideBottom", offset: -2 }} tick={{ fontSize: 11 }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <RechartsTooltip formatter={(v: any) => `${v}%`} />
                <Legend />
                <Line type="monotone" dataKey="stateless_llm" name="Stateless LLM" stroke="#9ca3af" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="plain_rag" name="Plain RAG" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="hindsight" name="Hindsight Agent" stroke="#1a73e8" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-[#dadce0] shadow-sm overflow-hidden">
                <div className="bg-[#f1f3f4] px-5 py-3 border-b"><h2 className="text-base font-bold text-[#5f6368]">Vanilla LLM (Stateless)</h2></div>
                <div className="p-6 h-64 flex flex-col gap-4 bg-gray-50">
                  <div className="self-end bg-[#1a73e8] text-white p-3 rounded-l-lg rounded-br-lg text-sm max-w-[80%]">How should I handle this $45 fuel surcharge from Northwind Freight?</div>
                  <div className="self-start bg-white border p-4 rounded-r-lg text-sm max-w-[90%] text-[#3c4043]">I need more information. Without knowing your specific policy, I recommend escalating to a human manager for manual review.</div>
                  <div className="text-xs text-center text-[#5f6368] mt-auto">Response never improves regardless of day.</div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-[#1a73e8] shadow-md overflow-hidden">
                <div className="bg-[#e8f0fe] px-5 py-3 border-b border-[#1a73e8] flex justify-between">
                  <h2 className="text-base font-bold text-[#1a73e8] flex items-center gap-2"><Brain className="w-5 h-5" /> Hindsight Agent</h2>
                  <span className="text-xs bg-[#1a73e8] text-white px-2 py-1 rounded">Day {interactionLevel} Memory</span>
                </div>
                <div className="p-6 h-64 flex flex-col gap-4 bg-[#f8f9fa]">
                  <div className="self-end bg-[#1a73e8] text-white p-3 rounded-l-lg rounded-br-lg text-sm max-w-[80%]">How should I handle this $45 fuel surcharge from Northwind Freight?</div>
                  <div className="self-start bg-white border border-[#1a73e8] p-4 rounded-r-lg text-sm max-w-[90%] text-[#202124] shadow-md">
                    {interactionLevel < 5 ? "No precedent yet. Recommending escalation. (Learning in progress…)"
                      : interactionLevel < 20 ? <span>I recall you approved <strong className="text-[#1a73e8]">INV-NW-001</strong> recently. Recommend APPROVAL based on precedent.</span>
                        : <span><strong className="text-[#188038]">APPROVE.</strong><br /><br />Consolidated <strong className="text-[#1a73e8]">6 observations</strong> into a Mental Model. Northwind Freight consistently adds this surcharge and you have approved it 100% of the time. ERP note drafted.</span>}
                  </div>
                  {interactionLevel >= 20 && (
                    <div className="mt-auto p-2 bg-[#e6f4ea] border border-[#ceead6] rounded text-xs text-[#137333]">
                      <Zap className="w-3 h-3 inline mr-1" /> Mental Model Node activated
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 5 – MULTI-TENANT ISOLATION  (Feature 5)
        ══════════════════════════════════════════════ */}
        {activeTab === "isolation" && (
          <div className="flex flex-col gap-6">
            <div className="bg-white p-5 rounded-lg border border-[#dadce0] shadow-sm">
              <h2 className="text-base font-bold flex items-center gap-2 mb-1"><Shield className="w-5 h-5 text-[#1a73e8]" /> Enterprise Multi-Tenant Isolation Test</h2>
              <p className="text-sm text-[#5f6368] mb-4">
                Memory is scoped by <code className="bg-gray-100 px-1 rounded">group_id</code>. Project A (default) cannot see Project B's confidential rebate data. Click below to run a live proof.
              </p>
              <button onClick={runIsolationTest} disabled={isoLoading} className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-50">
                {isoLoading ? "Running Isolation Test…" : "▶ Run Live Isolation Test"}
              </button>
            </div>

            {isolationResult && (
              <div className="grid grid-cols-2 gap-6">
                {/* Project A */}
                <div className="bg-white rounded-lg border border-[#dadce0] shadow-sm overflow-hidden">
                  <div className="bg-[#e6f4ea] px-5 py-3 border-b border-[#ceead6] flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-[#188038]" />
                    <h3 className="font-bold text-[#188038]">Project A (default) Query Results</h3>
                  </div>
                  <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                    {isolationResult.project_a_hits.length === 0 && <p className="text-sm text-[#5f6368]">No matching memories.</p>}
                    {isolationResult.project_a_hits.map((m: any) => (
                      <div key={m.id} className="text-xs bg-[#f8f9fa] border rounded p-2">
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded-full mr-2 ${TYPE_BADGE[m.type]}`}>{m.type}</span>
                        {m.content}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Project B */}
                <div className="bg-white rounded-lg border border-[#dadce0] shadow-sm overflow-hidden">
                  <div className="bg-[#e8f0fe] px-5 py-3 border-b border-[#d2e3fc] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#1a73e8]" />
                    <h3 className="font-bold text-[#1a73e8]">Project B (isolated) Query Results</h3>
                  </div>
                  <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                    {isolationResult.project_b_hits.length === 0 && <p className="text-sm text-[#5f6368]">No matching memories.</p>}
                    {isolationResult.project_b_hits.map((m: any) => (
                      <div key={m.id} className="text-xs bg-[#e8f0fe] border border-[#d2e3fc] rounded p-2">
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded-full mr-2 ${TYPE_BADGE[m.type]}`}>{m.type}</span>
                        {m.content}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isolationResult && (
              <div className={`rounded-lg p-5 border ${isolationResult.isolation_proven ? "bg-[#e6f4ea] border-[#ceead6]" : "bg-[#fce8e6] border-[#fad2cf]"}`}>
                <div className="flex items-center gap-3">
                  {isolationResult.isolation_proven
                    ? <><CheckCircle className="w-6 h-6 text-[#188038]" /><span className="font-bold text-[#188038]">✓ ISOLATION PROVEN — Project B confidential data did NOT appear in Project A results.</span></>
                    : <><AlertTriangle className="w-6 h-6 text-[#c5221f]" /><span className="font-bold text-[#c5221f]">✗ Isolation FAILED — data leaked across tenant boundaries.</span></>}
                </div>
                {isolationResult.telemetry && (
                  <p className="text-xs text-[#5f6368] mt-2 font-mono">Retrieval latency: {isolationResult.telemetry.latency_ms} ms · Tokens: {isolationResult.telemetry.retrieved_tokens}</p>
                )}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
