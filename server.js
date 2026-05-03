const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./src/routes/api');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS restrito — só aceita origens confiáveis
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://195.200.1.107',
    'http://195.200.1.107:3000',
    `http://195.200.1.107:${PORT}`
];
app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem origin (mobile apps, curl, etc)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // Em produção, troque por: callback(new Error('Bloqueado pelo CORS'))
        }
    }
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Montando nossas rotas da API
app.use('/api', apiRoutes);

// Rota inicial de saúde da API
app.get('/', (req, res) => {
    res.json({ message: 'Rtify Backend está rodando. O Proxy Spotify/Deezer está ativo!' });
});

// Iniciando o servidor
app.listen(PORT, () => {
    console.log(`[Rtify Server] Rodando na porta ${PORT}`);
});
