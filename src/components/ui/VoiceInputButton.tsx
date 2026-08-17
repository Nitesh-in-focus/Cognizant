/**
 * VoiceInputButton — Drop-in voice input button for NLP text areas.
 *
 * Usage:
 *   <VoiceInputButton
 *     onTranscriptChange={(text) => setNlpPrompt(text)}
 *     existingText={nlpPrompt}       // optional — appends to existing text
 *   />
 */

import React, { useEffect } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';

interface VoiceInputButtonProps {
  /** Called whenever voice transcript updates */
  onTranscriptChange: (text: string) => void;
  /** Existing text in the textarea — we append to it */
  existingText?: string;
  /** Optional hint label shown next to the button */
  label?: string;
  /** Compact (icon only) vs expanded mode */
  compact?: boolean;
  /** Language tag — default 'en-IN' */
  lang?: string;
  /** Extra class names for the outer wrapper */
  className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscriptChange,
  existingText = '',
  label,
  compact = false,
  lang = 'en-IN',
  className = '',
}) => {
  const {
    isListening,
    isSupported,
    transcript,
    interimText,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    lang,
    continuous: true,
    interimResults: true,
  });

  // Sync transcript → parent textarea
  useEffect(() => {
    if (!transcript) return;
    // Build new text: keep existing (pre-voice) + voice transcript
    const base = existingText.trimEnd();
    const combined = base ? `${base} ${transcript}` : transcript;
    onTranscriptChange(combined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  const handleToggle = () => {
    if (!isSupported) return;
    if (isListening) {
      stopListening();
    } else {
      // Reset prior transcript so we don't double-append on re-start
      resetTranscript();
      startListening(lang);
    }
  };

  if (!isSupported) {
    return (
      <div className={`flex items-center gap-1.5 text-slate-400 text-[10px] ${className}`} title="Voice input not supported in this browser">
        <MicOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Voice unavailable</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        {/* Main mic button */}
        <button
          type="button"
          onClick={handleToggle}
          title={isListening ? 'Stop recording' : 'Start voice input'}
          className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer select-none ${
            isListening
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/40 ring-2 ring-rose-400 ring-offset-1'
              : 'bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 hover:border-indigo-500 shadow-xs'
          }`}
        >
          {/* Pulsing ring when active */}
          {isListening && (
            <span className="absolute inset-0 rounded-xl animate-ping bg-rose-500 opacity-30 pointer-events-none" />
          )}

          {isListening ? (
            <MicOff className="w-3.5 h-3.5 relative z-10" />
          ) : (
            <Mic className="w-3.5 h-3.5 relative z-10" />
          )}

          {!compact && (
            <span className="relative z-10 whitespace-nowrap">
              {isListening ? 'Stop Recording' : label || 'Voice Input'}
            </span>
          )}

          {/* Live waveform dots */}
          {isListening && (
            <span className="relative z-10 flex items-end gap-0.5 h-4 ml-0.5">
              {[0.3, 0.6, 1, 0.6, 0.3].map((delay, i) => (
                <span
                  key={i}
                  className="w-0.5 bg-white rounded-full animate-bounce"
                  style={{
                    height: `${6 + i * 2}px`,
                    animationDelay: `${i * delay * 80}ms`,
                    animationDuration: '600ms',
                  }}
                />
              ))}
            </span>
          )}
        </button>

        {/* Status text */}
        {isListening && (
          <span className="flex items-center gap-1 text-[10px] text-rose-600 font-bold">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping inline-block" />
            Listening...
          </span>
        )}
      </div>

      {/* Interim transcript preview (greyed out, real-time) */}
      {isListening && interimText && (
        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 italic animate-pulse max-w-md">
          <span className="font-semibold not-italic text-amber-700">Hearing: </span>
          {interimText}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700 max-w-md">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
