require('dotenv').config();
const spotifyService = require('./src/services/spotify'); // To get the token

async function test() {
    try {
        const playlistUrl = 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF';
        console.log('Fetching:', playlistUrl);
        const data = await spotifyService.getPlaylistData(playlistUrl);
        console.log('Playlist Name:', data.name);
        console.log('Tracks extracted:', data.tracks.length);
        if (data.tracks.length > 0) {
            console.log('First track:', data.tracks[0].name);
        } else {
            console.log('Zero tracks returned!');
        }
    } catch (e) {
        console.error('Error fetching playlist:', e.response?.data || e.message);
    }
}
test();
