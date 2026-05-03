const crypto = require('crypto');
const { Transform } = require('stream');

function getBlowfishKey(trackId) {
    const SECRET = 'g4el58wc0zvf9na1';
    const idMd5 = crypto.createHash('md5').update(trackId.toString(), 'ascii').digest('hex');
    let bfKey = '';
    for (let i = 0; i < 16; i++) {
        bfKey += String.fromCharCode(idMd5.charCodeAt(i) ^ idMd5.charCodeAt(i + 16) ^ SECRET.charCodeAt(i));
    }
    return Buffer.from(bfKey, 'latin1');
}

class DeezerDecryptor extends Transform {
    constructor(trackId, startChunk = 0, dropBytes = 0) {
        super();
        this.chunkSize = 2048;
        this.bfKey = getBlowfishKey(trackId);
        this.iv = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
        this.chunkCount = startChunk;
        this.dropBytes = dropBytes;
        this.buffer = Buffer.alloc(0);
    }

    _transform(chunk, encoding, callback) {
        this.buffer = Buffer.concat([this.buffer, chunk]);

        while (this.buffer.length >= this.chunkSize) {
            let processedChunk;
            const currentBlock = this.buffer.slice(0, this.chunkSize);

            if (this.chunkCount % 3 === 0) {
                // Deezer usa CBC Interleaved e garante q apenas multiplos de 2048 bytes sao cifrados
                const dCipher = crypto.createDecipheriv('bf-cbc', this.bfKey, this.iv);
                dCipher.setAutoPadding(false);
                processedChunk = Buffer.concat([dCipher.update(currentBlock), dCipher.final()]);
            } else {
                // Claro
                processedChunk = currentBlock;
            }

            let outChunk = processedChunk;
            if (this.dropBytes > 0) {
                const toDrop = Math.min(this.dropBytes, outChunk.length);
                outChunk = outChunk.slice(toDrop);
                this.dropBytes -= toDrop;
            }

            if (outChunk.length > 0) {
                this.push(outChunk);
            }

            this.buffer = this.buffer.slice(this.chunkSize);
            this.chunkCount++;
        }

        callback();
    }

    _flush(callback) {
        if (this.buffer.length > 0) {
            // O último chunk nunca é exato e nunca é encriptado pelo algoritmo do deezer.
            let outChunk = this.buffer;
            if (this.dropBytes > 0) {
                const toDrop = Math.min(this.dropBytes, outChunk.length);
                outChunk = outChunk.slice(toDrop);
                this.dropBytes -= toDrop;
            }
            if (outChunk.length > 0) {
                this.push(outChunk);
            }
        }
        callback();
    }
}

module.exports = { DeezerDecryptor };
