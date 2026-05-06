const axios = require('axios');

async function test() {
    try {
        const r = await axios.get('https://open.spotify.com/playlist/0gmiuUA0Jn08WAvcZVF0Fa');
        const text = r.data;
        const tokenMatch = text.match(/"accessToken":"(.*?)"/);

        if (tokenMatch) {
            const token = tokenMatch[1];
            console.log('Token extracted:', token.slice(0, 10));
            const r2 = await axios.get('https://api.spotify.com/v1/playlists/0gmiuUA0Jn08WAvcZVF0Fa/tracks?offset=0&limit=100', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            console.log('Tracks Total:', r2.data.total, 'Items Count:', r2.data.items?.length);
        } else {
            console.log('No token found');
        }
    } catch (e) {
        console.error(e.response ? e.response.status : e.message);
    }
}
test();
