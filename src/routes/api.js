const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotify');
const streamController = require('../controllers/streamController');
const downloadController = require('../controllers/downloadController');
const playlistController = require('../controllers/playlistController');
const settingsController = require('../controllers/settingsController');

// Rotas de Configurações (ARL)
router.get('/settings/arl', settingsController.getArl);
router.post('/settings/arl', settingsController.setArl);

// Rotas de Autenticação OAuth Spotify
const axios = require('axios');
const settingsService = require('../services/settings');

router.get('/spotify/login', (req, res) => {
    const scope = 'playlist-read-private playlist-read-collaborative';
    const redirect_uri = process.env.REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';
    const client_id = process.env.SPOTIFY_CLIENT_ID;

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri
    });
    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

router.get('/spotify/callback', async (req, res) => {
    const code = req.query.code || null;
    if (!code) return res.send('Erro: Nenhum código retornado.');

    const redirect_uri = process.env.REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        }).toString(), {
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.data.refresh_token) {
            settingsService.setSpotifyRefreshToken(response.data.refresh_token);
            spotifyService.clearTokenCache();
            // Sucesso visual no browser do navegador
            res.send(`
                <html><head><style>
                body { background: #121212; color: #1DB954; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                h1 { text-align: center; }
                </style></head>
                <body><h1>✅ Autenticado com Sucesso!<br><span style="font-size:18px; color:white;">O Rtify agora tem acesso total ao Spotify. Pode fechar esta janela.</span></h1></body></html>
            `);
        } else {
            res.send('Autenticado, mas não retornou o Refresh Token permanente. Tente novamente.');
        }
    } catch (e) {
        console.error('Erro no OAuth Spotify:', e.response?.data || e.message);
        res.send('Falha catastrófica ao trocar código OAuth. Verifique logs do servidor local.');
    }
});

// Rota de busca generalizada para o aplicativo
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Parâmetro de busca (q) é obrigatório.' });
        }

        const results = await spotifyService.searchTracks(query);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('[Spotify API Error]', error.message);
        res.status(500).json({ success: false, error: 'Falha ao buscar no Spotify.', details: error.message });
    }
});

// Rota de Recomendações (Rádio Infitnia)
router.get('/recommendations', async (req, res) => {
    try {
        const track = req.query.track;
        const artist = req.query.artist;
        if (!track || !artist) return res.status(400).json({ error: 'Track e artist necessários' });

        const results = await spotifyService.getRecommendations(track, artist);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('[Recommendations Error]', error.message);
        res.status(500).json({ success: false, error: 'Falha ao buscar recomendações.', details: error.message });
    }
});

// Rota Mágica que entrega o Áudio Limpo
router.get('/stream', streamController.streamTrack);

// Rotas de Download
router.get('/download', downloadController.downloadTrack);
router.get('/downloads', downloadController.listDownloads);

// Rotas de Playlists
router.get('/playlists', playlistController.listPlaylists);
router.post('/playlists', playlistController.createPlaylist);
router.post('/playlists/sync', playlistController.importSpotifyPlaylist); // Vem antes de :id
router.get('/playlists/:id', playlistController.getPlaylist);
router.delete('/playlists/:id', playlistController.deletePlaylist);
router.post('/playlists/:id/tracks', playlistController.addTrack);
router.delete('/playlists/:id/tracks/:isrc', playlistController.removeTrack);

module.exports = router;
