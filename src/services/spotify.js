const axios = require('axios');
const settingsService = require('./settings');

let accessToken = null;
let tokenExpiresAt = null;

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiresAt) {
        console.log('[Spotify Auth] Usando token em memoria existente.');
        return accessToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('[Spotify Auth] ERRO: SPOTIFY_CLIENT_ID ou SECRET não encontrados no process.env!');
        throw new Error('Credenciais do Spotify não configuradas no .env');
    }
    console.log('[Spotify Auth] Client ID presente:', clientId.substring(0, 5) + '...');

    const refreshToken = settingsService.getSpotifyRefreshToken();
    let dataPayload;

    console.log('[Spotify Auth] Refresh Token disponível?', !!refreshToken);

    if (refreshToken) {
        console.log('[Spotify Auth] Usando auth_code (refresh_token) para logar como usuário.');
        dataPayload = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }).toString();
    } else {
        console.log('[Spotify Auth] Usando client_credentials (token genérico/público). Apenas playlists públicas funcionarão.');
        dataPayload = 'grant_type=client_credentials';
    }

    const authOptions = {
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(clientId + ':' + clientSecret).toString('base64')),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: dataPayload
    };

    try {
        const response = await axios(authOptions);
        accessToken = response.data.access_token;
        tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000;
        console.log('[Spotify Auth] Novo token obtido com sucesso!');
        return accessToken;
    } catch (e) {
        console.error('[Spotify Auth] Falha ao obter token:', e.response?.data || e.message);
        throw e;
    }
}

function clearTokenCache() {
    accessToken = null;
    tokenExpiresAt = null;
    console.log('[Spotify Auth] Cache de token limpo.');
}

async function searchTracks(query) {
    const token = await getAccessToken();

    const response = await axios.get('https://api.spotify.com/v1/search', {
        headers: {
            'Authorization': `Bearer ${token}`
        },
        params: {
            q: query,
            type: 'track'
        }
    });

    // Mapear os resultados para um formato limpo, útil e leve para o lado do App Mobile
    const tracks = response.data.tracks.items.map(track => {
        return {
            id: track.id, // ID original do Spotify
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            cover_url: track.album.images[0]?.url || null,
            duration_ms: track.duration_ms,
            isrc: track.external_ids?.isrc || null // ISRC é crucial para encontrar depois no Deezer!
        };
    });

    return tracks;
}

async function getPlaylistData(playlistUrl) {
    const match = playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/);
    const playlistId = match ? match[1] : playlistUrl;

    console.log(`[Spotify Sync] Iniciando importação da playlist: ${playlistId}`);
    const token = await getAccessToken();

    // Reset fallback para o caso de restrições obscuras da API
    const fields = 'name,images,tracks.total,tracks.next,tracks.items(track(id,name,artists(name),album(name,images),duration_ms,external_ids))';

    try {
        console.log(`[Spotify Sync] Fetching metadata & first tracks...`);
        const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { fields }
        });

        const playlistName = response.data.name;
        const allTracksRaw = [];

        if (response.data.tracks && response.data.tracks.items) {
            console.log(`[Spotify Sync] 1º lote de faixas recebidas: ${response.data.tracks.items.length}`);
            allTracksRaw.push(...response.data.tracks.items);
        } else {
            console.warn(`[Spotify Sync] AVISO CRÍTICO: Campo 'tracks' omitido pela API do Spotify! O token atual não tem permissão para ler as faixas desta playlist.`);
        }

        // Paginação: percorre todas as páginas seguintes
        let nextUrl = response.data.tracks?.next;
        while (nextUrl) {
            const nextResponse = await axios.get(nextUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (nextResponse.data.items) {
                allTracksRaw.push(...nextResponse.data.items);
            }
            nextUrl = nextResponse.data.next || null;
        }

        console.log(`[Spotify Sync] ${allTracksRaw.length} faixas encontradas na playlist "${playlistName}".`);

        const tracks = allTracksRaw
            .map(item => item.track)
            .filter(track => track && track.id)
            .map(track => {
                return {
                    id: track.id,
                    name: track.name,
                    artist: track.artists ? track.artists.map(a => a?.name).join(', ') : 'Unknown Artist',
                    album: track.album ? track.album.name : 'Unknown Album',
                    cover_url: track.album?.images?.[0]?.url || null,
                    duration_ms: track.duration_ms || 0,
                    isrc: track.external_ids?.isrc || null
                };
            })
            .filter(t => t.isrc !== null);

        return { name: playlistName, tracks };
    } catch (e) {
        console.error(`[Spotify Sync] Erro Crítico:`, e.response?.data || e.message);
        throw e;
    }
}




async function getRecommendations(trackName, artistName) {
    const lastFmKey = process.env.LASTFM_API_KEY;
    if (!lastFmKey) return [];

    try {
        const url = `http://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&api_key=${lastFmKey}&format=json&limit=5`;
        const response = await axios.get(url);

        const similarTracks = response.data.similartracks?.track;
        if (!similarTracks || similarTracks.length === 0) return [];

        // Para evitar lentidão, fazemos as 5 buscas no Spotify de forma simultânea (Promise.all)
        const spotifyPromises = similarTracks.map(async (t) => {
            try {
                const query = `${t.name} ${t.artist.name}`;
                console.log('[Reco] Buscando no Spotify:', query);
                const searchResults = await searchTracks(query);
                console.log('[Reco] Spotify retornou:', searchResults.length, 'resultados');
                return searchResults.length > 0 ? searchResults[0] : null;
            } catch (e) {
                console.error('[Reco] ERRO no mapping:', e.message);
                return null;
            }
        });

        const results = await Promise.all(spotifyPromises);
        return results.filter(r => r !== null);

    } catch (e) {
        console.error('[Last.fm API Error]', e.message);
        return [];
    }
}

module.exports = {
    searchTracks,
    getRecommendations,
    getPlaylistData,
    clearTokenCache
};
