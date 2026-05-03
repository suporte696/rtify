const axios = require('axios');

// Pega o ID da música no Deezer usando o ISRC do Spotify
async function findTrackDataByISRC(isrc) {
    try {
        const response = await axios.get(`https://api.deezer.com/track/isrc:${isrc}`);
        if (response.data && response.data.id) {
            return response.data;
        }
        return null;
    } catch (e) {
        console.error('[Deezer API] Erro ao buscar ISRC:', e.message);
        return null;
    }
}

// Etapa 1: Autenticar com ARL e extrair CSRF token, SID e license_token
async function getSession(arl) {
    try {
        const response = await axios.post(
            'https://www.deezer.com/ajax/gw-light.php?method=deezer.getUserData&api_version=1.0&api_token=',
            {},
            { headers: { 'Cookie': `arl=${arl}` } }
        );

        const results = response.data?.results;
        const csrfToken = results?.checkForm;
        const licenseToken = results?.USER?.OPTIONS?.license_token;

        let sid = '';
        if (response.headers['set-cookie']) {
            const sidCookie = response.headers['set-cookie'].find(c => c.startsWith('sid='));
            if (sidCookie) {
                sid = sidCookie.split(';')[0].replace('sid=', '');
            }
        }

        return { csrfToken, licenseToken, sid };
    } catch (e) {
        console.error('[Deezer] Falha ao obter sessão com ARL', e.message);
        return null;
    }
}

// Etapa 2: Pegar TRACK_TOKEN (necessário para solicitar a URL de mídia)
async function getTrackToken(trackId, csrfToken, sid, arl) {
    try {
        const response = await axios.post(
            `https://www.deezer.com/ajax/gw-light.php?method=deezer.pageTrack&api_version=1.0&api_token=${csrfToken}`,
            { SNG_ID: trackId },
            { headers: { 'Cookie': `arl=${arl}; sid=${sid}` } }
        );
        const trackToken = response.data?.results?.DATA?.TRACK_TOKEN;
        return trackToken || null;
    } catch (e) {
        console.error('[Deezer] Erro ao buscar Track Token', e.message);
        return null;
    }
}

// Etapa 3: Trocar license_token + track_token por uma URL de stream real
async function getStreamUrl(trackToken, licenseToken) {
    try {
        const response = await axios.post('https://media.deezer.com/v1/get_url', {
            license_token: licenseToken,
            media: [{
                type: "FULL",
                formats: [
                    { cipher: "BF_CBC_STRIPE", format: "MP3_128" },
                    { cipher: "BF_CBC_STRIPE", format: "MP3_64" },
                    { cipher: "BF_CBC_STRIPE", format: "MP3_MISC" }
                ]
            }],
            track_tokens: [trackToken]
        });

        const mediaData = response.data?.data;
        if (mediaData && mediaData[0] && mediaData[0].media) {
            const sources = mediaData[0].media[0]?.sources;
            if (sources && sources.length > 0) {
                return {
                    url: sources[0].url,
                    provider: sources[0].provider
                };
            }
        }
        console.error('[Deezer] Resposta media.getUrl sem URLs:', JSON.stringify(response.data));
        return null;
    } catch (e) {
        console.error('[Deezer] Erro ao buscar Stream URL:', e.response?.data || e.message);
        return null;
    }
}

module.exports = {
    findTrackDataByISRC,
    getSession,
    getTrackToken,
    getStreamUrl
};
