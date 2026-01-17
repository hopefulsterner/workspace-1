// Speech Services - Voice Input (Speech-to-Text) and Voice Output (Text-to-Speech)

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface VoiceInputCallbacks {
  onResult: (result: SpeechRecognitionResult) => void;
  onError: (error: Error) => void;
  onEnd: () => void;
  onStart?: () => void;
}

// Check browser support
export const speechSupport = {
  recognition: typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  synthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
};

// ============ SPEECH-TO-TEXT (Voice Input) ============
let recognitionInstance: any = null;
let isListening = false;

export const voiceInput = {
  isSupported: (): boolean => speechSupport.recognition,
  
  isListening: (): boolean => isListening,

  start: (callbacks: VoiceInputCallbacks, options?: {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
  }): void => {
    if (!speechSupport.recognition) {
      callbacks.onError(new Error('Speech recognition not supported in this browser'));
      return;
    }

    // Stop existing recognition
    if (recognitionInstance) {
      recognitionInstance.stop();
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionInstance = new SpeechRecognition();

    // Configure
    recognitionInstance.lang = options?.language || 'en-US';
    recognitionInstance.continuous = options?.continuous ?? false;
    recognitionInstance.interimResults = options?.interimResults ?? true;
    recognitionInstance.maxAlternatives = 1;

    // Event handlers
    recognitionInstance.onstart = () => {
      isListening = true;
      callbacks.onStart?.();
      console.log('🎤 Voice input started');
    };

    recognitionInstance.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      callbacks.onResult({
        transcript,
        confidence,
        isFinal,
      });

      if (isFinal) {
        console.log(`🎤 Final: "${transcript}" (${Math.round(confidence * 100)}% confidence)`);
      }
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('🎤 Voice input error:', event.error);
      callbacks.onError(new Error(event.error));
    };

    recognitionInstance.onend = () => {
      isListening = false;
      callbacks.onEnd();
      console.log('🎤 Voice input ended');
    };

    // Start listening
    recognitionInstance.start();
  },

  stop: (): void => {
    if (recognitionInstance && isListening) {
      recognitionInstance.stop();
      isListening = false;
    }
  },

  // One-shot voice input - returns promise with final transcript
  listen: (options?: { language?: string; timeout?: number }): Promise<string> => {
    return new Promise((resolve, reject) => {
      let finalTranscript = '';
      const timeout = options?.timeout || 10000;

      const timeoutId = setTimeout(() => {
        voiceInput.stop();
        if (finalTranscript) {
          resolve(finalTranscript);
        } else {
          reject(new Error('Voice input timeout'));
        }
      }, timeout);

      voiceInput.start({
        onResult: (result) => {
          if (result.isFinal) {
            finalTranscript = result.transcript;
            clearTimeout(timeoutId);
            voiceInput.stop();
            resolve(finalTranscript);
          }
        },
        onError: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        onEnd: () => {
          clearTimeout(timeoutId);
          if (finalTranscript) {
            resolve(finalTranscript);
          }
        },
      }, {
        language: options?.language,
        continuous: false,
        interimResults: true,
      });
    });
  },
};

// ============ TEXT-TO-SPEECH (Voice Output) ============
let currentUtterance: SpeechSynthesisUtterance | null = null;
let isSpeaking = false;

export const voiceOutput = {
  isSupported: (): boolean => speechSupport.synthesis,
  
  isSpeaking: (): boolean => isSpeaking,

  // Get available voices
  getVoices: (): SpeechSynthesisVoice[] => {
    if (!speechSupport.synthesis) return [];
    return window.speechSynthesis.getVoices();
  },

  // Wait for voices to load
  waitForVoices: (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }

      window.speechSynthesis.onvoiceschanged = () => {
        resolve(window.speechSynthesis.getVoices());
      };

      // Fallback timeout
      setTimeout(() => {
        resolve(window.speechSynthesis.getVoices());
      }, 1000);
    });
  },

  // Speak text
  speak: (text: string, options?: {
    voice?: SpeechSynthesisVoice;
    voiceName?: string;
    rate?: number;      // 0.1 to 10, default 1
    pitch?: number;     // 0 to 2, default 1
    volume?: number;    // 0 to 1, default 1
    language?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
  }): void => {
    if (!speechSupport.synthesis) {
      options?.onError?.(new Error('Speech synthesis not supported'));
      return;
    }

    // Stop current speech
    voiceOutput.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    // Set voice
    if (options?.voice) {
      utterance.voice = options.voice;
    } else if (options?.voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.name.includes(options.voiceName!));
      if (voice) utterance.voice = voice;
    }

    // Set options
    utterance.rate = options?.rate ?? 1;
    utterance.pitch = options?.pitch ?? 1;
    utterance.volume = options?.volume ?? 1;
    if (options?.language) utterance.lang = options.language;

    // Event handlers
    utterance.onstart = () => {
      isSpeaking = true;
      options?.onStart?.();
      console.log('🔊 Speaking started');
    };

    utterance.onend = () => {
      isSpeaking = false;
      currentUtterance = null;
      options?.onEnd?.();
      console.log('🔊 Speaking ended');
    };

    utterance.onerror = (event) => {
      isSpeaking = false;
      currentUtterance = null;
      options?.onError?.(new Error(event.error));
      console.error('🔊 Speech error:', event.error);
    };

    // Speak
    window.speechSynthesis.speak(utterance);
  },

  // Speak and wait for completion
  speakAsync: (text: string, options?: {
    voice?: SpeechSynthesisVoice;
    voiceName?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    language?: string;
  }): Promise<void> => {
    return new Promise((resolve, reject) => {
      voiceOutput.speak(text, {
        ...options,
        onEnd: () => resolve(),
        onError: (error) => reject(error),
      });
    });
  },

  // Stop speaking
  stop: (): void => {
    if (speechSupport.synthesis) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      currentUtterance = null;
    }
  },

  // Pause speaking
  pause: (): void => {
    if (speechSupport.synthesis && isSpeaking) {
      window.speechSynthesis.pause();
    }
  },

  // Resume speaking
  resume: (): void => {
    if (speechSupport.synthesis) {
      window.speechSynthesis.resume();
    }
  },
};

// ============ VOICE CONVERSATION ============
// Helper for voice-based chat interactions
export const voiceConversation = {
  // Listen, process with callback, then speak response
  interact: async (
    processInput: (input: string) => Promise<string>,
    options?: {
      language?: string;
      speakResponse?: boolean;
      voiceName?: string;
    }
  ): Promise<{ input: string; response: string }> => {
    // Listen for user input
    console.log('🎤 Listening...');
    const input = await voiceInput.listen({ language: options?.language });
    console.log(`🎤 Heard: "${input}"`);

    // Process input
    console.log('🤔 Processing...');
    const response = await processInput(input);
    console.log(`💬 Response: "${response}"`);

    // Speak response if enabled
    if (options?.speakResponse !== false) {
      await voiceOutput.speakAsync(response, {
        voiceName: options?.voiceName,
        language: options?.language,
      });
    }

    return { input, response };
  },
};
