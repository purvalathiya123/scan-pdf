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
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface ScannedPage {
  id: string;
  url: string;
  file: File;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
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
    } catch (err) {
      console.error(err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const analyzeContext = async () => {
    if (pages.length === 0) return;
    
    setIsAnalyzing(true);
    setAnalysis(null);
    setError(null);

    try {
      // Analyze only the first page for brevity in demo
      const firstPage = pages[0];
      const base64Data = await fileToBase64(firstPage.file);
      const base64String = base64Data.split(',')[1];

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Analyze this scanned document image. Extract the main heading, summary of content, and any key dates or names found. Format it cleanly." },
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

      setAnalysis(result.text || "No analysis available.");
    } catch (err) {
      console.error(err);
      setError('AI Analysis failed. Check your API key or connection.');
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
    <div className="min-h-screen font-sans text-slate-50 pb-24 relative">
      <div className="mesh-bg" />
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="frosted-gradient p-2 rounded-xl">
            <FileText className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Scan2PDF</h1>
        </div>
        {pages.length > 0 && (
          <button 
            onClick={generatePDF}
            disabled={isGenerating}
            className="frosted-gradient disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all active:scale-95"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGenerating ? 'Saving...' : 'Save PDF'}
          </button>
        )}
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 text-sm"
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
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 glass border border-white/10">
              <Camera className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No scans yet</h2>
            <p className="text-slate-400 mb-8 max-w-[280px]">
              Upload a document or take a photo to start converting to PDF
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-3 frosted-gradient text-white py-4 px-8 rounded-2xl font-bold text-lg active:scale-95 transition-transform"
              >
                <Camera className="w-6 h-6" />
                Scan Document
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-3 glass text-white border border-white/10 py-4 px-8 rounded-2xl font-bold text-lg active:scale-95 transition-transform"
              >
                <ImageIcon className="w-6 h-6" />
                Photo Library
              </button>
            </div>
          </motion.div>
        )}

        {/* Page Grid */}
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
                  className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {pages.length > 0 && (
            <motion.button 
              layout
              onClick={() => cameraInputRef.current?.click()}
              className="aspect-[3/4] border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors glass bg-white/2"
            >
              <Plus className="w-8 h-8 mb-2" />
              <span className="text-xs font-bold uppercase tracking-wider">Add Page</span>
            </motion.button>
          )}
        </div>

        {/* AI Analysis Section */}
        {pages.length > 0 && (
          <div className="mt-12 group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Brain className="w-4 h-4" />
                AI Smart Scan
              </h3>
              {!analysis && (
                <button 
                  onClick={analyzeContext}
                  disabled={isAnalyzing}
                  className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Loader2 className="hidden" />}
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Page 1'}
                </button>
              )}
            </div>
            
            <div className={`p-6 rounded-3xl ${analysis ? 'glass border-indigo-500/30' : 'glass border-white/10 text-slate-400'} transition-all duration-500 shadow-2xl`}>
              {isAnalyzing ? (
                <div className="flex flex-col items-center py-8">
                  <div className="relative w-12 h-12 mb-4">
                    <div className="absolute inset-0 border-4 border-indigo-400/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-indigo-400 rounded-full animate-spin"></div>
                  </div>
                  <p className="text-sm font-medium animate-pulse">Reading document...</p>
                </div>
              ) : analysis ? (
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-widest text-indigo-300">INTELLIGENT EXTRACTION</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {analysis}
                  </div>
                  <button 
                    onClick={() => setAnalysis(null)}
                    className="mt-6 text-xs text-indigo-300 hover:text-white underline underline-offset-4"
                  >
                    Clear Analysis
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs italic leading-relaxed">
                    Select a page to extract text and summarize content using Gemini AI.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

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

      {/* Bottom Nav / Actions for Mobile */}
      {pages.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 glass border border-white/10 p-2 rounded-3xl shadow-2xl z-50">
          <button 
            onClick={() => cameraInputRef.current?.click()}
            className="bg-white/5 text-indigo-400 p-4 rounded-2xl hover:bg-white/10 transition-colors"
          >
            <Camera className="w-6 h-6" />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-white/5 text-indigo-400 p-4 rounded-2xl hover:bg-white/10 transition-colors"
          >
            <ImageIcon className="w-6 h-6" />
          </button>
          <div className="w-[1px] h-8 bg-white/10 mx-2" />
          <button 
            onClick={generatePDF}
            className="frosted-gradient text-white px-8 h-14 rounded-2xl font-bold flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Download className="w-5 h-5" />
            Finish PDF
          </button>
        </div>
      )}
    </div>
  );
}
