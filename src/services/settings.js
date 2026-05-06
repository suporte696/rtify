const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'settings.json');

// Garante que a pasta e arquivo existem
function ensureFile() {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(SETTINGS_FILE)) {
        // Fallback para o .env na primeira inicialização, se existir
        const defaultArl = process.env.DEEZER_ARL || '';
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ arl: defaultArl }), 'utf-8');
    }
}

function getSettings() {
    ensureFile();
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { arl: process.env.DEEZER_ARL || '' };
    }
}

function saveSettings(newSettings) {
    ensureFile();
    const current = getSettings();
    const updated = { ...current, ...newSettings };
    console.log(`[Settings] Gravando em: ${SETTINGS_FILE}`);
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
        console.log('[Settings] Gravado com sucesso!');
    } catch (e) {
        console.error('[Settings] ERRO AO GRAVAR:', e.message);
    }
    return updated;
}

function getArl() {
    return getSettings().arl;
}

function setArl(arl) {
    saveSettings({ arl });
}

function getSpotifyRefreshToken() {
    return getSettings().spotify_refresh_token || null;
}

function setSpotifyRefreshToken(token) {
    saveSettings({ spotify_refresh_token: token });
}

module.exports = {
    getSettings,
    saveSettings,
    getArl,
    setArl,
    getSpotifyRefreshToken,
    setSpotifyRefreshToken
};
