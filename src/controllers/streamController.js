const axios = require('axios');
const deezerService = require('../services/deezer');
const { DeezerDecryptor } = require('../services/decryptor');
const settingsService = require('../services/settings');
const youtubeService = require('../services/youtube');

async function streamTrack(req, res) {
    const isrc = req.query.isrc;
    const name = req.query.name || '';
    const artist = req.query.artist || '';
    const fallbackQuery = `${name} ${artist}`.trim();
    const ARL = settingsService.getArl();

    if (!isrc && !fallbackQuery) return res.status(400).json({ error: 'ISRC ou metadados da música (name/artist) obrigatório' });

    try {
        // 1. Buscar a música no Deezer usando o ISRC do Spotify
        const trackData = await deezerService.findTrackDataByISRC(isrc);
        if (!trackData) {
            console.log(`[Stream Fallback] Música '${fallbackQuery}' não encontrada no Deezer via ISRC. Ativando YouTube.`);
            if (fallbackQuery) return await youtubeService.streamYouTubeAudio(fallbackQuery, res);
            return res.status(404).json({ error: 'Música não encontrada no Deezer via ISRC' });
        }

        console.log(`[Stream] Música encontrada: ${trackData.title} (ID: ${trackData.id})`);

        // 2. Autenticar e recuperar a sessão com o ARL
        const session = await deezerService.getSession(ARL);
        if (!session || !session.licenseToken) {
            console.log('[Stream Fallback] ARL inválido. Tentando via YouTube...');
            if (fallbackQuery) return await youtubeService.streamYouTubeAudio(fallbackQuery, res);
            return res.status(401).json({ error: 'ARL inválido ou expirado' });
        }

        // 3. Recuperar o TRACK_TOKEN da música
        const trackToken = await deezerService.getTrackToken(trackData.id, session.csrfToken, session.sid, ARL);
        if (!trackToken) {
            console.log('[Stream Fallback] Falha ao obter Track Token (possível bloqueio pago). Tentando via YouTube...');
            if (fallbackQuery) return await youtubeService.streamYouTubeAudio(fallbackQuery, res);
            return res.status(500).json({ error: 'Falha ao obter Track Token' });
        }

        // 4. Trocar pelo URL de stream real via media.deezer.com
        const streamData = await deezerService.getStreamUrl(trackToken, session.licenseToken);
        if (!streamData) {
            console.log('[Stream Fallback] Falha ao obter URL de stream (Free Tier). Tentando via YouTube...');
            if (fallbackQuery) return await youtubeService.streamYouTubeAudio(fallbackQuery, res);
            return res.status(500).json({ error: 'Falha ao obter URL de stream' });
        }

        console.log(`[Stream] URL obtida de: ${streamData.provider}`);

        // 5. Obter o tamanho final da música e preparar HTTP Range Request
        const headRes = await axios.head(streamData.url).catch(() => null);
        const totalSize = headRes ? parseInt(headRes.headers['content-length'], 10) : null;

        const range = req.headers.range;
        let pStart = 0;
        let pEnd = totalSize ? totalSize - 1 : '';
        let httpStatus = 200;

        let alignStart = 0;
        let alignDiff = 0;
        let startChunk = 0;

        const reqHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        if (range && totalSize) {
            const parts = range.replace(/bytes=/, "").split("-");
            pStart = parseInt(parts[0], 10);
            if (parts[1]) pEnd = parseInt(parts[1], 10);

            // Alinhamento matemático reverso para blocos de 2048 usando FLOOR
            alignStart = Math.floor(pStart / 2048) * 2048;
            alignDiff = pStart - alignStart;
            startChunk = Math.floor(alignStart / 2048);

            reqHeaders['Range'] = `bytes=${alignStart}-${pEnd}`;
            httpStatus = 206;
        }

        // 6. Iniciar o download encriptado (total ou parcial) e passar pelo decryptor em tempo real
        const dlResponse = await axios({
            method: 'get',
            url: streamData.url,
            responseType: 'stream',
            headers: reqHeaders
        });

        res.status(httpStatus);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');

        if (totalSize) {
            const sendSize = (pEnd - pStart) + 1;
            res.setHeader('Content-Length', sendSize);
            if (httpStatus === 206) {
                res.setHeader('Content-Range', `bytes ${pStart}-${pEnd}/${totalSize}`);
            }
        }

        const decryptStream = new DeezerDecryptor(trackData.id, startChunk, alignDiff);
        dlResponse.data.pipe(decryptStream).pipe(res);

    } catch (e) {
        console.error('[Stream] Erro:', e.stack);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Erro na geração da stream',
                message: e.message
            });
        }
    }
}

module.exports = { streamTrack };
