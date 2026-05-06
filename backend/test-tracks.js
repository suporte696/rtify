const fs = require('fs');
try {
    const json = JSON.parse(fs.readFileSync('./spotify_debug.json', 'utf8'));
    console.log('Total tracks:', json.tracks.total);
    console.log('Items length:', json.tracks.items ? json.tracks.items.length : 0);
    if (json.tracks.items && json.tracks.items.length > 0) {
        console.log('First track isrc:', json.tracks.items[0].track?.external_ids?.isrc);
    }
} catch (e) {
    console.log('Error:', e.message);
}
