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
        const preferredVoice = settings.selectedVoiceName;
        const preferredType = settings.voiceType || 'US';
        
        // If user has selected a specific voice, use that
        if (preferredVoice) {
            this.selectedVoice = this.voices.find(v => v.name === preferredVoice);
        }
        
        // Otherwise auto-select best voice
        if (!this.selectedVoice) {
            this.selectVoice(preferredType);
        }
        
        console.log('Loaded', this.voices.length, 'voices. Selected:', this.selectedVoice?.name);
    },

    selectVoice(type) {
        // Find English voices
        const englishVoices = this.voices.filter(v => 
            v.lang.startsWith('en')
        );
        
        // Priority list for better voices (ordered by quality)
        const priorityVoices = [
            // Google voices (usually good quality)
            'Google US English',
            'Google UK English Female',
            'Google UK English Male',
            // Microsoft Azure voices (high quality)
            'Microsoft Jenny Online',
            'Microsoft Guy Online',
            // Microsoft Edge voices
            'Microsoft David',
            'Microsoft Zira',
            'Microsoft Mark',
            // Apple voices
            'Samantha',
            'Daniel',
            'Karen',
            'Moira',
            'Alex'
        ];

        let candidates = [];
        
        if (type === 'UK') {
            // Prefer British English
            candidates = englishVoices.filter(v => 
                v.lang === 'en-GB' || v.name.includes('UK') || v.name.includes('British')
            );
        } else {
            // Prefer American English
            candidates = englishVoices.filter(v => 
                v.lang === 'en-US' || v.name.includes('US') || v.name.includes('American')
            );
        }
        
        // Try to find a priority voice among candidates
        for (const pv of priorityVoices) {
            this.selectedVoice = candidates.find(v => v.name.includes(pv));
            if (this.selectedVoice) return;
        }
        
        // Fallback to any matching voice
        if (candidates.length > 0) {
            this.selectedVoice = candidates[0];
            return;
        }

        // Try any priority voice
        for (const pv of priorityVoices) {
            this.selectedVoice = englishVoices.find(v => v.name.includes(pv));
            if (this.selectedVoice) return;
        }

        // Fallback to any English voice
        if (englishVoices.length > 0) {
            this.selectedVoice = englishVoices[0];
        }
    },

    // Speak text
    speak(text, callback) {
        // Cancel any ongoing speech
        this.synth.cancel();

        if (!text) return;

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Always set English language explicitly (important for Android!)
        utterance.lang = 'en-US';
        
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
            utterance.lang = this.selectedVoice.lang;
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

    // Set specific voice by name
    setVoice(voiceName) {
        const voice = this.voices.find(v => v.name === voiceName);
        if (voice) {
            this.selectedVoice = voice;
            Storage.saveSettings({ selectedVoiceName: voiceName });
        }
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
