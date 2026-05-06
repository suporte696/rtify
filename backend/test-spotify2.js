require('dotenv').config();
const axios = require('axios');
const spotifyService = require('./src/services/spotify'); // To get the token

async function test() {
    try {
        // We know we can get a token because the other script worked
        const playlistId = '1Q6S0EGIqIHDwlreKdc2gW';
        // Hacky way to get the token, since getAccessToken is probably internal, 
        // wait! getAccessToken isn't exported.
        // Let's just mock it or patch the service temporarily.
    } catch (e) {
    }
}
test();
