const axios = require('axios');
const fs = require('fs');

async function test() {
    try {
        const json = JSON.parse(fs.readFileSync('./spotify_debug_tracks.json', 'utf8'));
        if (json.items) {
            console.log('Items:', json.items.length);
            console.log(json.items[0].track.name, 'ISRC:', json.items[0].track.external_ids?.isrc);
            console.log(json.items[1].track.name, 'ISRC:', json.items[1].track.external_ids?.isrc);
        }
    } catch (e) { }
}
test();
