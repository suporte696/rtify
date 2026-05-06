const fs = require('fs');
try {
    const json = JSON.parse(fs.readFileSync('./spotify_debug.json', 'utf8'));
    fs.writeFileSync('./type.txt', 'Type: ' + json.type);
} catch (e) { }
