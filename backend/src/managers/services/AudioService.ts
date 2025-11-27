// ============================================
// AUDIO SERVICE - Format Conversion
// ============================================
// Converte PCM RAW (do Gemini) para OGG/Opus (para WhatsApp PTT)

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class AudioService {
    private tempDir: string;

    constructor() {
        this.tempDir = path.join(os.tmpdir(), 'agentwhatsa-audio');
        this.ensureTempDir();
    }

    private async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error('[AudioService] Erro ao criar diretório temporário:', error);
        }
    }

    /**
     * Converte buffer PCM RAW (do Gemini) para OGG/Opus (para WhatsApp PTT)
     * Gemini retorna: audio/L16;codec=pcm;rate=24000 (PCM 16-bit, 24kHz, mono)
     */
    async convertWavToOgg(pcmBuffer: Buffer): Promise<Buffer> {
        const timestamp = Date.now();
        const id = Math.random().toString(36).substring(7);
        const inputPath = path.join(this.tempDir, `in-${timestamp}-${id}.pcm`);
        const outputPath = path.join(this.tempDir, `out-${timestamp}-${id}.ogg`);

        try {
            console.log(`[AudioService] Convertendo PCM para OGG (${pcmBuffer.length} bytes)...`);

            // 1. Salvar PCM em arquivo temporário
            await fs.writeFile(inputPath, pcmBuffer);

            // 2. Converter PCM RAW → OGG/Opus usando fluent-ffmpeg
            await new Promise<void>((resolve, reject) => {
                ffmpeg(inputPath)
                    .inputFormat('s16le')        // PCM 16-bit little-endian
                    .inputOptions([
                        '-ar 24000',             // Sample rate 24kHz (do Gemini)
                        '-ac 1'                  // 1 canal (mono)
                    ])
                    .audioCodec('libopus')       // Codec Opus
                    .audioBitrate('64k')         // Bitrate 64k
                    .audioChannels(1)            // Mono
                    .audioFrequency(48000)       // Resample para 48kHz (padrão Opus)
                    .format('ogg')               // Formato OGG
                    .on('end', () => {
                        console.log('[AudioService] ✅ Conversão concluída');
                        resolve();
                    })
                    .on('error', (err: Error) => {
                        console.error('[AudioService] ❌ Erro na conversão:', err);
                        reject(err);
                    })
                    .save(outputPath);
            });

            // 3. Ler arquivo convertido
            const oggBuffer = await fs.readFile(outputPath);
            console.log(`[AudioService] ✅ OGG gerado (${oggBuffer.length} bytes)`);

            return oggBuffer;
        } catch (error) {
            console.error('[AudioService] ❌ Erro na conversão de áudio:', error);
            throw error;
        } finally {
            // 4. Limpar arquivos temporários
            try {
                await fs.unlink(inputPath).catch(() => { });
                await fs.unlink(outputPath).catch(() => { });
            } catch (cleanupError) {
                console.warn('[AudioService] Erro ao limpar arquivos temporários:', cleanupError);
            }
        }
    }
}

export const audioService = new AudioService();
