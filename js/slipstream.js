const API_BASE = 'http://192.168.1.25:3111';

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

// Function to play video on the TV
async function playVideo(watchPath) {
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '<h2 style="margin-top:50px;">Loading stream...</h2>';

    try {
        const response = await fetch(`${API_BASE}/watch?path=${encodeURIComponent(watchPath)}`);
        const { streamUrl } = await response.json();

        if (streamUrl) {
            // Using a standard video tag; webOS 3.0+ supports HLS (.m3u8) natively
            resultsList.innerHTML = `
                <div class="video-wrapper">
                    <video id="main-player" controls autoplay style="width:100%; max-height:80vh;">
                        <source src="${streamUrl}" type="application/x-mpegURL">
                    </video>
                    <div style="margin-top:20px;">
                        <button id="back-to-search" class="nav-button" tabindex="0">Back to Search</button>
                    </div>
                </div>
            `;
            // Focus the back button so the remote can immediately interact
            document.getElementById('back-to-search').focus();
            document.getElementById('back-to-search').addEventListener('click', () => location.reload());
        }
    } catch (err) {
        resultsList.innerHTML = '<h2>Failed to load video source.</h2>';
        console.error(err);
    }
}

async function showDetails(path, element) {
    logDebug(`Fetching details for: ${path}`);

    let panel = document.getElementById('details-panel');
    if (!panel) {
        document.body.insertAdjacentHTML('beforeend', '<div id="details-panel"></div>');
        panel = document.getElementById('details-panel');
    }

    const cards = Array.from(document.querySelectorAll('.movie-card'));
    const index = cards.indexOf(element);
    const col = (index % 5) + 1;

    // Mark the selected card for the CSS "unblur"
    element.classList.add('selected-for-details');
    document.querySelector('.container').classList.add('blurred');
    
    // Add the panel to HTML if it doesn't exist
    panel.className = '';
    panel.classList.add(col > 3 ? 'panel-left' : 'panel-right');
    panel.classList.add('active'); 

    try {
        const response = await fetch(`${API_BASE}/details?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        logDebug(`Response Status: ${response.status}`);

        panel.innerHTML = `
            <div class="details-content">
                <h1>${data.title}</h1>
                <p>${data.description}</p>
                <ul class="metadata-list">
                    <li><strong>Genres:</strong> ${data.genres}</li>
                    <li><strong>Released:</strong> ${data.released}</li>
                    <li><strong>Cast:</strong> ${data.casts}</li>
                </ul>
            </div>
            <button id="watch-now" class="watch-now-btn" tabindex="0">WATCH NOW</button>
        `;

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
                <div class="movie-card" tabindex="0" data-path="${item.href}"">
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
            if (currentIndex !== -1) {
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
            } else if (currentIndex !== -1 && cards[currentIndex + 1]) {
                e.preventDefault();
                cards[currentIndex + 1].focus();
            }
            break;

        case 'ArrowLeft':
            if (active.id === 'search-button') {
                document.getElementById('search-input').focus();
            } else if (currentIndex !== -1 && cards[currentIndex - 1]) {
                e.preventDefault();
                cards[currentIndex - 1].focus();
            }
            break;

        case 'Enter':
            if (active.id === 'search-button' || active.id === 'search-input') {
                performSearch();
            }
            if (active.classList.contains('movie-card')) {
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
                if (active.classList.contains('movie-card')) {
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
    
    // document.querySelector('.container').classList.remove('blurred');
    // document.getElementById('details-panel').style.display = 'none';

    // document.querySelectorAll('.selected-for-details').forEach(el => el.classList.remove('selected-for-details'));
    // Return focus to the movie card that was originally selected
    // const cards = Array.from(document.querySelectorAll('.movie-card'));
    // cards[currentIndex].focus();
}

// Auto-focus search on launch
window.onload = () => document.getElementById('search-input').focus();
