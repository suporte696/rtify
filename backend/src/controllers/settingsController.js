const settingsService = require('../services/settings');
const deezerService = require('../services/deezer');

async function getArl(req, res) {
    const arl = settingsService.getArl();

    if (!arl) {
        return res.json({ success: true, arl: '', isValid: false });
    }

    try {
        // Testa a validade fazendo login no Deezer
        const session = await deezerService.getSession(arl);
        const isValid = !!(session && session.licenseToken);
        res.json({ success: true, arl, isValid });
    } catch (e) {
        res.json({ success: true, arl, isValid: false, error: e.message });
    }
}

async function setArl(req, res) {
    const { arl } = req.body;
    if (arl === undefined) {
        return res.status(400).json({ error: 'O parâmetro arl é obrigatório.' });
    }

    settingsService.setArl(arl.trim());

    if (!arl.trim()) {
        return res.json({ success: true, message: 'ARL limpo com sucesso.', isValid: false });
    }

    try {
        const session = await deezerService.getSession(arl.trim());
        const isValid = !!(session && session.licenseToken);
        res.json({ success: true, message: isValid ? 'ARL atualizado e validado com sucesso!' : 'ARL atualizado, mas parece estar inválido.', isValid });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Falha ao validar o ARL.' });
    }
}

module.exports = {
    getArl,
    setArl
};
