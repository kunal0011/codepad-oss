"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Star, Save, ClipboardList, MessageSquare, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CandidateEvaluationProps {
  sessionId: string;
  candidateId: string;
  onSuccess?: () => void;
}

const RUBRIC_DIMENSIONS = [
  { id: "problem-solving", label: "Problem Solving", description: "Logical approach and optimization" },
  { id: "code-quality", label: "Code Quality", description: "Readability, naming, and structure" },
  { id: "communication", label: "Communication", description: "Clarity of explanation" },
  { id: "technical-knowledge", label: "Technical Knowledge", description: "Language/framework expertise" },
];

export function CandidateEvaluation({ sessionId, candidateId, onSuccess }: CandidateEvaluationProps) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (Object.keys(scores).length < RUBRIC_DIMENSIONS.length) {
      setError("Please provide a score for all dimensions");
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);
      
      const rubricScores = Object.entries(scores).map(([dimension, score]) => ({
        dimension,
        score,
      }));

      const overallScore = Math.round(
        rubricScores.reduce((acc, curr) => acc + curr.score, 0) / rubricScores.length
      );

      const response = await api.createEvaluation({
        sessionId,
        candidateId,
        rubricScores,
        notes,
        overallScore,
      });

      if (response.success) {
        setSuccess(true);
        onSuccess?.();
      } else {
        setError(response.error?.message || "Failed to save evaluation");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsExecuting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full">
        <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
          <Star className="h-8 w-8 text-emerald-500 fill-current" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Evaluation Saved</h3>
        <p className="text-slate-400 text-sm">Your feedback has been successfully submitted.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white leading-tight">Candidate Evaluation</h2>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Interviewer Notes</p>
          </div>
        </div>

        {/* Rubric */}
        <div className="space-y-6">
          {RUBRIC_DIMENSIONS.map((dim) => (
            <div key={dim.id} className="space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="text-sm font-bold text-slate-200">{dim.label}</h4>
                  <p className="text-[10px] text-slate-500">{dim.description}</p>
                </div>
                <span className="text-xs font-mono font-bold text-primary">{scores[dim.id] || 0}/5</span>
              </div>
              
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setScores({ ...scores, [dim.id]: rating })}
                    className={cn(
                      "flex-1 h-10 rounded-lg border transition-all flex items-center justify-center",
                      scores[dim.id] === rating
                        ? "bg-primary border-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                        : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10 hover:text-slate-300"
                    )}
                  >
                    <Star className={cn("h-4 w-4", scores[dim.id] === rating && "fill-current")} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 text-slate-400">
            <MessageSquare className="h-4 w-4" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-[10px]">Private Notes</h4>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detailed observations about the candidate..."
            className="w-full h-32 rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-slate-200 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all resize-none"
          />
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-500"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-xs font-medium leading-relaxed">{error}</p>
          </motion.div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-6 bg-white/5 backdrop-blur-xl border-t border-white/10 mt-auto">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="group w-full h-12 rounded-xl bg-primary flex items-center justify-center gap-2 font-bold text-white shadow-xl hover:bg-blue-500 hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Submit Scorecard</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
