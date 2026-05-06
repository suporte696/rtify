const axios = require('axios');
async function test() {
    try {
        const response = await axios.post('https://tools-rtify.66shh9.easypanel.host/api/playlists/sync', {
            spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF'
        });
        console.log('Sucesso! Added:', response.data.addedTracks);
    } catch (e) {
        console.error(e.response?.data || e.message);
    }
}
test();
