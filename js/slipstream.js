const API_BASE = 'http://192.168.1.25:3111';
let currentShowData = null;

function logDebug(msg) {
    const table = document.getElementById('debug-table');
    if (table) {
        const row = table.insertRow(0); // Insert at the very top
        const cell = row.insertCell(0);
        const now = new Date().toLocaleTimeString();
        cell.style.padding = "10px";
        cell.style.borderBottom = "1px solid #222";
        cell.innerHTML = `<span style="color:#888;">[${now}]</span> ${msg}`;
    }
}

async function playVideo(epPath) {
    logDebug(`Extracting stream for: ${epPath}`);
    
    try {
        // We'll create this /extract-stream endpoint next
        const res = await fetch(`${API_BASE}/extract-stream?path=${encodeURIComponent(epPath)}`);
        const { streamUrl } = await res.json();

        if (streamUrl) {
            const resultsList = document.getElementById('results-list');
            resultsList.innerHTML = `
                <div class="video-container">
                    <video id="tv-player" controls autoplay style="width:100%; height:80vh;">
                        <source src="${streamUrl}" type="application/x-mpegURL">
                    </video>
                    <button id="exit-player" class="nav-button" tabindex="0">CLOSE PLAYER</button>
                </div>
            `;
            document.getElementById('exit-player').focus();
        }
    } catch (err) {
        logDebug("Stream extraction failed.");
    }
}

async function showDetails(path, mediaId, card) {
    logDebug(`Fetching details for: ${path}`);

    let panel = document.getElementById('details-panel');
    if (!panel) {
        document.body.insertAdjacentHTML('beforeend', '<div id="details-panel"></div>');
        panel = document.getElementById('details-panel');
    }

    const cards = Array.from(document.querySelectorAll('.movie-card'));
    const index = cards.indexOf(card);
    const col = (index % 5) + 1;

    // Mark the selected card for the CSS "unblur"
    card.classList.add('selected-for-details');
    document.querySelector('.container').classList.add('blurred');
    
    panel.className = '';
    panel.classList.add(col > 3 ? 'panel-left' : 'panel-right');

    try {
        const response = await fetch(`${API_BASE}/details?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        currentShowData = data;

        logDebug(`Response Status: ${response.status}`);

        panel.innerHTML = `
            <header class="details-header">
                <button id="watch-now" class="watch-now-btn" tabindex="0">WATCH NOW</button>
                <h1 class="details-title">${data.title}</h1>
            </header>

            <div class="details-body">
                <p class="details-desc">${data.description}</p>
                
                <div class="details-meta-row">
                    <div class="meta-item"><strong>Genre:</strong> ${data.genres || 'N/A'}</div>
                    <div class="meta-item"><strong>Released:</strong> ${data.released || 'N/A'}</div>
                    <div class="meta-item"><strong>Cast:</strong> ${data.casts || 'N/A'}</div>
                </div>

                <div id="selectors-area">
                </div>
            </div>
        `;

        const selectorArea = document.getElementById('selectors-area');
    
        if (data.seasons && data.seasons.length > 0) {
            selectorArea.innerHTML = `
                <div class="selector-label">Seasons</div>
                <div class="season-row">
                    ${data.seasons.map(s => `
                        <button class="season-btn" tabindex="0" data-season="${s.number}">
                            S${s.number}
                        </button>
                    `).join('')}
                </div>
                <div id="episode-list-container"></div>
            `;
            
            // Pass the actual number of the first season found (usually "1")
            renderEpisodes(data.seasons[0].number);
        } else {
            logDebug("Movie mode: No seasons found.");
            selectorArea.innerHTML = '<div class="selector-label">Movie Mode</div>';
        }

        // Activate panel and blur background
        panel.classList.add('active');
        document.querySelector('.container').classList.add('blurred');
        
        setTimeout(() => {
            const watchBtn = document.getElementById('watch-now');
            if (watchBtn) watchBtn.focus();
        }, 400); // Wait for the transition to finish

    } catch (err) {
        logDebug(`DETAILS ERROR: ${err.message}`);
    }
}

// Search execution logic
const performSearch = async () => {
    const query = document.getElementById('search-input').value;
    logDebug(`Attempting search for: ${query}`);
    logDebug(`Target URL: ${API_BASE}/search?keyword=${query}`);
    if (!query) return;

    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '<h2>Searching...</h2>';

    try {
        const response = await fetch(`${API_BASE}/search?keyword=${encodeURIComponent(query)}`);
        logDebug(`Response Status: ${response.status}`);
        const data = await response.json();
        if (Array.isArray(data)) {
            logDebug(`Loaded ${data.length} items`);
            resultsList.innerHTML = data.map(item => `
                <div class="movie-card" tabindex="0" data-path="${item.href}" data-id="${item.id}">
                    <img src="${item.image}" alt="${item.title}">
                    <div class="card-info">
                        <h4>${item.title}</h4>
                    <p>${item.quality} | ${item.metadata}</p>
                    </div>
                </div>
            `).join('');
        } else {
            // This handles the { error: "..." } object sent by the server
            logDebug(`Server Error: ${data.error || 'Unknown error'}`);
            resultsList.innerHTML = `<h2>Search failed: ${data.error}</h2>`;
        }

        const firstCard = document.querySelector('.movie-card');
        if (firstCard) { firstCard.focus(); }
    } catch (err) {
        resultsList.innerHTML = '<h2>Error connecting to Slipstream server.</h2>';
        logDebug(`FETCH ERROR: ${err.message}`);
        console.error(err);
    }
};

window.renderEpisodes = function(seasonNum) {
    const container = document.getElementById('episode-list-container');
    const eps = currentShowData.episodes[seasonNum];
    
    container.innerHTML = `
        <div class="selector-label">Episodes</div>
        <div class="episode-list">
            ${eps.map(ep => `
                <button class="episode-btn" tabindex="0" data-href="${ep.href}">
                    <span class="ep-num">EP ${ep.num}:</span> ${ep.title}
                </button>
            `).join('')}
        </div>
    `;
};

window.loadServers = async function(eid, epPath) {
    const container = document.getElementById('server-picker');
    container.innerHTML = "<span>Loading Servers...</span>";

    try {
        const res = await fetch(`${API_BASE}/servers?eid=${eid}&path=${encodeURIComponent(epPath)}`);
        const servers = await res.json();

        container.innerHTML = `
            <div class="selector-label">Servers</div>
            <div class="server-row">
                ${servers.map(s => `
                    <button class="server-btn" tabindex="0" data-lid="${s.linkId}" data-sid="${s.id}">
                        ${s.name}
                    </button>
                `).join('')}
            </div>
        `;
    } catch (e) {
        container.innerHTML = "<span>Servers unavailable</span>";
    }
};

// Keyboard & D-Pad Logic
document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const cards = Array.from(document.querySelectorAll('.movie-card'));
    const currentIndex = cards.indexOf(active);
    const cols = 5;

    switch (e.key) {
        case 'ArrowDown':
            if (active.id === 'search-input' || active.id === 'search-button') {
                if (cards.length > 0) {
                    e.preventDefault();
                    cards[0].focus();
                    cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else if (active.id === 'watch-now') {
                e.preventDefault();
                const firstSeason = document.querySelector('.season-btn');
                if (firstSeason) firstSeason.focus();
            } 
            else if (active.classList.contains('season-btn')) {
                e.preventDefault();
                const firstEp = document.querySelector('.episode-btn');
                if (firstEp) firstEp.focus();
            }
            else if (active.classList.contains('episode-btn')) {
                const eps = Array.from(document.querySelectorAll('.episode-btn'));
                const i = eps.indexOf(active);
                if (eps[i + 1]) {
                    e.preventDefault();
                    eps[i + 1].focus();
                    eps[i + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else if (currentIndex !== -1) {
                const nextIndex = currentIndex + cols;
                if (cards[nextIndex]) {
                    e.preventDefault();
                    cards[nextIndex].focus();
                    cards[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
            break;

        case 'ArrowUp':
            if (active.classList.contains('episode-btn')) {
                const eps = Array.from(document.querySelectorAll('.episode-btn'));
                const i = eps.indexOf(active);
                if (i === 0) { // If at first episode, go up to seasons
                    e.preventDefault();
                    document.querySelector('.season-btn').focus();
                } else {
                    e.preventDefault();
                    eps[i - 1].focus();
                }
            }
            else if (active.classList.contains('season-btn')) {
                e.preventDefault();
                document.getElementById('watch-now').focus();
            }
            else if (currentIndex !== -1) {
                const prevIndex = currentIndex - cols;
                if (prevIndex >= 0) {
                    e.preventDefault();
                    cards[prevIndex].focus();
                    cards[prevIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    e.preventDefault();
                    document.getElementById('search-input').focus();
                }
            }
            break;

        case 'ArrowRight':
            if (active.id === 'search-input') {
                // Focus button if at end of text
                if (active.selectionStart === active.value.length) {
                    document.getElementById('search-button').focus();
                }
            } else if (active.classList.contains('season-btn')) {
                const seasons = Array.from(document.querySelectorAll('.season-btn'));
                const i = seasons.indexOf(active);
                if (seasons[i + 1]) {
                    e.preventDefault();
                    seasons[i + 1].focus();
                }
            } else if (currentIndex !== -1 && cards[currentIndex + 1]) {
                e.preventDefault();
                cards[currentIndex + 1].focus();
            }
            break;

        case 'ArrowLeft':
            if (active.id === 'search-button') {
                document.getElementById('search-input').focus();
            } else if (active.classList.contains('season-btn')) {
                const seasons = Array.from(document.querySelectorAll('.season-btn'));
                const i = seasons.indexOf(active);
                if (seasons[i - 1]) {
                    e.preventDefault();
                    seasons[i - 1].focus();
                }
            } else if (currentIndex !== -1 && cards[currentIndex - 1]) {
                e.preventDefault();
                cards[currentIndex - 1].focus();
            }
            break;

        case 'Enter':
            if (active.id === 'search-button' || active.id === 'search-input') {
                performSearch();
            } else if (active.classList.contains('season-btn')) {
                const sNum = active.getAttribute('data-season');
                renderEpisodes(sNum);
            } else if (active.classList.contains('episode-btn')) {
                const href = active.getAttribute('data-href');
                playVideo(href);
            } else if (active.classList.contains('movie-card')) {
                const path = active.getAttribute('data-path');
                const mediaId = card.getAttribute('data-id');
                showDetails(path, mediaId, cards[currentIndex]);
            }
            break;

        case 'Back':
        case 'Escape':
            handleBackAction(e, currentIndex);
            break;

        // Special listener for the numeric code webOS uses
        default:
            if (e.keyCode === 461) { // 461 is the magic LG Back button code
                handleBackAction(e, currentIndex);
            }
            if (e.keyCode === 13) {
                if (active.classList.contains('movie-card')) {
                    const path = active.getAttribute('data-path');
                    const mediaId = card.getAttribute('data-id');
                    showDetails(path, mediaId, cards[currentIndex]);
                }
            }
            break;
    }
});

function handleBackAction(e, currentIndex) {
    const panel = document.getElementById('details-panel');
    const isPanelActive = panel && panel.classList.contains('active');

    if (isPanelActive) {
        // 1. If panel is open, close it
        e.preventDefault();
        closeDetails(currentIndex);
        logDebug("Back pressed: Closing details panel");
    } 
    else if (currentIndex !== -1) {
        // 2. If in the grid (but no panel), go to search bar
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        searchInput.focus();
        
        const grid = document.getElementById('results-list');
        if (grid) grid.scrollTo({ top: 0, behavior: 'smooth' });
        
        logDebug("Back pressed: Returning to search bar");
    }
    // 3. Otherwise, let it bubble up (allows app exit from search bar)
}

function closeDetails(currentIndex) {
    const panel = document.getElementById('details-panel');
    const container = document.querySelector('.container');
    const card = document.querySelector('.selected-for-details')

    if (panel) {
        panel.classList.remove('active');
        container.classList.remove('blurred');        
        card.classList.remove('selected-for-details')
        card.focus()
    }
}

// Auto-focus search on launch
window.onload = () => document.getElementById('search-input').focus();
