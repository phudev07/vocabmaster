/**
 * Speech Module - Text-to-Speech using Web Speech API
 */

const Speech = {
    synth: window.speechSynthesis,
    voices: [],
    selectedVoice: null,
    rate: 1.0,

    // Initialize and load voices
    init() {
        // Load voices
        this.loadVoices();
        
        // Chrome needs this event
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }

        // Load settings
        const settings = Storage.getSettings();
        this.rate = settings.voiceSpeed || 1.0;
    },

    loadVoices() {
        this.voices = this.synth.getVoices();
        
        // Get preferred voice from settings
        const settings = Storage.getSettings();
        const preferredType = settings.voiceType || 'US';
        
        this.selectVoice(preferredType);
    },

    selectVoice(type) {
        // Find English voices
        const englishVoices = this.voices.filter(v => 
            v.lang.startsWith('en')
        );

        if (type === 'UK') {
            // Prefer British English
            this.selectedVoice = englishVoices.find(v => 
                v.lang === 'en-GB' || v.name.includes('UK') || v.name.includes('British')
            ) || englishVoices[0];
        } else {
            // Prefer American English
            this.selectedVoice = englishVoices.find(v => 
                v.lang === 'en-US' || v.name.includes('US') || v.name.includes('American')
            ) || englishVoices[0];
        }

        // Fallback to any English voice
        if (!this.selectedVoice && englishVoices.length > 0) {
            this.selectedVoice = englishVoices[0];
        }
    },

    // Speak text
    speak(text, callback) {
        // Cancel any ongoing speech
        this.synth.cancel();

        if (!text) return;

        const utterance = new SpeechSynthesisUtterance(text);
        
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        
        utterance.rate = this.rate;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        if (callback) {
            utterance.onend = callback;
        }

        this.synth.speak(utterance);
    },

    // Stop speaking
    stop() {
        this.synth.cancel();
    },

    // Set speech rate
    setRate(rate) {
        this.rate = Math.max(0.5, Math.min(2.0, rate));
        Storage.saveSettings({ voiceSpeed: this.rate });
    },

    // Set voice type (US/UK)
    setVoiceType(type) {
        this.selectVoice(type);
        Storage.saveSettings({ voiceType: type });
    },

    // Get available English voices
    getAvailableVoices() {
        return this.voices.filter(v => v.lang.startsWith('en'));
    },

    // Check if speech is supported
    isSupported() {
        return 'speechSynthesis' in window;
    }
};
