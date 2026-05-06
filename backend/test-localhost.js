const axios = require('axios');

async function test() {
    try {
        console.log('Enviando requisição POST para localhost:3000...');
        const res = await axios.post('http://localhost:3000/api/playlists/sync', {
            spotifyUrl: 'https://open.spotify.com/playlist/1Q6S0EGIqIHDwlreKdc2gW'
        });
        console.log('Resposta:', res.data);
    } catch (e) {
        console.log('Erro recebido do POST:', e.response?.data || e.message);
    }
}
test();
