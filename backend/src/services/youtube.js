const { spawn } = require('child_process');

function streamYouTubeAudio(searchQuery, res) {
    return new Promise((resolve, reject) => {
        // Usamos ytsearch1: para buscar e pegar o primeiro resultado e -o - para cuspir o áudio em stdout
        const yt = spawn('yt-dlp', [
            '-f', 'bestaudio',
            '-o', '-',
            '--quiet',
            `ytsearch1:${searchQuery} official audio`
        ]);

        res.setHeader('Content-Type', 'audio/webm'); // ou m4a, o app lida bem com tipos genéricos
        res.setHeader('Accept-Ranges', 'none');

        yt.stdout.pipe(res);

        yt.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error('yt-dlp falhou com código ' + code));
        });

        yt.on('error', (err) => {
            reject(err);
        });
    });
}

function downloadYouTubeAudioToPath(searchQuery, filePath) {
    return new Promise((resolve, reject) => {
        const yt = spawn('yt-dlp', [
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '-o', filePath,
            '--quiet',
            `ytsearch1:${searchQuery} official audio`
        ]);

        yt.on('close', (code) => {
            if (code === 0) resolve(filePath);
            else reject(new Error('Erro no download via yt-dlp, código: ' + code));
        });

        yt.on('error', (err) => {
            reject(err);
        });
    });
}

module.exports = {
    streamYouTubeAudio,
    downloadYouTubeAudioToPath
};
