"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Difficulty, Language } from "@codepad/shared";
import { Search, Filter, Code2, Brain, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function QuestionBank() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");

  useEffect(() => {
    async function loadQuestions() {
      try {
        setIsLoading(true);
        const filters: any = {};
        if (search) filters.search = search;
        if (difficulty !== "all") filters.difficulty = difficulty;
        
        const response = await api.listQuestions(filters);
        if (response.success && response.data) {
          setQuestions(response.data);
        }
      } catch (err) {
        console.error("Failed to load questions:", err);
      } finally {
        setIsLoading(false);
      }
    }

    const timer = setTimeout(loadQuestions, 300);
    return () => clearTimeout(timer);
  }, [search, difficulty]);

  return (
    <div className="flex flex-col h-full gap-6 p-1">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm"
          />
        </div>
        
        <div className="flex gap-2">
          {["all", Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d as any)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all",
                difficulty === d
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Question List */}
      <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
              ))
            ) : questions.length > 0 ? (
              questions.map((q, i) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.05] hover:border-primary/30 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center border",
                        q.difficulty === "easy" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                        q.difficulty === "medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                        "bg-red-500/10 border-red-500/20 text-red-500"
                      )}>
                        <Brain className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-slate-200 group-hover:text-primary transition-colors">{q.title}</h3>
                    </div>
                    <div className="flex gap-2">
                      {q.tags.slice(0, 2).map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold text-slate-500 uppercase">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-400 line-clamp-2 mb-4">{q.description}</p>
                  
                  <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Code2 className="h-3 w-3" />
                      {q.language}
                    </div>
                    {q.timeLimitMinutes && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <Clock className="h-3 w-3" />
                        {q.timeLimitMinutes}m
                      </div>
                    )}
                    <button className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-blue-400 transition-colors">
                      View Details
                      <Zap className="h-3 w-3 fill-current" />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                <Code2 className="h-12 w-12 mb-4 text-slate-600" />
                <p className="font-medium text-slate-400">No questions found</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
