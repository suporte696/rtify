require('dotenv').config();
const axios = require('axios');

// Teste usando a API do Spotify Embed (não requer autenticação)
(async () => {
    try {
        // Método 1: Tentar via embed endpoint 
        const embedUrl = `https://open.spotify.com/embed/playlist/72CaJrFcR6ldtmtxwSVEes`;
        const embedRes = await axios.get(embedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('Embed status:', embedRes.status);
        console.log('Embed length:', embedRes.data.length);

        // Extrair o JSON do script tag no embed HTML
        const scriptMatch = embedRes.data.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
        if (scriptMatch) {
            const nextData = JSON.parse(scriptMatch[1]);
            console.log('Has __NEXT_DATA__');
            console.log('Keys:', Object.keys(nextData.props?.pageProps || {}));
        }

        // Método 2: API interna anônima do Spotify
        console.log('\n=== Teste via API anônima ===');
        const anonTokenRes = await axios.get('https://open.spotify.com/get_access_token?reason=transport&productType=web_player');
        console.log('Anon token status:', anonTokenRes.status);
        const anonToken = anonTokenRes.data.accessToken;
        console.log('Anon token:', anonToken?.substring(0, 15));

        if (anonToken) {
            const plRes = await axios.get('https://api.spotify.com/v1/playlists/72CaJrFcR6ldtmtxwSVEes', {
                headers: { 'Authorization': `Bearer ${anonToken}` }
            });
            console.log('Has tracks:', !!plRes.data.tracks);
            if (plRes.data.tracks) {
                console.log('Items:', plRes.data.tracks.items?.length);
                console.log('Total:', plRes.data.tracks.total);
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
