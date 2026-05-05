const API_BASE = 'http://192.168.1.25:3111';
let currentShowData = null;

window.onerror = function(message, source, lineno, colno, error) {
    logDebug(`CRASH: ${message} at ${source}:${lineno}`);
};

window.addEventListener('message', (event) => {
    logDebug(`IFRAME MSG: ${JSON.stringify(event.data)}`);
});

window.addEventListener('securitypolicyviolation', (e) => {
    logDebug(`CSP Violation: ${e.blockedURI} - ${e.violatedDirective}`);
});

// 1. Intercept 'fetch' calls
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const url = args[0];
    logDebug(`[FETCH REQUEST] -> ${url}`);
    return originalFetch(...args);
};

// 2. Intercept 'XMLHttpRequest' (used by Hls.js and older scripts)
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
    logDebug(`[XHR REQUEST] ${method} -> ${url}`);
    return originalOpen.apply(this, arguments);
};

async function logDebug(msg) {
    console.log(msg); // Local console
    // Send to your server terminal
    fetch(`${API_BASE}/tv-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'info', message: msg })
    }).catch(() => {});
}

async function startWatching(path) {
    // 1. Visual feedback for the user
    const watchBtn = document.getElementById('watch-now');
    const originalText = watchBtn.innerText;
    watchBtn.innerText = "LOADING...";
    watchBtn.style.background = "#555";

    try {
        logDebug(`Extracting stream for: ${path}`);
        const res = await fetch(`${API_BASE}/extract-stream?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        
        if (data.iframeUrl) {
            initializePlayer(data.iframeUrl);
        } else {
            throw new Error("No URL returned");
        }
    } catch (e) {
        logDebug("Extraction failed: " + e.message);
        watchBtn.innerText = "ERROR - RETRY?";
        watchBtn.style.background = "red";
    } finally {
        // Reset button if player didn't open or after a delay
        setTimeout(() => {
            watchBtn.innerText = originalText;
            watchBtn.style.background = "";
        }, 3000);
    }
}

// async function initializePlayer(directM3u8Url) {
//     const resultsList = document.getElementById('results-list');
//     resultsList.innerHTML = `
//         <div class="player-wrapper" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;z-index:9999;">
//             <video id="video-player" style="width:100%;height:100%;"></video>
//             <button id="close-player" class="nav-button" style="position:absolute;top:20px;right:20px;" tabindex="0">✕</button>
//         </div>
//     `;

//     const video = document.getElementById('video-player');
//     const proxiedUrl = `${API_BASE}/proxy-stream?url=${encodeURIComponent(directM3u8Url)}`;

//     if (Hls.isSupported()) {
//         const hls = new Hls({
//             // Ensure fragments (chunks) are also proxied if they have Referer checks
//             xhrSetup: function (xhr, url) {
//                 // If the chunk URL is external, wrap it in our proxy
//                 if (url.indexOf('http') === 0 && url.indexOf(API_BASE) === -1) {
//                     const newUrl = `${API_BASE}/proxy-stream?url=${encodeURIComponent(url)}`;
//                     xhr.open('GET', newUrl, true);
//                 }
//             }
//         });
//         hls.loadSource(proxiedUrl);
//         hls.attachMedia(video);
//         hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
//     } else {

//     }

//     document.getElementById('close-player').focus();
//     document.getElementById('close-player').onclick = () => location.reload();
// }

function initializePlayer(iframeUrl) {
    logDebug(`Attempting to load Vidfast: ${iframeUrl}`);
    // 1. Create the high-z-index overlay
    const overlay = document.createElement('div');
    overlay.id = 'video-overlay';
    // Center the video container vertically using flex
    overlay.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000; z-index:9998; display:flex; align-items:center; justify-content:center;";
    
    overlay.innerHTML = `
        <div style="position: relative; padding-bottom: 56.25%; height: 0; width: 100%; max-width: 100vw;">
          <iframe
            src="${iframeUrl}"
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
            frameborder="0"
            allowfullscreen
            allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-forms allow-scripts allow-pointers allow-same-origin allow-presentation"
          ></iframe>
        </div>

        <!-- Exit button placed outside the aspect container so it's always at the top-right -->
        <button id="exit-player" style="position:absolute; top:30px; right:30px; padding:20px; background:rgba(204, 0, 0, 0.8); color:white; border:none; border-radius:50%; font-size:24px; font-weight:bold; cursor:pointer; z-index:10001;" tabindex="0">✕</button>
    `;
    
    document.body.appendChild(overlay);

    const exitBtn = document.getElementById('exit-player');
    exitBtn.focus();

    exitBtn.onclick = () => {
        document.body.removeChild(overlay);
        // Restore focus to the watch button
        document.getElementById('watch-now').focus();
    };

    const iframe = overlay.querySelector('iframe');
    // Wait for iframe to load, then try to focus it
    iframe.onload = () => {
        iframe.focus();
        logDebug("Iframe loaded, attempting focus for fetch clearance.");
    };
}

async function showDetails(path, card) {
    logDebug(`Fetching details for: ${path}`);

    let panel = document.getElementById('details-panel');
    if (!panel) {
        document.body.insertAdjacentHTML('beforeend', '<div id="details-panel"></div>');
        panel = document.getElementById('details-panel');
    }

    const cards = Array.from(document.querySelectorAll('.movie-card'));
    const index = cards.indexOf(card);
    const col = (index % 4) + 1;

    // Mark the selected card for the CSS "unblur"
    card.classList.add('selected-for-details');
    document.querySelector('.container').classList.add('blurred');
    
    panel.className = '';
    panel.classList.add(col > 2 ? 'panel-left' : 'panel-right');

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
                    ${createMetaRow('Genre', data.genres)}
                    ${createMetaRow('Year', data.year)}
                    ${createMetaRow('Status', data.status)}
                    ${createMetaRow('Rating', data.rating)}
                    ${createMetaRow('Country', data.country)}
                    ${createMetaRow('Cast', data.stars)}
                </div>

                <div id="selectors-area">
                    <div id="server-picker"></div>
                    <div id="episode-list-container"></div>
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
                <div class="movie-card" tabindex="0" data-path="${item.href}">
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
                <button class="episode-btn" tabindex="0" data-path="${ep.href}">
                    <span class="ep-num">EP ${ep.num}:</span> ${ep.title}
                </button>
            `).join('')}
        </div>
    `;
};

// Keyboard & D-Pad Logic
document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const cards = Array.from(document.querySelectorAll('.movie-card'));
    const currentIndex = cards.indexOf(active);
    const cols = 4;

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
            } else if (active.id === 'watch-now') {
                logDebug("Enter pressed");
                const path = cards[currentIndex].getAttribute('data-path');
                startWatching(path);
            } else if (active.classList.contains('season-btn')) {
                const sNum = active.getAttribute('data-season');
                renderEpisodes(sNum);
            } else if (active.classList.contains('episode-btn')) {
                const path = active.getAttribute('data-path');
                startWatching(path);
            } else if (active.classList.contains('movie-card')) {
                const path = active.getAttribute('data-path');
                showDetails(path, cards[currentIndex]);
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
                if (active.id === 'search-button' || active.id === 'search-input') {
                    performSearch();
                } else if (active.id === 'watch-now') {
                    logDebug("Enter pressed");
                    const path = cards[currentIndex].getAttribute('data-path');
                    startWatching(path);
                } else if (active.classList.contains('season-btn')) {
                    const sNum = active.getAttribute('data-season');
                    renderEpisodes(sNum);
                } else if (active.classList.contains('episode-btn')) {
                    const path = active.getAttribute('data-path');
                    startWatching(path);
                } else if (active.classList.contains('movie-card')) {
                    const path = active.getAttribute('data-path');
                    showDetails(path, cards[currentIndex]);
                }
            }
            break;
    }
});

function handleBackAction(e, currentIndex) {
    const panel = document.getElementById('details-panel');
    const isPanelActive = panel && panel.classList.contains('active');

    if (isPanelActive) {
        e.preventDefault();
        closeDetails(currentIndex);
    } 
    else if (currentIndex !== -1) {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        searchInput.focus();
        
        const grid = document.getElementById('results-list');
        if (grid) grid.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function createMetaRow(label, value) {
    if (!value || value === 'N/A' || value === '') return '';
    return `<div class="meta-item"><strong>${label}:</strong> ${value}</div>`;
}

// Auto-focus search on launch
window.onload = () => document.getElementById('search-input').focus();
