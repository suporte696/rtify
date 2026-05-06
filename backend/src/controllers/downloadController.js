const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const NodeID3 = require('node-id3');
const deezerService = require('../services/deezer');
const { DeezerDecryptor } = require('../services/decryptor');
const settingsService = require('../services/settings');
const youtubeService = require('../services/youtube');

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');

// Garante que a pasta de downloads existe
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
}

async function downloadTrack(req, res) {
    const isrc = req.query.isrc;
    const trackName = req.query.name || 'Unknown';
    const artistName = req.query.artist || 'Unknown';
    const albumName = req.query.album || 'Unknown';
    const coverUrl = req.query.cover || '';
    const ARL = settingsService.getArl();

    if (!isrc) return res.status(400).json({ error: 'ISRC obrigatório' });

    const fallbackQuery = `${artistName} ${trackName}`.trim();

    try {
        // 1. Buscar no Deezer
        const trackData = await deezerService.findTrackDataByISRC(isrc);
        if (!trackData) {
            console.log(`[Download Fallback] Música não encontrada no Deezer. Baixando via YouTube...`);
            if (fallbackQuery) return await handleYoutubeDownload(fallbackQuery, trackName, artistName, albumName, coverUrl, res);
            return res.status(404).json({ error: 'Música não encontrada no Deezer e metadata ausente para o YouTube' });
        }

        // 2. Autenticar
        const session = await deezerService.getSession(ARL);
        if (!session?.licenseToken) {
            console.log(`[Download Fallback] ARL inválido. Baixando via YouTube...`);
            if (fallbackQuery) return await handleYoutubeDownload(fallbackQuery, trackName, artistName, albumName, coverUrl, res);
            return res.status(401).json({ error: 'ARL inválido' });
        }

        // 3. Pegar Track Token
        const trackToken = await deezerService.getTrackToken(trackData.id, session.csrfToken, session.sid, ARL);
        if (!trackToken) {
            console.log(`[Download Fallback] Falha no Track Token. Baixando via YouTube...`);
            if (fallbackQuery) return await handleYoutubeDownload(fallbackQuery, trackName, artistName, albumName, coverUrl, res);
            return res.status(500).json({ error: 'Falha ao obter Track Token' });
        }

        // 4. Pegar URL de stream real
        const streamData = await deezerService.getStreamUrl(trackToken, session.licenseToken);
        if (!streamData) {
            console.log(`[Download Fallback] Direitos negados. Baixando via YouTube...`);
            if (fallbackQuery) return await handleYoutubeDownload(fallbackQuery, trackName, artistName, albumName, coverUrl, res);
            return res.status(500).json({ error: 'Falha ao obter URL de stream' });
        }

        // 5. Baixar o arquivo criptografado e descriptografar
        const dlResponse = await axios({
            method: 'get',
            url: streamData.url,
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const safeArtist = sanitizeFilename(artistName);
        const safeName = sanitizeFilename(trackName);
        const filename = `${safeArtist} - ${safeName}.mp3`;
        const filepath = path.join(DOWNLOADS_DIR, filename);

        console.log(`[Download] Baixando: ${filename}`);

        // Pipe: CDN criptografada → Decryptor → Arquivo local
        const decryptStream = new DeezerDecryptor(trackData.id);
        const writeStream = fs.createWriteStream(filepath);

        await new Promise((resolve, reject) => {
            dlResponse.data
                .pipe(decryptStream)
                .pipe(writeStream)
                .on('finish', resolve)
                .on('error', reject);
        });

        // 6. Adicionar tags ID3 (metadados do MP3)
        const tags = {
            title: trackName,
            artist: artistName,
            album: albumName,
        };

        // Baixar a capa do álbum se disponível
        if (coverUrl) {
            try {
                const coverResponse = await axios.get(coverUrl, { responseType: 'arraybuffer' });
                tags.image = {
                    mime: 'image/jpeg',
                    type: { id: 3, name: 'front cover' },
                    description: 'Album Cover',
                    imageBuffer: Buffer.from(coverResponse.data)
                };
            } catch (e) {
                console.warn('[Download] Capa não pôde ser baixada:', e.message);
            }
        }

        NodeID3.write(tags, filepath);
        console.log(`[Download] Salvo com ID3: ${filepath}`);

        // 7. Sync com Google Drive via rclone (se configurado)
        const rcloneRemote = process.env.RCLONE_REMOTE;
        if (rcloneRemote) {
            try {
                console.log(`[rclone] Sincronizando ${filename} para ${rcloneRemote}...`);
                execSync(`rclone copy "${filepath}" "${rcloneRemote}"`, { timeout: 60000 });
                console.log(`[rclone] Sync concluído!`);
            } catch (e) {
                console.warn('[rclone] Erro no sync:', e.message);
            }
        }

        res.json({
            success: true,
            message: `"${trackName}" baixada com sucesso!`,
            file: filename,
            synced: !!rcloneRemote
        });

    } catch (e) {
        console.error('[Download] Erro:', e.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro ao baixar a música', message: e.message });
        }
    }
}

// Listar músicas já baixadas
async function listDownloads(req, res) {
    try {
        const files = fs.readdirSync(DOWNLOADS_DIR)
            .filter(f => f.endsWith('.mp3'))
            .map(f => {
                const stats = fs.statSync(path.join(DOWNLOADS_DIR, f));
                return { name: f, size: stats.size, date: stats.mtime };
            })
            .sort((a, b) => b.date - a.date);
        res.json({ success: true, data: files, total: files.length });
    } catch (e) {
        res.json({ success: true, data: [], total: 0 });
    }
}

async function handleYoutubeDownload(searchQuery, trackName, artistName, albumName, coverUrl, res) {
    const safeArtist = sanitizeFilename(artistName);
    const safeName = sanitizeFilename(trackName);
    const filename = `${safeArtist} - ${safeName}.mp3`;
    const filepath = path.join(DOWNLOADS_DIR, filename);

    try {
        await youtubeService.downloadYouTubeAudioToPath(searchQuery, filepath);

        // ID3 Tags
        const tags = { title: trackName, artist: artistName, album: albumName };
        if (coverUrl) {
            try {
                const coverResponse = await axios.get(coverUrl, { responseType: 'arraybuffer' });
                tags.image = {
                    mime: 'image/jpeg',
                    type: { id: 3, name: 'front cover' },
                    description: 'Album Cover',
                    imageBuffer: Buffer.from(coverResponse.data)
                };
            } catch (e) { }
        }
        NodeID3.write(tags, filepath);

        // Sync com Google Drive
        const rcloneRemote = process.env.RCLONE_REMOTE;
        if (rcloneRemote) {
            try { execSync(`rclone copy "${filepath}" "${rcloneRemote}"`, { timeout: 60000 }); } catch (e) { }
        }

        res.json({
            success: true,
            message: `"${trackName}" baixada com sucesso (via YouTube)!`,
            file: filename,
            synced: !!rcloneRemote
        });

    } catch (e) {
        console.error('[Download Fallback] Erro do YouTube:', e.message);
        if (!res.headersSent) res.status(500).json({ error: 'Erro ao baixar música no Deezer e YouTube', message: e.message });
    }
}

module.exports = { downloadTrack, listDownloads };
