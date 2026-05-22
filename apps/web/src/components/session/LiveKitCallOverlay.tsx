"use client";

import { useTracks, VideoTrack, useParticipantInfo } from "@livekit/components-react";
import { Track } from "livekit-client";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Maximize2, Minimize2, PhoneOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface LiveKitCallOverlayProps {
  onDisconnect: () => void;
}

export function LiveKitCallOverlay({ onDisconnect }: LiveKitCallOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Fetch active camera tracks, including placeholders for participants without cameras enabled
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false }
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-80 md:w-96 rounded-3xl overflow-hidden glass-panel-heavy p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 pointer-events-auto flex flex-col gap-3"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Live Pairing Call</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition-all"
                  title="Minimize"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onDisconnect}
                  className="rounded-lg p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
                  title="End Call"
                >
                  <PhoneOff className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Video Grid */}
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto no-scrollbar pr-0.5">
              {tracks.map((trackRef) => {
                const participant = trackRef.participant;
                const isLocal = participant.isLocal;
                const name = participant.name || participant.identity;
                const isSpeaking = participant.isSpeaking;
                const cameraEnabled = participant.isCameraEnabled;
                const micEnabled = participant.isMicrophoneEnabled;

                return (
                  <div
                    key={`${participant.sid}-${trackRef.source}`}
                    className="relative aspect-video rounded-2xl overflow-hidden bg-black/40 border border-white/5 shadow-inner group flex items-center justify-center"
                  >
                    {cameraEnabled && trackRef.publication ? (
                      <VideoTrack
                        trackRef={trackRef as any}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      // Beautiful placeholder when camera is off
                      <div className="flex flex-col items-center justify-center gap-2 text-center p-3 select-none">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary transition-all duration-300",
                            isSpeaking && "scale-110 shadow-[0_0_20px_rgba(59,130,246,0.4)] border-primary/40 bg-primary/20"
                          )}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                        {isSpeaking && (
                          <div className="flex items-center gap-0.5 mt-1 h-3 justify-center">
                            <span className="w-0.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <span className="w-0.5 h-3.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                            <span className="w-0.5 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom controls overlay */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <div className="rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white max-w-[70%] truncate">
                        {name} {isLocal && "(You)"}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={cn(
                          "rounded-md p-1",
                          micEnabled ? "bg-black/60 text-slate-300" : "bg-red-500/80 text-white shadow-lg"
                        )}>
                          {micEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating minimized trigger */}
      <AnimatePresence>
        {isMinimized && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full glass-panel-heavy border border-white/10 shadow-lg pointer-events-auto hover:bg-white/10 active:scale-95 transition-all text-slate-300 hover:text-white"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest">Pairing Call Active</span>
            <Maximize2 className="h-3.5 w-3.5 ml-1" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
