const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('https://tools-rtify.66shh9.easypanel.host/api/playlists');
        const playlists = response.data.data;
        const target = playlists.find(p => p.spotifyId === '1Q6S0EGIqIHDwlreKdc2gW');
        if (target) {
            console.log('Playlist exists no VPS!');
            console.log('Tracks count:', target.tracks.length);
        } else {
            console.log('Playlist não encontrada no VPS.');
        }
    } catch (e) {
        console.error('Erro:', e.message);
    }
}
test();
