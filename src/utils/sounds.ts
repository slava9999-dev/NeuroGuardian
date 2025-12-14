// Cash register "Cha-Ching" sound
const CASH_SOUND_URL = 'https://www.myinstants.com/media/sounds/ka-ching.mp3';

export function playCashSound() {
  try {
    const audio = new Audio(CASH_SOUND_URL);
    audio.volume = 0.4;
    audio.play().catch(() => {
       // Auto-play policies might block this if no user interaction
       console.log('Audio autoplay blocked, waiting for interaction');
    });
  } catch (e) {
    console.error('Audio wrong', e);
  }
}
