const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./src/routes/api');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de Log para Debug
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// CORS (Temporariamente aberto para debug)
app.use(cors());

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
