/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { jsPDF } from 'jspdf';
import { 
  Plus, 
  FileText, 
  Download, 
  Trash2, 
  Camera, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Brain,
  Menu,
  X,
  CreditCard,
  History,
  LayoutGrid,
  Calculator,
  Type,
  Box,
  Ruler,
  Copy,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface ScannedPage {
  id: string;
  url: string;
  file: File;
}

type ToolMode = 'pdf' | 'sum' | 'text' | 'count' | 'measure';

const aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const getAI = () => {
  return aiInstance;
};

export default function App() {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolMode>('pdf');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysis);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const shareResults = async () => {
    if (!analysis) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `ScanMaster Pro - ${currentTool.toUpperCase()} Results`,
          text: analysis,
        });
      } else {
        copyToClipboard();
      }
    } catch (err) {
      console.error('Error sharing', err);
    }
  };
  const [usageCount, setUsageCount] = useState<number>(() => {
    const saved = localStorage.getItem('scan_usage_count');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isPro, setIsPro] = useState<boolean>(() => {
    return localStorage.getItem('is_pro_member') === 'true';
  });
  const [showPaywall, setShowPaywall] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePayment = async (plan: 'monthly' | 'yearly') => {
    const amount = plan === 'monthly' ? 49900 : 399900; // in paise (e.g., ₹499 and ₹3999)
    const currency = 'INR';
    const razorpayKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;

    if (!razorpayKey) {
      setError("Payment gateway not configured. Please add VITE_RAZORPAY_KEY_ID to environment variables.");
      return;
    }

    setIsProcessingPayment(true);

    const options = {
      key: razorpayKey,
      amount: amount,
      currency: currency,
      name: "ScanMaster Pro",
      description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Subscription`,
      handler: function (response: any) {
        if (response.razorpay_payment_id) {
          setIsPro(true);
          setShowPaywall(false);
          setError(null);
        }
      },
      prefill: {
        name: "User",
        email: "user@example.com",
      },
      theme: {
        color: "#6366f1",
      },
      modal: {
        ondismiss: function() {
          setIsProcessingPayment(false);
        }
      }
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Razorpay load error:", err);
      setError("Failed to initialize payment. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('scan_usage_count', usageCount.toString());
  }, [usageCount]);

  useEffect(() => {
    localStorage.setItem('is_pro_member', isPro.toString());
  }, [isPro]);

  const checkAccess = () => {
    if (!isPro && usageCount >= 3) {
      setShowPaywall(true);
      return false;
    }
    return true;
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!checkAccess()) return;

    const files = e.target.files;
    if (!files) return;

    const newPages: ScannedPage[] = [];
    Array.from(files).forEach((file: File) => {
      if (file.type.startsWith('image/')) {
        newPages.push({
          id: Math.random().toString(36).substr(2, 9),
          url: URL.createObjectURL(file),
          file: file,
        });
      }
    });

    setPages((prev) => [...prev, ...newPages]);
    setUsageCount(prev => prev + 1);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const removePage = (id: string) => {
    setPages((prev) => {
      const pageToRemove = prev.find(p => p.id === id);
      if (pageToRemove) URL.revokeObjectURL(pageToRemove.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const generatePDF = async () => {
    if (pages.length === 0) return;
    if (!checkAccess()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const pdf = new jsPDF();
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const img = await loadImage(page.url);
        
        const imgWidth = img.width;
        const imgHeight = img.height;
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const width = imgWidth * ratio;
        const height = imgHeight * ratio;
        const x = (pdfWidth - width) / 2;
        const y = (pdfHeight - height) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', x, y, width, height);
      }

      pdf.save(`scan_${new Date().getTime()}.pdf`);
      setUsageCount(prev => prev + 1);
    } catch (err) {
      console.error(err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const runAITool = async (mode: ToolMode) => {
    if (pages.length === 0) return;
    if (!checkAccess()) return;
    
    setIsAnalyzing(true);
    setAnalysis(null);
    setError(null);

    try {
      const firstPage = pages[0];
      const base64Data = await fileToBase64(firstPage.file);
      const base64String = base64Data.split(',')[1];

      const prompts: Record<ToolMode, string> = {
        pdf: "Analyze this document image. Identify the document type, extract the title, and provide a 3-sentence executive summary.",
        sum: "Precision Summation: Extract every single numeric value or price from this image. Show a detailed list of items found and calculate the absolute total sum at the bottom. Return in a clean table format.",
        text: "Professional OCR: Extract ALL text from this image exactly as it appears. Preserve the structural alignment of the document. Distinguish between heading, sub-headings, and body paragraphs. If there are tables, represent them as Markdown tables.",
        count: "Inventory Audit: Identify, categorize, and count every distinct object in this image. List them with their corresponding quantities. Note any visible labels or distinguishing features for each group.",
        measure: "Precision Measurement Calculation: Estimate the length, width, and height of the main objects in this image using standard units (cm, inches, feet). Additionally, calculate the approximate surface area and volume where applicable. Use visible reference objects (like a hand, phone, or credit card) to calibrate the scale."
      };

      const ai = getAI();
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompts[mode] },
              {
                inlineData: {
                  mimeType: firstPage.file.type,
                  data: base64String
                }
              }
            ]
          }
        ],
      });

      setAnalysis(result.text || "No results found.");
      setUsageCount(prev => prev + 1);
    } catch (err) {
      console.error(err);
      setError('AI Tool failed. Check your connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  return (
    <div className="min-h-screen font-sans text-slate-50 pb-32 relative overflow-x-hidden">
      <div className="mesh-bg" />
      
      {/* Side Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] glass border-r border-white/10 z-[70] p-6 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="frosted-gradient p-2 rounded-xl">
                    <FileText className="text-white w-5 h-5" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">Master</h1>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 pl-2">Vision Tools</p>
                  <div className="space-y-2">
                    {[
                      { id: 'pdf', label: 'PDF Scanner', icon: LayoutGrid },
                      { id: 'sum', label: 'Auto Sum', icon: Calculator },
                      { id: 'text', label: 'OCR Text', icon: Type },
                      { id: 'count', label: 'Object Count', icon: Box },
                      { id: 'measure', label: 'Measure', icon: Ruler },
                    ].map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => { setCurrentTool(tool.id as ToolMode); setIsMenuOpen(false); }}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${
                          currentTool === tool.id 
                          ? 'frosted-gradient text-white shadow-lg' 
                          : 'text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        <tool.icon className="w-5 h-5" />
                        <span className="font-bold text-sm tracking-tight">{tool.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 pl-2">Account</p>
                  <div className="space-y-2">
                    <button 
                      onClick={() => { setShowPaywall(true); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-slate-400 hover:bg-white/5"
                    >
                      <CreditCard className="w-5 h-5" />
                      <span className="font-bold text-sm">Subscription</span>
                    </button>
                    <button className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-slate-400 hover:bg-white/5 opacity-50 cursor-not-allowed">
                      <History className="w-5 h-5" />
                      <span className="font-bold text-sm">History</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-8 left-6 right-6">
                <div className="glass border border-white/10 p-4 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400">FREE USAGE</span>
                    <span className="text-[10px] font-bold text-indigo-400">{Math.max(0, 3 - usageCount)} / 3</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full frosted-gradient" 
                      style={{ width: `${(Math.min(usageCount, 3) / 3) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 -ml-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">
              {currentTool === 'pdf' && 'Scanner'}
              {currentTool === 'sum' && 'AutoSum'}
              {currentTool === 'text' && 'OCR'}
              {currentTool === 'count' && 'Counter'}
              {currentTool === 'measure' && 'Measure'}
            </h1>
          </div>
        </div>
        {!isPro && (
          <div className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-md border border-white/10 text-indigo-300">
            {Math.max(0, 3 - usageCount)} FREE LEFT
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        {/* Tool Selector Removed from main content */}

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-6 p-4 glass border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-300 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {pages.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-10 text-center"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 glass border border-white/10">
              <Camera className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ready to {currentTool === 'pdf' ? 'scan' : 'analyze'}</h2>
            <p className="text-slate-400 mb-8 max-w-[280px]">
              {currentTool === 'pdf' && 'Convert your images to searchable PDFs'}
              {currentTool === 'sum' && 'Capture receipts and total them automatically'}
              {currentTool === 'text' && 'Extract text from any document instantly'}
              {currentTool === 'count' && 'AI will identify and count items in view'}
              {currentTool === 'measure' && 'Estimate dimensions of objects using AI'}
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-3 frosted-gradient text-white py-4 px-8 rounded-2xl font-bold text-lg active:scale-95 transition-transform shadow-indigo-500/20 shadow-xl"
              >
                <Camera className="w-6 h-6" />
                Capture Photo
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-3 glass text-white border border-white/10 py-4 px-8 rounded-2xl font-bold text-lg active:scale-95 transition-transform"
              >
                <ImageIcon className="w-6 h-6" />
                Upload Image
              </button>
            </div>
          </motion.div>
        )}

        {/* Page Grid / Preview */}
        {pages.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence>
                {pages.map((page, index) => (
                  <motion.div 
                    key={page.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="relative group aspect-[3/4] glass-card rounded-2xl overflow-hidden shadow-xl"
                  >
                    <img 
                      src={page.url} 
                      alt={`Page ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-mono border border-white/10">
                      PAGE {index + 1}
                    </div>
                    <button 
                      onClick={() => removePage(page.id)}
                      className="absolute top-2 right-2 bg-red-500/80 text-white p-1.5 rounded-full transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              <motion.button 
                layout
                onClick={() => cameraInputRef.current?.click()}
                className="aspect-[3/4] border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors glass bg-white/2"
              >
                <Plus className="w-8 h-8 mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider">Add More</span>
              </motion.button>
            </div>

            {/* AI Result Card */}
            <div className="group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  {currentTool === 'pdf' ? 'Document Intelligence' : 'AI Analysis'}
                </h3>
                <button 
                  onClick={() => runAITool(currentTool)}
                  disabled={isAnalyzing}
                  className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  {isAnalyzing ? 'Analyzing...' : `Run ${currentTool}`}
                </button>
              </div>
              
              <div className={`p-6 rounded-3xl ${analysis ? 'glass border-indigo-500/30' : 'glass border-white/10 text-slate-400'} transition-all duration-500 shadow-2xl min-h-[100px]`}>
                {isAnalyzing ? (
                  <div className="flex flex-col items-center py-8">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
                    <p className="text-sm font-medium animate-pulse">Processing vision data...</p>
                  </div>
                ) : analysis ? (
                  <div className="relative">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase">Intelligent Result</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={copyToClipboard}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                          title="Copy to clipboard"
                        >
                          {isCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={shareResults}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                          title="Share results"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium markdown-body">
                      {analysis}
                    </div>
                    {isCopied && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg"
                      >
                        COPIED!
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs italic leading-relaxed">
                      Tap the tool above to analyze your capture.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Paywall Modal */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-6"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="bg-[#1e1b4b] glass w-full max-w-sm rounded-[40px] p-8 border border-white/10 relative overflow-hidden"
            >
              <button 
                onClick={() => setShowPaywall(false)}
                className="absolute top-6 right-6 text-slate-500 hover:text-white"
              >
                ✕
              </button>
              <div className="text-center">
                <div className="w-16 h-16 frosted-gradient rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-6 shadow-indigo-500/40 shadow-2xl">
                  <Plus className="text-white w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black text-white mb-2 leading-none uppercase tracking-tighter">Go Master</h2>
                <p className="text-slate-400 text-sm mb-8">Unlimited scans, auto-summing, object counting, and precise AI measurements.</p>
                
                <div className="space-y-4 mb-8">
                  <button 
                    onClick={() => handlePayment('yearly')}
                    disabled={isProcessingPayment}
                    className="w-full bg-white text-indigo-900 py-4 rounded-2xl font-black text-lg hover:bg-slate-100 transition-colors flex justify-between px-6 disabled:opacity-50"
                  >
                    <span>{isProcessingPayment ? 'Processing...' : 'Yearly'}</span>
                    <span>₹3,999/yr</span>
                  </button>
                  <button 
                    onClick={() => handlePayment('monthly')}
                    disabled={isProcessingPayment}
                    className="w-full glass border border-white/20 text-white py-4 rounded-2xl font-black text-lg hover:bg-white/5 transition-colors flex justify-between px-6 disabled:opacity-50"
                  >
                    <span>{isProcessingPayment ? 'Processing...' : 'Monthly'}</span>
                    <span>₹499/mo</span>
                  </button>
                </div>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em]">Start your 7-day free trial</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        multiple 
        accept="image/png, image/jpeg, image/gif"
        className="hidden"
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        onChange={handleFileUpload} 
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Bottom Actions */}
      {pages.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 glass border border-white/10 p-2 rounded-3xl shadow-2xl z-50">
          <button 
            onClick={() => cameraInputRef.current?.click()}
            className="bg-white/5 text-indigo-400 p-4 rounded-2xl hover:bg-white/10 transition-colors"
          >
            <Camera className="w-6 h-6" />
          </button>
          {currentTool === 'pdf' && (
            <button 
              onClick={generatePDF}
              disabled={isGenerating}
              className="frosted-gradient text-white px-8 h-14 rounded-2xl font-bold flex items-center gap-2 active:scale-95 transition-transform"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Download className="w-5 h-5" />}
              Finish PDF
            </button>
          )}
          {currentTool !== 'pdf' && (
            <button 
              onClick={() => runAITool(currentTool)}
              disabled={isAnalyzing}
              className="frosted-gradient text-white px-8 h-14 rounded-2xl font-bold flex items-center gap-2 active:scale-95 transition-transform"
            >
              {isAnalyzing ? <Loader2 className="animate-spin" /> : <Plus className="w-5 h-5 font-bold" />}
              Run {currentTool}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
