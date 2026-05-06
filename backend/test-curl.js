const axios = require('axios');

async function test() {
    try {
        const response = await axios.post('https://tools-rtify.66shh9.easypanel.host/api/playlists/sync', {
            spotifyUrl: 'https://open.spotify.com/playlist/1Q6S0EGIqIHDwlreKdc2gW?si=91b2bfab5c514742'
        });
        console.log('Sucesso! Added:', response.data.addedTracks);
    } catch (e) {
        console.error('Erro:', e.response?.data || e.message);
    }
}
test();
