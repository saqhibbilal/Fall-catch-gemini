"use client";

import { useState, useRef, DragEvent } from "react";
import { Upload, AlertCircle, CheckCircle, Video, XCircle, Loader2, Info } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Mocks result for Phase 2 UI testing. Will connect to API in Phase 4.
  const [result, setResult] = useState<{
    fallDetected: boolean;
    confidence: number;
    explanation: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selectedFile: File) => {
    setError(null);
    setResult(null);

    if (!selectedFile.type.startsWith("video/")) {
      setError("Please upload a valid video file (MP4, MOV, etc).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      // Validate up to 30.9 seconds to avoid strict float cutoff
      if (video.duration > 31) {
        setError("Video exceeds 30 seconds maximum. Please choose a shorter video.");
        setFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        window.URL.revokeObjectURL(url); // Revoke only on rejection
      } else {
        setFile(selectedFile);
        setPreviewUrl(url); // Keep URL alive for preview component
      }
    };
    // Failsafe in case onloadedmetadata fails
    video.onerror = () => {
      setError("Error parsing video format. Are you sure it's a valid video?");
    };
    video.src = url;
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("video", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze video");
      }

      setResult({
        fallDetected: data.fallDetected,
        confidence: data.confidence,
        explanation: data.explanation,
      });
    } catch (err: any) {
      setError(err.message || "An error occurred while analyzing the video.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center py-12 px-4 selection:bg-cyan-500/30">
      <div className="max-w-3xl w-full space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-cyan-900/30 rounded-2xl mb-2 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.15)] glow">
            <Video className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white via-cyan-100 to-cyan-500 bg-clip-text text-transparent pb-1">
            FallGuard AI
          </h1>
          <p className="text-neutral-400 max-w-xl mx-auto text-lg leading-relaxed">
            Upload a short video (up to 30s) and our AI will analyze whether an accidental fall has occurred.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-red-200">{error}</div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-8">
            {!previewUrl ? (
              /* Upload Zone */
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative group cursor-pointer flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed rounded-2xl transition-all duration-300
                  ${isDragging ? 'border-cyan-500 bg-cyan-500/5' : 'border-neutral-700 hover:border-cyan-500/50 hover:bg-neutral-800/50'}
                `}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="video/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/0 via-cyan-500/0 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

                <div className="p-4 bg-neutral-800 rounded-full mb-4 shadow-xl group-hover:scale-110 transition-transform duration-300 ring-4 ring-neutral-900">
                  <Upload className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Drag and drop your video</h3>
                <p className="text-neutral-400 text-center text-sm max-w-sm mb-4">
                  or click to browse from your computer. Valid formats: MP4, MOV, WebM.
                </p>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-cyan-400 bg-cyan-950/50 py-1.5 px-3 rounded-full">
                  <Info className="w-3.5 h-3.5" />
                  Maximum duration: 30 seconds
                </div>
              </div>
            ) : (
              /* Preview & Result Zone */
              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-neutral-300 flex items-center gap-2">
                    <Video className="w-4 h-4 text-cyan-400" />
                    Video Preview
                  </h3>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors p-1"
                  >
                    <XCircle className="w-4 h-4" />
                    Clear selection
                  </button>
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-xl aspect-video group">
                  <video
                    src={previewUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                  {!result && !loading && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <p className="text-white font-medium px-4 py-2 bg-black/60 rounded-lg backdrop-blur-sm">
                        Ready to analyze
                      </p>
                    </div>
                  )}
                </div>

                {/* Results Section */}
                {result && (
                  <div className={`p-6 rounded-2xl border ${result.fallDetected ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'} animate-in slide-in-from-bottom-4 duration-500 flex flex-col items-center text-center space-y-4`}>
                    <div className={`p-3 rounded-full ${result.fallDetected ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                      {result.fallDetected ? <XCircle className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold tracking-tight mb-1 text-white">
                        {result.fallDetected ? 'Fall Detected' : 'No Fall Detected'}
                      </h4>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 text-sm font-medium mb-4">
                        Confidence: <span className={`font-semibold ${result.fallDetected ? 'text-red-400' : 'text-emerald-400'}`}>{result.confidence}%</span>
                      </div>
                      <p className="text-neutral-300 max-w-lg mx-auto leading-relaxed">
                        {result.explanation}
                      </p>
                    </div>
                  </div>
                )}

                {/* Analysis Action */}
                {!result && (
                  <div className="pt-2">
                    <button
                      onClick={handleAnalyze}
                      disabled={loading}
                      className="w-full relative group overflow-hidden rounded-2xl bg-cyan-600 text-white font-bold py-4 px-6 transition-all duration-300 hover:bg-cyan-500 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full -translate-x-full transition-transform duration-700 ease-in-out" />
                      {loading ? (
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Analyzing Video with AI...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg">Analyze Video</span>
                        </div>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
