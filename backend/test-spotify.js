require('dotenv').config();
const spotifyService = require('./src/services/spotify');

async function test() {
    try {
        const data = await spotifyService.getPlaylistData('https://open.spotify.com/playlist/1Q6S0EGIqIHDwlreKdc2gW?si=91b2bfab5c514742');
        console.log('Sucesso! Quantidade de musicas:', data.tracks.length);
    } catch (e) {
        console.error('Erro no catch:', e.response?.data || e.message);
    }
}
test();
