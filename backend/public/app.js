// ===== Rtify Player - App.js =====

const audio = new Audio();
let currentTracks = [];
let currentIndex = -1;
let isPlaying = false;

// DOM
const searchInput = document.getElementById('search-input');
const searchSpinner = document.getElementById('search-spinner');
const emptyState = document.getElementById('empty-state');
const resultsContainer = document.getElementById('results-container');
const resultsList = document.getElementById('results-list');
const resultsTitle = document.getElementById('results-title');

const playerBar = document.getElementById('player-bar');
const playerCover = document.getElementById('player-cover');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');

const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

const progressBar = document.getElementById('progress-bar');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const volumeBar = document.getElementById('volume-bar');

// ===== PESQUISA =====
let searchTimeout;

searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query.length < 2) {
        showEmpty();
        return;
    }
    searchTimeout = setTimeout(() => searchTracks(query), 400);
});

async function searchTracks(query) {
    searchSpinner.classList.remove('hidden');
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            currentTracks = json.data;
            renderResults(json.data);
        } else {
            showEmpty('Nenhum resultado encontrado');
        }
    } catch (e) {
        console.error('Erro na busca:', e);
        showEmpty('Erro ao buscar músicas');
    } finally {
        searchSpinner.classList.add('hidden');
    }
}

// ===== RENDERIZAR RESULTADOS =====
function renderResults(tracks) {
    emptyState.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
    resultsTitle.textContent = `${tracks.length} resultados`;

    resultsList.innerHTML = tracks.map((track, i) => `
        <div class="track-item ${i === currentIndex ? 'active' : ''}" data-index="${i}">
            <span class="track-index" onclick="playTrack(${i})">${i + 1}</span>
            <img class="track-cover" src="${track.cover_url || ''}" alt="" loading="lazy" onclick="playTrack(${i})">
            <div class="track-info" onclick="playTrack(${i})">
                <span class="track-name">${esc(track.name)}</span>
                <span class="track-artist">${esc(track.artist)}</span>
            </div>
            <span class="track-album" onclick="playTrack(${i})">${esc(track.album)}</span>
            <button class="btn-download" onclick="event.stopPropagation(); downloadTrack(${i})" title="Baixar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <span class="track-duration" onclick="playTrack(${i})">${formatTime(track.duration_ms / 1000)}</span>
        </div>
    `).join('');
}

function showEmpty(msg) {
    resultsContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    if (msg) {
        emptyState.querySelector('h2').textContent = msg;
        emptyState.querySelector('p').textContent = '';
    } else {
        emptyState.querySelector('h2').textContent = 'O que você quer ouvir?';
        emptyState.querySelector('p').textContent = 'Pesquise por qualquer música ou artista acima';
    }
}

// ===== REPRODUZIR =====
function playTrack(index) {
    if (index < 0 || index >= currentTracks.length) return;

    const track = currentTracks[index];
    currentIndex = index;

    if (!track.isrc) {
        console.error('Música sem ISRC:', track.name);
        return;
    }

    // Atualizar UI do Player
    playerBar.classList.remove('hidden');
    playerCover.src = track.cover_url || '';
    playerTitle.textContent = track.name;
    playerArtist.textContent = track.artist;

    // Marcar item ativo na lista
    document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.track-item[data-index="${index}"]`);
    if (activeEl) activeEl.classList.add('active');

    // Carregar áudio via nosso backend
    audio.src = `/api/stream?isrc=${encodeURIComponent(track.isrc)}`;
    audio.load();
    audio.play().then(() => {
        isPlaying = true;
        updatePlayIcon();
    }).catch(e => console.error('Erro ao reproduzir:', e));
}

// ===== CONTROLES =====
btnPlay.addEventListener('click', () => {
    if (!audio.src) return;
    if (isPlaying) {
        audio.pause();
    } else {
        audio.play();
    }
    isPlaying = !isPlaying;
    updatePlayIcon();
});

btnNext.addEventListener('click', () => {
    if (currentIndex < currentTracks.length - 1) playTrack(currentIndex + 1);
});

btnPrev.addEventListener('click', () => {
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
    } else if (currentIndex > 0) {
        playTrack(currentIndex - 1);
    }
});

// ===== PROGRESSO =====
audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressBar.value = pct;
    timeCurrent.textContent = formatTime(audio.currentTime);
    updateProgressColor(progressBar, pct);
});

audio.addEventListener('loadedmetadata', () => {
    timeTotal.textContent = formatTime(audio.duration);
    progressBar.max = 100;
});

audio.addEventListener('ended', () => {
    if (currentIndex < currentTracks.length - 1) {
        playTrack(currentIndex + 1);
    } else {
        isPlaying = false;
        updatePlayIcon();
    }
});

progressBar.addEventListener('input', () => {
    if (!audio.duration) return;
    audio.currentTime = (progressBar.value / 100) * audio.duration;
});

// ===== VOLUME =====
audio.volume = 0.8;

volumeBar.addEventListener('input', () => {
    audio.volume = volumeBar.value / 100;
    updateProgressColor(volumeBar, volumeBar.value);
});

// Init volume color
updateProgressColor(volumeBar, 80);

// ===== HELPERS =====
function updatePlayIcon() {
    iconPlay.classList.toggle('hidden', isPlaying);
    iconPause.classList.toggle('hidden', !isPlaying);
}

function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function updateProgressColor(el, pct) {
    el.style.background = `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`;
}

// ===== DOWNLOAD =====
async function downloadTrack(index) {
    const track = currentTracks[index];
    if (!track || !track.isrc) return;

    const btn = document.querySelector(`.track-item[data-index="${index}"] .btn-download`);
    if (btn) {
        btn.classList.add('downloading');
        btn.innerHTML = '<div class="mini-spinner"></div>';
    }

    try {
        const params = new URLSearchParams({
            isrc: track.isrc,
            name: track.name,
            artist: track.artist,
            album: track.album,
            cover: track.cover_url || ''
        });
        const res = await fetch(`/api/download?${params}`);
        const json = await res.json();

        if (json.success) {
            if (btn) {
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
                btn.classList.remove('downloading');
                btn.classList.add('downloaded');
                setTimeout(() => {
                    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
                    btn.classList.remove('downloaded');
                }, 3000);
            }
            console.log(`Download concluído: ${json.file}`);
        } else {
            throw new Error(json.error);
        }
    } catch (e) {
        console.error('Erro no download:', e);
        if (btn) {
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            btn.classList.remove('downloading');
            setTimeout(() => {
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
            }, 3000);
        }
    }
}

// Atalhos de teclado
document.addEventListener('keydown', (e) => {
    if (e.target === searchInput) return;
    if (e.code === 'Space') { e.preventDefault(); btnPlay.click(); }
    if (e.code === 'ArrowRight') { btnNext.click(); }
    if (e.code === 'ArrowLeft') { btnPrev.click(); }
});
