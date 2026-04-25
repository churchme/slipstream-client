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
                <div class="movie-card" tabindex="0" onclick="playVideo('${item.href}')">
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

document.getElementById('search-button').addEventListener('click', performSearch);

// Keyboard & D-Pad Logic
document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const cards = Array.from(document.querySelectorAll('.movie-card'));
    const currentIndex = cards.indexOf(active);

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
                    cards[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            break;

        case 'ArrowUp':
            if (currentIndex !== -1) {
                const prevIndex = currentIndex - cols;
                if (prevIndex >= 0) {
                    e.preventDefault();
                    cards[prevIndex].focus();
                    cards[prevIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    e.preventDefault();
                    document.getElementById('search-input').focus();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            if (active.id === 'search-button') {
                performSearch();
            }
            break;
    }
});

// Auto-focus search on launch
window.onload = () => document.getElementById('search-input').focus();
