const fs = require('fs');
const path = require('path');
const spotifyService = require('../services/spotify');

const PLAYLISTS_FILE = path.join(__dirname, '..', '..', 'data', 'playlists.json');

// Garante que a pasta e arquivo existem
function ensureFile() {
    const dir = path.dirname(PLAYLISTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(PLAYLISTS_FILE)) fs.writeFileSync(PLAYLISTS_FILE, '[]', 'utf-8');
}

function readAll() {
    ensureFile();
    return JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));
}

function writeAll(playlists) {
    ensureFile();
    fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(playlists, null, 2), 'utf-8');
}

// GET /api/playlists - Listar todas
function listPlaylists(req, res) {
    const playlists = readAll();
    res.json({ success: true, data: playlists });
}

// POST /api/playlists - Criar uma nova
function createPlaylist(req, res) {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const playlists = readAll();
    const newPlaylist = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        tracks: [],
        createdAt: new Date().toISOString()
    };
    playlists.push(newPlaylist);
    writeAll(playlists);
    res.json({ success: true, data: newPlaylist });
}

// DELETE /api/playlists/:id - Deletar
function deletePlaylist(req, res) {
    let playlists = readAll();
    playlists = playlists.filter(p => p.id !== req.params.id);
    writeAll(playlists);
    res.json({ success: true });
}

// POST /api/playlists/:id/tracks - Adicionar música
function addTrack(req, res) {
    const { track } = req.body;
    if (!track || !track.isrc) return res.status(400).json({ error: 'Track com ISRC obrigatório' });

    const playlists = readAll();
    const pl = playlists.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist não encontrada' });

    // Evitar duplicatas
    if (pl.tracks.some(t => t.isrc === track.isrc)) {
        return res.json({ success: true, message: 'Música já está na playlist', data: pl });
    }

    pl.tracks.push({
        id: track.id,
        name: track.name,
        artist: track.artist,
        album: track.album,
        cover_url: track.cover_url,
        duration_ms: track.duration_ms,
        isrc: track.isrc
    });
    writeAll(playlists);
    res.json({ success: true, data: pl });
}

// DELETE /api/playlists/:id/tracks/:isrc - Remover música
function removeTrack(req, res) {
    const playlists = readAll();
    const pl = playlists.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist não encontrada' });

    pl.tracks = pl.tracks.filter(t => t.isrc !== req.params.isrc);
    writeAll(playlists);
    res.json({ success: true, data: pl });
}

// GET /api/playlists/:id - Detalhes de uma playlist
function getPlaylist(req, res) {
    const playlists = readAll();
    const pl = playlists.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist não encontrada' });
    res.json({ success: true, data: pl });
}

// POST /api/playlists/sync - Importa ou re-sincroniza uma do Spotify
async function importSpotifyPlaylist(req, res) {
    const { spotifyUrl } = req.body;
    if (!spotifyUrl) return res.status(400).json({ error: 'URL do Spotify é obrigatória' });

    // Aceita link completo ou apenas ID
    const match = spotifyUrl.match(/playlist\/([a-zA-Z0-9]+)/);
    const spotifyId = match ? match[1] : spotifyUrl; // Se falhar regex, tenta usar raw id

    if (!spotifyId || spotifyId.length < 10) {
        return res.status(400).json({ error: 'URL ou ID do Spotify inválido' });
    }

    try {
        const { name, tracks } = await spotifyService.getPlaylistData(spotifyId);

        let playlists = readAll();
        // Verificar se a playlist já existe no nosso banco (pelo spotifyId para Sync)
        let pl = playlists.find(p => p.spotifyId === spotifyId);

        if (!pl) {
            pl = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                name: `[Spotify] ${name}`,
                spotifyId: spotifyId,
                tracks: [],
                createdAt: new Date().toISOString()
            };
            playlists.push(pl);
        }

        // MergeTracks / Deduplication by ISRC
        let addedCount = 0;
        const existingIsrcs = new Set(pl.tracks.map(t => t.isrc));

        for (const track of tracks) {
            if (!existingIsrcs.has(track.isrc)) {
                pl.tracks.push(track);
                addedCount++;
            }
        }

        writeAll(playlists);
        res.json({ success: true, data: pl, addedTracks: addedCount });

    } catch (e) {
        console.error('Erro sincronizando playlist:', e.response?.data || e.message);
        const detail = e.response?.data?.error?.message || e.message;
        res.status(500).json({ error: `Falha na API do Spotify: ${detail}` });
    }
}

module.exports = { listPlaylists, createPlaylist, deletePlaylist, addTrack, removeTrack, getPlaylist, importSpotifyPlaylist };
