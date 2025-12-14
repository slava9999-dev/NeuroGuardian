// ============================================
// NeuroGUARDIAN — Sound Effects Module
// Cash register and alert sounds
// ============================================

// Sound URLs (using reliable CDN sources)
const SOUNDS = {
  // Cash register "Cha-Ching" - for money saved
  cashRegister: 'https://www.myinstants.com/media/sounds/ka-ching.mp3',
  
  // Alert/Alarm - for stop-loss triggered (using siren/alert sound)
  alert: 'https://www.myinstants.com/media/sounds/mlg-airhorn.mp3',
  
  // Success notification
  success: 'https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-55112/zapsplat_multimedia_ui_chime_pop_positive_55501.mp3',
  
  // Warning/Attention
  warning: 'https://www.myinstants.com/media/sounds/windows-warning.mp3',
};

// Audio instances cache for better performance
let audioInstances: Map<string, HTMLAudioElement> = new Map();

/**
 * Preload audio files for faster playback
 */
export function preloadSounds() {
  Object.entries(SOUNDS).forEach(([key, url]) => {
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.load();
      audioInstances.set(key, audio);
    } catch (e) {
      console.warn(`Failed to preload sound: ${key}`, e);
    }
  });
}

/**
 * Play a sound with optional volume control
 */
function playSound(soundKey: keyof typeof SOUNDS, volume: number = 0.5): Promise<void> {
  return new Promise((resolve) => {
    try {
      // Try to use cached instance or create new
      let audio = audioInstances.get(soundKey);
      
      if (!audio || audio.error) {
        audio = new Audio(SOUNDS[soundKey]);
        audioInstances.set(soundKey, audio);
      }
      
      // Reset to beginning if already playing
      audio.currentTime = 0;
      audio.volume = Math.min(1, Math.max(0, volume));
      
      audio.play()
        .then(resolve)
        .catch((e) => {
          // Auto-play policies might block this if no user interaction
          console.log('🔇 Audio autoplay blocked:', e.message);
          resolve();
        });
    } catch (e) {
      console.error('Sound playback error:', e);
      resolve();
    }
  });
}

/**
 * 💰 Play cash register sound - for money saved
 * Called when savedAmount increases (stop-loss successfully protected margin)
 */
export function playCashSound(): void {
  playSound('cashRegister', 0.4);
}

/**
 * 🚨 Play alert sound - for stop-loss TRIGGERED
 * Called when price drops below minimum and defense action is executed
 */
export function playAlertSound(): void {
  playSound('warning', 0.3);
}

/**
 * ✅ Play success sound - for positive actions completed
 */
export function playSuccessSound(): void {
  playSound('success', 0.3);
}

/**
 * 🔊 Check if browser can play audio
 */
export function canPlayAudio(): boolean {
  try {
    const audio = new Audio();
    return !!audio.canPlayType;
  } catch {
    return false;
  }
}

/**
 * 🧪 Test all sounds (for debugging)
 */
export function testAllSounds(): void {
  console.log('🔊 Testing sounds...');
  
  setTimeout(() => playCashSound(), 0);
  setTimeout(() => playAlertSound(), 1500);
  setTimeout(() => playSuccessSound(), 3000);
  
  console.log('✅ Sound test complete');
}

// Preload sounds on module load (in browser environment)
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadSounds);
  } else {
    preloadSounds();
  }
}
