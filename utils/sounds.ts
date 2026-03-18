/**
 * SushiFlow — Utilitário de Sons
 * Usa a Web Audio API para gerar sons sem precisar de arquivos externos.
 */

const ctx = () => {
    try {
        return new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
        return null;
    }
};

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.3) {
    const audioCtx = ctx();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

/** Som de novo pedido chegando na cozinha (beep duplo ascendente) */
export function playNewOrderSound() {
    playTone(440, 0.15, 'square', 0.2);
    setTimeout(() => playTone(660, 0.2, 'square', 0.2), 180);
}

/** Som de item pronto para servir (acorde suave) */
export function playReadySound() {
    playTone(523, 0.2, 'sine', 0.25); // C5
    setTimeout(() => playTone(659, 0.2, 'sine', 0.2), 80);  // E5
    setTimeout(() => playTone(784, 0.35, 'sine', 0.2), 160); // G5
}

/** Som de erro / PIN incorreto */
export function playErrorSound() {
    playTone(200, 0.15, 'sawtooth', 0.2);
    setTimeout(() => playTone(150, 0.25, 'sawtooth', 0.15), 180);
}

/** Som de sucesso (pagamento confirmado) */
export function playSuccessSound() {
    [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.2, 'sine', 0.2), i * 90);
    });
}
