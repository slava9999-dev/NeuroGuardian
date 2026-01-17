import axios from 'axios';
import { logger } from '../lib/logger.js';

/**
 * Service for voice synthesis using ElevenLabs API
 * Integrated for Viktor AI Persona
 */
export class VoiceService {
  private static readonly API_KEY = process.env.ELEVENLABS_API_KEY;
  private static readonly VOICE_ID = 'pNInz6obpg8nEmeWscpx'; // "Adam" - Deep professional voice, suitable for Viktor
  private static readonly EL_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

  /**
   * Generates a voice message (audio buffer) from text
   * @param text The text to synthesize
   * @returns Buffer containing the audio data (mp3)
   */
  static async synthesize(text: string): Promise<Buffer> {
    if (!this.API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    try {
      logger.info('Synthesizing voice message', { textLength: text.length });

      const response = await axios.post(
        `${this.EL_API_URL}/${this.VOICE_ID}`,
        {
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        },
        {
          headers: {
            'xi-api-key': this.API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Voice synthesis failed', {
        error: errorMessage,
      });
      throw new Error(`Voice synthesis failed: ${errorMessage}`);
    }
  }

  /**
   * Checks if voice synthesis is available
   */
  static isAvailable(): boolean {
    return !!this.API_KEY;
  }
}
