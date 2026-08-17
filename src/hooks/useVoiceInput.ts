/**
 * useVoiceInput — Reusable hook for browser Web Speech API (SpeechRecognition)
 *
 * Returns:
 *  - isListening: boolean
 *  - isSupported: boolean  (false on Firefox / older browsers)
 *  - transcript: string   (last recognised text, continuously appended)
 *  - startListening(lang?): void
 *  - stopListening(): void
 *  - resetTranscript(): void
 *  - error: string | null
 */

import { useState, useRef, useCallback } from 'react';

interface UseVoiceInputOptions {
  lang?: string;           // BCP-47 language tag, default 'en-IN'
  continuous?: boolean;    // keep recording until stopped, default true
  interimResults?: boolean;// show partial results, default true
  onResult?: (text: string) => void;   // called on each final segment
  onEnd?: () => void;      // called when recognition ends
}

export interface VoiceInputControls {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimText: string;
  error: string | null;
  startListening: (lang?: string) => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// Browser shim — vendor-prefixed where needed
const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function useVoiceInput(options: UseVoiceInputOptions = {}): VoiceInputControls {
  const {
    lang = 'en-IN',
    continuous = true,
    interimResults = true,
    onResult,
    onEnd,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const finalTextRef = useRef(''); // accumulate final segments

  const isSupported = Boolean(SpeechRecognition);

  const startListening = useCallback(
    (overrideLang?: string) => {
      if (!isSupported) {
        setError('Voice input is not supported in this browser. Please use Chrome or Edge.');
        return;
      }
      if (isListening) return;

      setError(null);
      setInterimText('');
      finalTextRef.current = transcript; // continue from existing text

      const recognition = new SpeechRecognition();
      recognition.lang = overrideLang || lang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = finalTextRef.current;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            // Add a space between chunks unless there's punctuation
            final = final ? `${final} ${chunk}` : chunk;
            finalTextRef.current = final;
            onResult?.(final);
          } else {
            interim += chunk;
          }
        }

        setTranscript(finalTextRef.current);
        setInterimText(interim);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          setError('No speech detected. Please speak clearly into your microphone.');
        } else if (event.error === 'audio-capture') {
          setError('Microphone not found. Please check your microphone connection.');
        } else if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone permission in your browser.');
        } else {
          setError(`Voice recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
        onEnd?.();
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [isSupported, isListening, lang, continuous, interimResults, transcript, onResult, onEnd]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText('');
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    finalTextRef.current = '';
    setTranscript('');
    setInterimText('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimText,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
