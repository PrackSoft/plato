// js/app.js - Plato App (con Global Tags y Tags en Collection)
import { openDB, getAllMovies, getTrashMovies, saveMovie, toggleWatching, moveMovieToTrash, restoreMovieFromTrash, permanentlyDeleteMovie, renameTermInAllMovies, saveExtraInfo, addYear, STORE_MOVIES } from './db.js';
import { searchYouTube } from './api/youtube.js';
import { renderMovies } from './render.js';
import { SEARCH_OPTIONS } from './channels.js';
import { initModal, openModal } from './modal.js';

// ---------------------- DOM elements ----------------------
const searchInput = document.getElementById('searchInput');
const resultsGrid = document.getElementById('resultsGrid');
const searchInBtn = document.getElementById('searchInBtn');
const searchInPanel = document.getElementById('searchInPanel');
const filterWatchingBtn = document.getElementById('filterWatchingBtn');
const filterFavoriteBtn = document.getElementById('filterFavoriteBtn');
const filterTrashBtn = document.getElementById('filterTrashBtn');
const filterCollectionBtn = document.getElementById('filterCollectionBtn');
const filterRelatedBtn = document.getElementById('filterRelatedBtn');
const termsBar = document.getElementById('termsBar');
const directorsBar = document.getElementById('directorsBar');
const actorsBar = document.getElementById('actorsBar');
const genresBar = document.getElementById('genresBar');
const yearsBar = document.getElementById('yearsBar');
const countriesBar = document.getElementById('countriesBar');
const languagesBar = document.getElementById('languagesBar');
const tagsBar = document.getElementById('tagsBar');
const toggleTermsBtn = document.getElementById('toggleTermsBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsSidebar = document.getElementById('settingsSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

// ---------------------- Global state ----------------------
let dbReady = openDB();
let currentSearchOptionId = "UCuVPpxrm2VAgpH3Ktln4HXg";

let activeWatchingFilter = false;
let activeFavoriteFilter = false;
let activeTrashFilter = false;
let activeRelatedFilter = 'exact';
let savedRelatedFilter = 'exact';
let activeCollectionFilter = false;
let activeTermFilter = null;
let activeDirectorFilter = null;
let activeActorFilter = null;
let activeGenreFilter = null;
let activeYearFilter = null;
let activeCountryFilter = null;
let activeLanguageFilter = null;
let activeTagFilter = null;

let availableTerms = [];
let availableDirector = [];
let availableActor = [];
let availableGenre = [];
let availableYear = [];
let availableCountry = [];
let availableLanguage = [];
let availableTags = [];
let currentSort = 'date';
let collectionsSortBy = 'all';

let searchOrder = 'relevance';
let searchDuration = 'long';
let searchCategoryFilter = 'movies';

// ---------------------- Helper: sincronizar window.activeTermFilter ----------------------
export function syncWindowTermFilter() {
    window.activeTermFilter = activeTermFilter;
}

export function getActiveTermFilter() {
    return activeTermFilter;
}

// ---------------------- Helper: ----------------------
async function getMovieFromDB(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readonly');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const req = store.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ---------------------- Helper: close panels ----------------------
function closeAllPanels() {
    searchInPanel.classList.add('hidden');
    const collectionsPanel = document.getElementById('collectionsPanel');
    if (collectionsPanel) collectionsPanel.classList.add('hidden');
    const relatedPanel = document.getElementById('relatedPanel');
    if (relatedPanel) relatedPanel.classList.add('hidden');
}

function closePanelWithDelay(panel) {
    setTimeout(() => panel.classList.add('hidden'), 150);
}

function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'dropdown-header';
    header.textContent = 'Source';
    searchInPanel.appendChild(header);

    const searchInContainer = document.createElement('div');
    searchInContainer.className = 'search-in-container';
    
    const youtubeRadio = document.createElement('input');
    youtubeRadio.type = 'radio';
    youtubeRadio.name = 'searchIn';
    youtubeRadio.value = 'youtube';
    youtubeRadio.id = 'searchInYouTube';
    youtubeRadio.checked = (currentSearchOptionId !== 'plato_db');
    youtubeRadio.addEventListener('change', () => {
        if (youtubeRadio.checked) {
            currentSearchOptionId = 'UCuVPpxrm2VAgpH3Ktln4HXg';
            updateSearchInButtonText();
            searchInPanel.classList.add('hidden');
        }
    });
    
    const youtubeLabel = document.createElement('label');
    youtubeLabel.htmlFor = 'searchInYouTube';
    youtubeLabel.className = 'search-in-label';
    youtubeLabel.appendChild(youtubeRadio);
    youtubeLabel.appendChild(document.createTextNode(' YouTube'));
    searchInContainer.appendChild(youtubeLabel);
    
    const platoDbRadio = document.createElement('input');
    platoDbRadio.type = 'radio';
    platoDbRadio.name = 'searchIn';
    platoDbRadio.value = 'plato_db';
    platoDbRadio.id = 'searchInPlatoDB';
    platoDbRadio.checked = (currentSearchOptionId === 'plato_db');
    platoDbRadio.addEventListener('change', () => {
        if (platoDbRadio.checked) {
            currentSearchOptionId = 'plato_db';
            updateSearchInButtonText();
            searchInPanel.classList.add('hidden');
        }
    });
    
    const platoDbLabel = document.createElement('label');
    platoDbLabel.htmlFor = 'searchInPlatoDB';
    platoDbLabel.className = 'search-in-label';
    platoDbLabel.appendChild(platoDbRadio);
    platoDbLabel.appendChild(document.createTextNode(' Plato DB'));
    searchInContainer.appendChild(platoDbLabel);
    
    searchInPanel.appendChild(searchInContainer);
    
    const youtubeSection = document.createElement('div');
    youtubeSection.className = 'search-filters-section';
    youtubeSection.innerHTML = `
        <div class="settings-group">
            <label class="settings-label">Content type:</label>
            <div class="radio-group">
                <label><input type="radio" name="searchCategory" value="movies" ${searchCategoryFilter === 'movies' ? 'checked' : ''}> Movies only</label>
                <label><input type="radio" name="searchCategory" value="tvSeries" ${searchCategoryFilter === 'tvSeries' ? 'checked' : ''}> TV Series only</label>
            </div>
        </div>
        <div class="settings-group">
            <label class="settings-label">Order by:</label>
            <div class="radio-group">
                <label><input type="radio" name="searchOrder" value="relevance" ${searchOrder === 'relevance' ? 'checked' : ''}> Best match</label>
                <label><input type="radio" name="searchOrder" value="viewCount" ${searchOrder === 'viewCount' ? 'checked' : ''}> Most viewed</label>
                <label><input type="radio" name="searchOrder" value="rating" ${searchOrder === 'rating' ? 'checked' : ''}> Most liked</label>
            </div>
        </div>
        <div class="settings-group">
            <label class="settings-label">Duration:</label>
            <div class="radio-group">
                <label><input type="radio" name="searchDuration" value="long" ${searchDuration === 'long' ? 'checked' : ''}> Long (&gt;20 min)</label>
                <label><input type="radio" name="searchDuration" value="medium" ${searchDuration === 'medium' ? 'checked' : ''}> Medium (4-20 min)</label>
                <label><input type="radio" name="searchDuration" value="short" ${searchDuration === 'short' ? 'checked' : ''}> Short (&lt;4 min)</label>
                <label><input type="radio" name="searchDuration" value="any" ${searchDuration === 'any' ? 'checked' : ''}> Any duration</label>
            </div>
        </div>
        <div class="settings-group">
            <label class="settings-label">Date range (optional):</label>
            <div class="date-range-container">
                <div class="date-input-wrapper">
                    <label class="date-label">From:</label>
                    <input type="date" id="dateFrom" class="date-input">
                </div>
                <div class="date-input-wrapper">
                    <label class="date-label">To:</label>
                    <input type="date" id="dateTo" class="date-input">
                </div>
            </div>
        </div>
    `;
    searchInPanel.appendChild(youtubeSection);

    const categoryRadios = searchInPanel.querySelectorAll('input[name="searchCategory"]');
    categoryRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) saveSearchCategory(e.target.value);
        });
    });
    const orderRadios = searchInPanel.querySelectorAll('input[name="searchOrder"]');
    orderRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) saveSearchOrder(e.target.value);
        });
    });
    const durationRadios = searchInPanel.querySelectorAll('input[name="searchDuration"]');
    durationRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) saveSearchDuration(e.target.value);
        });
    });

    function updateSearchInButtonText() {
        if (currentSearchOptionId === 'plato_db') {
            searchInBtn.innerHTML = `
                <span class="material-symbols-outlined">storage</span>
                Plato DB
                <span class="material-symbols-outlined">arrow_drop_down</span>
            `;
        } else {
            const option = SEARCH_OPTIONS.find(opt => opt.id === currentSearchOptionId);
            const label = option ? option.name : 'Free Movies';
            searchInBtn.innerHTML = `
                <span class="material-symbols-outlined">subscriptions</span>
                ${label}
                <span class="material-symbols-outlined">arrow_drop_down</span>
            `;
        }
    }

    if (searchInBtn) {
        searchInBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const collectionsPanel = document.getElementById('collectionsPanel');
            if (collectionsPanel) collectionsPanel.classList.add('hidden');
            const relatedPanel = document.getElementById('relatedPanel');
            if (relatedPanel) relatedPanel.classList.add('hidden');
            searchInPanel.classList.toggle('hidden');
        });
    }

    document.addEventListener('click', (e) => {
        if (searchInBtn && searchInPanel && !searchInBtn.contains(e.target) && !searchInPanel.contains(e.target)) {
            searchInPanel.classList.add('hidden');
        }
    });

    updateSearchInButtonText();
}

// ---------------------- Build Related dropdown ----------------------
function buildRelatedDropdown() {
    if (!filterRelatedBtn) return;
    
    const panel = document.getElementById('relatedPanel');
    if (!panel) return;
    
    const options = [
        { value: 'exact', label: 'Exact', icon: 'verified' },
        { value: 'related', label: 'Related', icon: 'verified_off' }
    ];
    
    panel.innerHTML = `
        <div class="dropdown-header">Search term type</div>
        ${options.map(opt => `
            <label data-value="${opt.value}">
                <span class="material-symbols-outlined">${opt.icon}</span>
                ${opt.label}
            </label>
        `).join('')}
    `;
    
    panel.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = label.dataset.value;
            if (value && value !== activeRelatedFilter) {
                if (activeWatchingFilter || activeFavoriteFilter || activeTrashFilter || activeCollectionFilter) {
                    activeWatchingFilter = false;
                    activeFavoriteFilter = false;
                    activeTrashFilter = false;
                    activeCollectionFilter = false;
                    updateFilterButtonsUI();
                    updateCollectionButtonText();
                }
                activeRelatedFilter = value;
                savedRelatedFilter = value;
                updateRelatedButtonText();
                loadAndDisplayAll();
            }
            panel.classList.add('hidden');
        });
    });
    
    filterRelatedBtn.innerHTML = `
        <span class="related-main">
            <span class="material-symbols-outlined related-icon">${activeRelatedFilter === 'exact' ? 'verified' : 'verified_off'}</span>
            <span class="related-label">${activeRelatedFilter === 'exact' ? 'Exact' : 'Related'}</span>
        </span>
        <span class="related-arrow">
            <span class="material-symbols-outlined">arrow_drop_down</span>
        </span>
    `;
    
    const mainPart = filterRelatedBtn.querySelector('.related-main');
    const arrowPart = filterRelatedBtn.querySelector('.related-arrow');
    
    if (mainPart) {
        mainPart.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeWatchingFilter || activeFavoriteFilter || activeTrashFilter || activeCollectionFilter) {
                activeWatchingFilter = false;
                activeFavoriteFilter = false;
                activeTrashFilter = false;
                activeCollectionFilter = false;
                updateFilterButtonsUI();
                updateCollectionButtonText();
                activeRelatedFilter = savedRelatedFilter;
                updateRelatedButtonText();
                loadAndDisplayAll();
            } else {
                panel.classList.toggle('hidden');
            }
        });
    }
    
    if (arrowPart) {
        arrowPart.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('hidden');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (!filterRelatedBtn.contains(e.target) && !panel.contains(e.target)) {
            panel.classList.add('hidden');
        }
    });
    
    updateRelatedButtonText();
}

function updateRelatedButtonText() {
    if (!filterRelatedBtn) return;
    let label = 'Exact';
    let icon = 'verified';
    if (activeRelatedFilter === 'related') {
        label = 'Related';
        icon = 'verified_off';
    }
    const mainPart = filterRelatedBtn.querySelector('.related-main');
    if (mainPart) {
        const iconSpan = mainPart.querySelector('.related-icon');
        const labelSpan = mainPart.querySelector('.related-label');
        if (iconSpan) iconSpan.textContent = icon;
        if (labelSpan) labelSpan.textContent = label;
    } else {
        filterRelatedBtn.innerHTML = `
            <span class="related-main">
                <span class="material-symbols-outlined related-icon">${icon}</span>
                <span class="related-label">${label}</span>
            </span>
            <span class="related-arrow">
                <span class="material-symbols-outlined">arrow_drop_down</span>
            </span>
        `;
    }
}

// ---------------------- Build Collection dropdown ----------------------
function buildCollectionDropdown() {
    if (!filterCollectionBtn) return;
    
    const panel = document.getElementById('collectionsPanel');
    if (!panel) return;
    
    const options = [
        { value: 'all', label: 'Collection', icon: 'join_inner' },
        { value: 'tags', label: 'Tags', icon: 'sell' },
        { value: 'directors', label: 'Director', icon: 'person' },
        { value: 'actors', label: 'Actor', icon: 'group' },
        { value: 'genres', label: 'Genre', icon: 'theater_comedy' },
        { value: 'years', label: 'Year', icon: 'calendar_month' },
        { value: 'countries', label: 'Country', icon: 'flag' },
        { value: 'languages', label: 'Language', icon: 'translate' }
    ];
    
    panel.innerHTML = `
        <div class="dropdown-header">Group by</div>
        ${options.map(opt => `
            <label data-value="${opt.value}">
                <span class="material-symbols-outlined">${opt.icon}</span>
                ${opt.label}
            </label>
        `).join('')}
    `;
    
    filterCollectionBtn.innerHTML = `
        <span class="collections-main">
            <span class="material-symbols-outlined collections-icon">join_inner</span>
            <span class="collections-label">Collection</span>
        </span>
        <span class="collections-arrow">
            <span class="material-symbols-outlined">arrow_drop_down</span>
        </span>
    `;
    
    const mainPart = filterCollectionBtn.querySelector('.collections-main');
    const arrowPart = filterCollectionBtn.querySelector('.collections-arrow');
    
    if (mainPart) {
        mainPart.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCollectionFilter();
        });
    }
    
    if (arrowPart) {
        arrowPart.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('hidden');
        });
    }
    
    panel.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = label.dataset.value;
            if (value && value !== collectionsSortBy) {
                collectionsSortBy = value;
                updateCollectionButtonText();
                
                if (!activeCollectionFilter) {
                    activeCollectionFilter = true;
                    updateFilterButtonsUI();
                    if (toggleTermsBtn) toggleTermsBtn.classList.remove('active');
                    if (termsBar) termsBar.classList.add('hidden');
                }
                
                loadAndDisplayAll();
            }
            panel.classList.add('hidden');
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!filterCollectionBtn.contains(e.target) && !panel.contains(e.target)) {
            panel.classList.add('hidden');
        }
    });
    
    updateCollectionButtonText();
}

function updateCollectionButtonText() {
    if (!filterCollectionBtn) return;
    
    const mainPart = filterCollectionBtn.querySelector('.collections-main');
    if (!mainPart) return;
    
    const iconSpan = mainPart.querySelector('.collections-icon');
    const labelSpan = mainPart.querySelector('.collections-label');
    
    if (labelSpan) {
        switch (collectionsSortBy) {
            case 'all':
                labelSpan.textContent = 'Collection';
                break;
            case 'tags':
                labelSpan.textContent = 'Tags';
                break;
            case 'directors':
                labelSpan.textContent = 'Director';
                break;
            case 'actors':
                labelSpan.textContent = 'Actor';
                break;
            case 'genres':
                labelSpan.textContent = 'Genre';
                break;
            case 'years':
                labelSpan.textContent = 'Year';
                break;
            case 'countries':
                labelSpan.textContent = 'Country';
                break;
            case 'languages':
                labelSpan.textContent = 'Language';
                break;
        }
    }
    
    if (!activeCollectionFilter) {
        switch (collectionsSortBy) {
            case 'all':
                if (iconSpan) iconSpan.textContent = 'join_inner';
                break;
            case 'tags':
                if (iconSpan) iconSpan.textContent = 'sell';
                break;
            case 'directors':
                if (iconSpan) iconSpan.textContent = 'person';
                break;
            case 'actors':
                if (iconSpan) iconSpan.textContent = 'group';
                break;
            case 'genres':
                if (iconSpan) iconSpan.textContent = 'theater_comedy';
                break;
            case 'years':
                if (iconSpan) iconSpan.textContent = 'calendar_month';
                break;
            case 'countries':
                if (iconSpan) iconSpan.textContent = 'flag';
                break;
            case 'languages':
                if (iconSpan) iconSpan.textContent = 'translate';
                break;
        }
    } else {
        switch (collectionsSortBy) {
            case 'all':
                if (iconSpan) iconSpan.textContent = 'join_inner';
                break;
            case 'tags':
                if (iconSpan) iconSpan.textContent = 'sell';
                break;
            case 'directors':
                if (iconSpan) iconSpan.textContent = 'person';
                break;
            case 'actors':
                if (iconSpan) iconSpan.textContent = 'group';
                break;
            case 'genres':
                if (iconSpan) iconSpan.textContent = 'theater_comedy';
                break;
            case 'years':
                if (iconSpan) iconSpan.textContent = 'calendar_month';
                break;
            case 'countries':
                if (iconSpan) iconSpan.textContent = 'flag';
                break;
            case 'languages':
                if (iconSpan) iconSpan.textContent = 'translate';
                break;
        }
    }
}

// ---------------------- Sidebar functions ----------------------
function openSettingsSidebar() {
    settingsSidebar.classList.remove('hidden');
    sidebarOverlay.classList.remove('hidden');
}
function closeSettingsSidebar() {
    settingsSidebar.classList.add('hidden');
    sidebarOverlay.classList.add('hidden');
}
settingsBtn.addEventListener('click', openSettingsSidebar);
closeSidebarBtn.addEventListener('click', closeSettingsSidebar);
sidebarOverlay.addEventListener('click', closeSettingsSidebar);

function saveSearchOrder(value) {
    searchOrder = value;
    localStorage.setItem('plato_searchOrder', value);
}
function saveSearchDuration(value) {
    searchDuration = value;
    localStorage.setItem('plato_searchDuration', value);
}
function saveSearchCategory(value) {
    searchCategoryFilter = value;
    localStorage.setItem('plato_searchCategory', value);
}
function loadSearchPreferences() {
    const savedOrder = localStorage.getItem('plato_searchOrder');
    if (savedOrder && (savedOrder === 'relevance' || savedOrder === 'viewCount' || savedOrder === 'rating')) {
        searchOrder = savedOrder;
    }
    const savedDuration = localStorage.getItem('plato_searchDuration');
    if (savedDuration && (savedDuration === 'short' || savedDuration === 'medium' || savedDuration === 'long' || savedDuration === 'any')) {        
        searchDuration = savedDuration;
    }
    const savedCategory = localStorage.getItem('plato_searchCategory');
    if (savedCategory && (savedCategory === 'movies' || savedCategory === 'all')) {
        searchCategoryFilter = savedCategory;
    }
}

function buildSettingsSidebarContent() {
    const section = document.querySelector('.sidebar-section');
    if (!section) return;

    const hideLabels = localStorage.getItem('plato_hideLabels') === 'true';
    const compactMode = localStorage.getItem('plato_compactMode') === 'true';
    const hideTitle = localStorage.getItem('plato_hideTitle') === 'true';
    const hideStats = localStorage.getItem('plato_hideStats') === 'true';
    const cardQuality = localStorage.getItem('plato_cardQuality') || 'medium';
    const modalQuality = localStorage.getItem('plato_modalQuality') || 'high';
    const userChannel = localStorage.getItem('user_channel') || 'all';

    section.innerHTML = `
        <p class="settings-note">Future options: API key, theme, etc.</p>
        <hr style="border-color: var(--border-color); margin: 20px 0;">

        <h3>Scope</h3>
        <div class="settings-group">
            <label class="settings-label">Select YouTube channel</label>
            <div class="segmented-control" id="channelControl">
                <button data-channel="all" class="${userChannel === 'all' ? 'active' : ''}">All</button>
                <button data-channel="movies" class="${userChannel === 'movies' ? 'active' : ''}">Movies and TV</button>
            </div>
        </div>

        <hr style="border-color: var(--border-color); margin: 20px 0;">

        <h3>Compact mode</h3>
        <div class="settings-group">
            <label class="settings-label">Hide button labels</label>
            <div class="toggle-wrapper">
                <label class="toggle-switch">
                    <input type="checkbox" id="hideLabelsToggle" ${localStorage.getItem('plato_hideLabels') === 'true' ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">${localStorage.getItem('plato_hideLabels') === 'true' ? 'On' : 'Off'}</span>
            </div>
        </div>
        <div class="settings-group">
            <label class="settings-label">Hide header (title & sort)</label>
            <div class="toggle-wrapper">
                <label class="toggle-switch">
                    <input type="checkbox" id="compactModeToggle" ${compactMode ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">${compactMode ? 'On' : 'Off'}</span>
            </div>
        </div>
        <div class="settings-group">
            <label class="settings-label">Hide video title</label>
            <div class="toggle-wrapper">
                <label class="toggle-switch">
                    <input type="checkbox" id="hideTitleToggle" ${hideTitle ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">${hideTitle ? 'On' : 'Off'}</span>
            </div>
        </div>
        <div class="settings-group">
            <label class="settings-label">Hide stats (comments & likes)</label>
            <div class="toggle-wrapper">
                <label class="toggle-switch">
                    <input type="checkbox" id="hideStatsToggle" ${hideStats ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">${hideStats ? 'On' : 'Off'}</span>
            </div>
        </div>

        <hr style="border-color: var(--border-color); margin: 20px 0;">

        <h3>Resolution previews</h3>
        <div class="settings-group">
            <label class="settings-label">Cards</label>
            <div class="segmented-control" id="cardQualityControl">
                <button data-quality="default" class="${cardQuality === 'default' ? 'active' : ''}">Low</button>
                <button data-quality="medium" class="${cardQuality === 'medium' ? 'active' : ''}">Medium</button>
                <button data-quality="high" class="${cardQuality === 'high' ? 'active' : ''}">High</button>
                <button data-quality="maxres" class="${cardQuality === 'maxres' ? 'active' : ''}">Max</button>
            </div>
        </div>
        <div class="settings-group">
            <label class="settings-label">Modal</label>
            <div class="segmented-control" id="modalQualityControl">
                <button data-quality="default" class="${modalQuality === 'default' ? 'active' : ''}">Low</button>
                <button data-quality="medium" class="${modalQuality === 'medium' ? 'active' : ''}">Medium</button>
                <button data-quality="high" class="${modalQuality === 'high' ? 'active' : ''}">High</button>
                <button data-quality="maxres" class="${modalQuality === 'maxres' ? 'active' : ''}">Max</button>
            </div>
        </div>

        <hr style="border-color: var(--border-color); margin: 20px 0;">
    `;

    document.body.classList.toggle('hide-btn-labels', hideLabels);
    document.body.classList.toggle('compact-mode', compactMode);
    document.body.classList.toggle('hide-video-title', hideTitle);
    document.body.classList.toggle('hide-card-stats', hideStats);

    const toggle4 = document.getElementById('hideLabelsToggle');
    const label4 = toggle4?.parentElement?.parentElement?.querySelector('.toggle-label');
    if (toggle4) {
        toggle4.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            localStorage.setItem('plato_hideLabels', isChecked);
            document.body.classList.toggle('hide-btn-labels', isChecked);
            if (label4) label4.textContent = isChecked ? 'On' : 'Off';
        });
    }

    const toggle1 = document.getElementById('compactModeToggle');
    const label1 = toggle1?.parentElement?.parentElement?.querySelector('.toggle-label');
    if (toggle1) {
        toggle1.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            localStorage.setItem('plato_compactMode', isChecked);
            document.body.classList.toggle('compact-mode', isChecked);
            if (label1) label1.textContent = isChecked ? 'On' : 'Off';
        });
    }

    const toggle2 = document.getElementById('hideTitleToggle');
    const label2 = toggle2?.parentElement?.parentElement?.querySelector('.toggle-label');
    if (toggle2) {
        toggle2.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            localStorage.setItem('plato_hideTitle', isChecked);
            document.body.classList.toggle('hide-video-title', isChecked);
            if (label2) label2.textContent = isChecked ? 'On' : 'Off';
        });
    }

    const toggle3 = document.getElementById('hideStatsToggle');
    const label3 = toggle3?.parentElement?.parentElement?.querySelector('.toggle-label');
    if (toggle3) {
        toggle3.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            localStorage.setItem('plato_hideStats', isChecked);
            document.body.classList.toggle('hide-card-stats', isChecked);
            if (label3) label3.textContent = isChecked ? 'On' : 'Off';
        });
    }

    const channelControl = document.getElementById('channelControl');
    if (channelControl) {
        channelControl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const channel = btn.dataset.channel;
                localStorage.setItem('user_channel', channel);
                channelControl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    const cardControl = document.getElementById('cardQualityControl');
    if (cardControl) {
        cardControl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const quality = btn.dataset.quality;
                localStorage.setItem('plato_cardQuality', quality);
                cardControl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadAndDisplayAll();
            });
        });
    }

    const modalControl = document.getElementById('modalQualityControl');
    if (modalControl) {
        modalControl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const quality = btn.dataset.quality;
                localStorage.setItem('plato_modalQuality', quality);
                modalControl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
}

// ---------------------- Tags Bar functions ----------------------
export async function refreshAvailableTags() {
    const allMovies = await getAllMovies();
    const tagsSet = new Set();
    for (const movie of allMovies) {
        (movie.tags || []).forEach(t => tagsSet.add(t));
        (movie.directors || []).forEach(d => tagsSet.add(d));
        (movie.actors || []).forEach(a => tagsSet.add(a));
        (movie.genres || []).forEach(g => tagsSet.add(g));
        (movie.years || []).forEach(y => tagsSet.add(y));
        (movie.countries || []).forEach(c => tagsSet.add(c));
        (movie.languages || []).forEach(l => tagsSet.add(l));
    }
    availableTags = Array.from(tagsSet).sort();
}

function renderTagsBar() {
    if (!tagsBar) return;
    if (availableTags.length === 0) {
        tagsBar.innerHTML = '<div class="terms-placeholder">No tags yet.</div>';
        tagsBar.classList.remove('hidden');
        return;
    }
    tagsBar.classList.remove('hidden');
    const html = availableTags.map(name => `
        <button class="btn btn-secondary btn-sm ${activeTagFilter === name ? 'active' : ''}" data-tag="${escapeHtml(name)}">
            ${escapeHtml(name)}
            <span class="tag-edit material-symbols-outlined" data-tag="${escapeHtml(name)}" title="Edit tag globally.">edit</span>
            <span class="tag-delete" data-tag="${escapeHtml(name)}" title="Delete tag from all movies.">✖</span>
        </button>
    `).join('');
    tagsBar.innerHTML = html;

    document.querySelectorAll('#tagsBar .btn').forEach(btn => {
        const name = btn.dataset.tag;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-edit') || e.target.classList.contains('tag-delete')) return;
            if (activeTagFilter === name) activeTagFilter = null;
            else activeTagFilter = name;
            loadAndDisplayAll();
        });
    });

    document.querySelectorAll('.tag-edit').forEach(editSpan => {
        editSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oldName = editSpan.dataset.tag;
            const newName = prompt(`Edit tag "${oldName}":`, oldName);
            if (newName && newName !== oldName) {
                await renameTagInAllMovies(oldName, newName);
            }
        });
    });

    document.querySelectorAll('.tag-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const name = deleteSpan.dataset.tag;
            if (confirm(`Delete tag "${name}" from all movies?`)) {
                await deleteTagFromAllMovies(name);
            }
        });
    });
}

export async function renameTagInAllMovies(oldName, newName) {
    if (oldName === newName) return;
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.tags && movie.tags.includes(oldName)) {
            movie.tags = movie.tags.map(t => t === oldName ? newName : t);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
    await refreshAvailableTags();
    if (activeTagFilter === oldName) activeTagFilter = newName;
    loadAndDisplayAll();
}

export async function deleteTagFromAllMovies(tagName) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.tags && movie.tags.includes(tagName)) {
            movie.tags = movie.tags.filter(t => t !== tagName);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
    await refreshAvailableTags();
    if (activeTagFilter === tagName) activeTagFilter = null;
    loadAndDisplayAll();
}

// ---------------------- Funciones globales para renombrar/eliminar ----------------------
export async function renameDirectorInAllMovies(oldName, newName) {
    if (oldName === newName) return;
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.directors && movie.directors.includes(oldName)) {
            movie.directors = movie.directors.map(d => d === oldName ? newName : d);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function renameActorInAllMovies(oldName, newName) {
    if (oldName === newName) return;
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.actors && movie.actors.includes(oldName)) {
            movie.actors = movie.actors.map(a => a === oldName ? newName : a);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function renameGenreInAllMovies(oldName, newName) {
    if (oldName === newName) return;
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.genres && movie.genres.includes(oldName)) {
            movie.genres = movie.genres.map(g => g === oldName ? newName : g);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function renameYearInAllMovies(oldYear, newYear) {
    if (oldYear === newYear) return;
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.years && movie.years.includes(oldYear)) {
            movie.years = movie.years.map(y => y === oldYear ? newYear : y);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function renameCountryInAllMovies(oldName, newName) {
    if (oldName === newName) return;
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.countries && movie.countries.includes(oldName)) {
            movie.countries = movie.countries.map(c => c === oldName ? newName : c);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function renameLanguageInAllMovies(oldName, newName) {
    if (oldName === newName) return;
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.languages && movie.languages.includes(oldName)) {
            movie.languages = movie.languages.map(l => l === oldName ? newName : l);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function deleteDirectorFromAllMovies(directorName) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.directors && movie.directors.includes(directorName)) {
            movie.directors = movie.directors.filter(d => d !== directorName);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function deleteActorFromAllMovies(actorName) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.actors && movie.actors.includes(actorName)) {
            movie.actors = movie.actors.filter(a => a !== actorName);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function deleteGenreFromAllMovies(genreName) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.genres && movie.genres.includes(genreName)) {
            movie.genres = movie.genres.filter(g => g !== genreName);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function deleteYearFromAllMovies(yearValue) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.years && movie.years.includes(yearValue)) {
            movie.years = movie.years.filter(y => y !== yearValue);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function deleteCountryFromAllMovies(countryName) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.countries && movie.countries.includes(countryName)) {
            movie.countries = movie.countries.filter(c => c !== countryName);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function deleteLanguageFromAllMovies(languageName) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.languages && movie.languages.includes(languageName)) {
            movie.languages = movie.languages.filter(l => l !== languageName);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

// ---------------------- Search terms Bar ----------------------
export async function refreshAvailableTerms() {
    const allMovies = await getAllMovies();
    const termsSet = new Set();
    for (const movie of allMovies) {
        (movie.searchTerms || []).forEach(t => {
            if (t && typeof t === 'object' && t.term) {
                if (activeRelatedFilter === 'exact') {
                    if (t.exact === true) termsSet.add(t.term);
                } else {
                    if (t.exact === false) termsSet.add(t.term);
                }
            }
        });
    }
    availableTerms = Array.from(termsSet).sort();
}

export async function refreshAvailableDirector() {
    const allMovies = await getAllMovies();
    const directorsSet = new Set();
    for (const movie of allMovies) {
        (movie.directors || []).forEach(d => directorsSet.add(d));
    }
    availableDirector = Array.from(directorsSet).sort();
}

export async function refreshAvailableActor() {
    const allMovies = await getAllMovies();
    const actorsSet = new Set();
    for (const movie of allMovies) {
        (movie.actors || []).forEach(a => actorsSet.add(a));
    }
    availableActor = Array.from(actorsSet).sort();
}

export async function refreshAvailableGenre() {
    const allMovies = await getAllMovies();
    const genresSet = new Set();
    for (const movie of allMovies) {
        (movie.genres || []).forEach(g => genresSet.add(g));
    }
    availableGenre = Array.from(genresSet).sort();
}

export async function refreshAvailableYear() {
    const allMovies = await getAllMovies();
    const yearsSet = new Set();
    for (const movie of allMovies) {
        (movie.years || []).forEach(y => yearsSet.add(y));
    }
    availableYear = Array.from(yearsSet).sort();
}

export async function refreshAvailableCountry() {
    const allMovies = await getAllMovies();
    const countriesSet = new Set();
    for (const movie of allMovies) {
        (movie.countries || []).forEach(c => countriesSet.add(c));
    }
    availableCountry = Array.from(countriesSet).sort();
}

export async function refreshAvailableLanguage() {
    const allMovies = await getAllMovies();
    const languagesSet = new Set();
    for (const movie of allMovies) {
        (movie.languages || []).forEach(l => languagesSet.add(l));
    }
    availableLanguage = Array.from(languagesSet).sort();
}

export async function termHasChildren(term) {
    const allMovies = await getAllMovies();
    for (const movie of allMovies) {
        const found = (movie.searchTerms || []).some(t => {
            if (t && typeof t === 'object' && t.term === term) {
                if (activeRelatedFilter === 'exact') {
                    return t.exact === true;
                } else {
                    return t.exact === false;
                }
            }
            return false;
        });
        if (found) return true;
    }
    return false;
}

export async function directorHasChildren(directorName) {
    const allMovies = await getAllMovies();
    for (const movie of allMovies) {
        if ((movie.directors || []).includes(directorName)) return true;
    }
    return false;
}

export async function actorHasChildren(actorName) {
    const allMovies = await getAllMovies();
    for (const movie of allMovies) {
        if ((movie.actors || []).includes(actorName)) return true;
    }
    return false;
}

export async function genreHasChildren(genreName) {
    const allMovies = await getAllMovies();
    for (const movie of allMovies) {
        if ((movie.genres || []).includes(genreName)) return true;
    }
    return false;
}

export async function yearHasChildren(yearValue) {
    const allMovies = await getAllMovies();
    for (const movie of allMovies) {
        if ((movie.years || []).includes(yearValue)) return true;
    }
    return false;
}

export async function countryHasChildren(countryName) {
    const allMovies = await getAllMovies();
    for (const movie of allMovies) {
        if ((movie.countries || []).includes(countryName)) return true;
    }
    return false;
}

export async function languageHasChildren(languageName) {
    const allMovies = await getAllMovies();
    for (const movie of allMovies) {
        if ((movie.languages || []).includes(languageName)) return true;
    }
    return false;
}

async function removeTermFromAllMovies(term) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.searchTerms) {
            const newTerms = movie.searchTerms.filter(t => t.term !== term);
            if (newTerms.length !== movie.searchTerms.length) {
                movie.searchTerms = newTerms;
                movie.lastUpdated = new Date().toISOString();
                await new Promise((resolve, reject) => {
                    const req = store.put(movie);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
            }
        }
    }
}

async function editTermGlobally(oldTerm, newTerm) {
    if (oldTerm === newTerm || !newTerm.trim()) return;
    await renameTermInAllMovies(oldTerm, newTerm.trim());
    if (activeTermFilter === oldTerm) activeTermFilter = newTerm.trim();
    syncWindowTermFilter();
    await refreshAvailableTerms();
    await loadAndDisplayAll();
}

async function deleteMoviesWithTermFromCurrentView(term) {
    let moviesToProcess;
    let onlyRelated = false;
    
    if (activeTrashFilter) {
        moviesToProcess = await getTrashMovies();
    } else {
        moviesToProcess = await getAllMovies();
        if (activeTermFilter) {
            moviesToProcess = moviesToProcess.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => t.term === activeTermFilter);
            });
        }
        if (activeWatchingFilter) moviesToProcess = moviesToProcess.filter(movie => movie.watching === true);
        if (activeFavoriteFilter) moviesToProcess = moviesToProcess.filter(movie => movie.favorite === true);
        if (activeRelatedFilter === 'related') {
            onlyRelated = true;
            moviesToProcess = moviesToProcess.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => t.exact === false);
            });
        }
    }
    
    const moviesWithTerm = moviesToProcess.filter(movie => {
        const terms = movie.searchTerms || [];
        if (onlyRelated) {
            return terms.some(t => t.term === term && t.exact === false);
        } else {
            return terms.some(t => t.term === term);
        }
    });
    
    if (moviesWithTerm.length === 0) return;

    const confirmMsg = activeTrashFilter
        ? `Permanently delete ${moviesWithTerm.length} movie(s) with search term "${term}" from trash?`
        : onlyRelated
            ? `Remove search term "${term}" from ${moviesWithTerm.length} related movie(s) (exact matches will be kept)`
            : `Move ${moviesWithTerm.length} movie(s) with search term "${term}" to trash?`;
    
    if (!confirm(confirmMsg)) return;

    const db = await openDB();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    
    for (const movie of moviesWithTerm) {
        if (activeTrashFilter) {
            await permanentlyDeleteMovie(movie.youtubeId);
        } else {
            if (onlyRelated) {
                const newTerms = movie.searchTerms.filter(t => !(t.term === term && t.exact === false));
                movie.searchTerms = newTerms;
                movie.lastUpdated = new Date().toISOString();
                await new Promise((resolve, reject) => {
                    const req = store.put(movie);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
            } else {
                await moveMovieToTrash(movie.youtubeId);
            }
        }
    }
    
    if (activeTermFilter === term && !onlyRelated) activeTermFilter = null;
    syncWindowTermFilter();
    await refreshAvailableTerms();
    await loadAndDisplayAll();
}

async function editDirectorGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameDirectorInAllMovies(oldName, newName.trim());
    if (activeDirectorFilter === oldName) activeDirectorFilter = newName.trim();
    await refreshAvailableDirector();
    await loadAndDisplayAll();
}

async function deleteDirectorFromCurrentView(directorName) {
    const hasChildren = await directorHasChildren(directorName);
    if (!hasChildren) return;
    
    const confirmMsg = activeTrashFilter
        ? `Permanently delete all movies with director "${directorName}" from trash?`
        : `Move ${directorName} movies to trash?`;
    
    if (!confirm(confirmMsg)) return;
    
    const allMovies = await getAllMovies();
    const moviesWithDirector = allMovies.filter(movie => (movie.directors || []).includes(directorName));
    
    for (const movie of moviesWithDirector) {
        if (activeTrashFilter) {
            await permanentlyDeleteMovie(movie.youtubeId);
        } else {
            await moveMovieToTrash(movie.youtubeId);
        }
    }
    
    if (activeDirectorFilter === directorName) activeDirectorFilter = null;
    await refreshAvailableDirector();
    await loadAndDisplayAll();
}

async function editActorGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameActorInAllMovies(oldName, newName.trim());
    if (activeActorFilter === oldName) activeActorFilter = newName.trim();
    await refreshAvailableActor();
    await loadAndDisplayAll();
}

async function deleteActorFromCurrentView(actorName) {
    const hasChildren = await actorHasChildren(actorName);
    if (!hasChildren) return;
    
    const confirmMsg = activeTrashFilter
        ? `Permanently delete all movies with actor "${actorName}" from trash?`
        : `Move ${actorName} movies to trash?`;
    
    if (!confirm(confirmMsg)) return;
    
    const allMovies = await getAllMovies();
    const moviesWithActor = allMovies.filter(movie => (movie.actors || []).includes(actorName));
    
    for (const movie of moviesWithActor) {
        if (activeTrashFilter) {
            await permanentlyDeleteMovie(movie.youtubeId);
        } else {
            await moveMovieToTrash(movie.youtubeId);
        }
    }
    
    if (activeActorFilter === actorName) activeActorFilter = null;
    await refreshAvailableActor();
    await loadAndDisplayAll();
}

async function editGenreGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameGenreInAllMovies(oldName, newName.trim());
    if (activeGenreFilter === oldName) activeGenreFilter = newName.trim();
    await refreshAvailableGenre();
    await loadAndDisplayAll();
}

async function deleteGenreFromCurrentView(genreName) {
    const hasChildren = await genreHasChildren(genreName);
    if (!hasChildren) return;
    
    const confirmMsg = activeTrashFilter
        ? `Permanently delete all movies with genre "${genreName}" from trash?`
        : `Move ${genreName} movies to trash?`;
    
    if (!confirm(confirmMsg)) return;
    
    const allMovies = await getAllMovies();
    const moviesWithGenre = allMovies.filter(movie => (movie.genres || []).includes(genreName));
    
    for (const movie of moviesWithGenre) {
        if (activeTrashFilter) {
            await permanentlyDeleteMovie(movie.youtubeId);
        } else {
            await moveMovieToTrash(movie.youtubeId);
        }
    }
    
    if (activeGenreFilter === genreName) activeGenreFilter = null;
    await refreshAvailableGenre();
    await loadAndDisplayAll();
}

async function editYearGlobally(oldYear, newYear) {
    if (oldYear === newYear || !newYear.trim()) return;
    await renameYearInAllMovies(oldYear, newYear.trim());
    if (activeYearFilter === oldYear) activeYearFilter = newYear.trim();
    await refreshAvailableYear();
    await loadAndDisplayAll();
}

async function deleteYearFromCurrentView(yearValue) {
    const hasChildren = await yearHasChildren(yearValue);
    if (!hasChildren) return;
    
    const confirmMsg = activeTrashFilter
        ? `Permanently delete all movies with year "${yearValue}" from trash?`
        : `Move ${yearValue} movies to trash?`;
    
    if (!confirm(confirmMsg)) return;
    
    const allMovies = await getAllMovies();
    const moviesWithYear = allMovies.filter(movie => (movie.years || []).includes(yearValue));
    
    for (const movie of moviesWithYear) {
        if (activeTrashFilter) {
            await permanentlyDeleteMovie(movie.youtubeId);
        } else {
            await moveMovieToTrash(movie.youtubeId);
        }
    }
    
    if (activeYearFilter === yearValue) activeYearFilter = null;
    await refreshAvailableYear();
    await loadAndDisplayAll();
}

async function editCountryGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameCountryInAllMovies(oldName, newName.trim());
    if (activeCountryFilter === oldName) activeCountryFilter = newName.trim();
    await refreshAvailableCountry();
    await loadAndDisplayAll();
}

async function deleteCountryFromCurrentView(countryName) {
    const hasChildren = await countryHasChildren(countryName);
    if (!hasChildren) return;
    
    const confirmMsg = activeTrashFilter
        ? `Permanently delete all movies with country "${countryName}" from trash?`
        : `Move ${countryName} movies to trash?`;
    
    if (!confirm(confirmMsg)) return;
    
    const allMovies = await getAllMovies();
    const moviesWithCountry = allMovies.filter(movie => (movie.countries || []).includes(countryName));
    
    for (const movie of moviesWithCountry) {
        if (activeTrashFilter) {
            await permanentlyDeleteMovie(movie.youtubeId);
        } else {
            await moveMovieToTrash(movie.youtubeId);
        }
    }
    
    if (activeCountryFilter === countryName) activeCountryFilter = null;
    await refreshAvailableCountry();
    await loadAndDisplayAll();
}

async function editLanguageGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameLanguageInAllMovies(oldName, newName.trim());
    if (activeLanguageFilter === oldName) activeLanguageFilter = newName.trim();
    await refreshAvailableLanguage();
    await loadAndDisplayAll();
}

async function deleteLanguageFromCurrentView(languageName) {
    const hasChildren = await languageHasChildren(languageName);
    if (!hasChildren) return;
    
    const confirmMsg = activeTrashFilter
        ? `Permanently delete all movies with language "${languageName}" from trash?`
        : `Move ${languageName} movies to trash?`;
    
    if (!confirm(confirmMsg)) return;
    
    const allMovies = await getAllMovies();
    const moviesWithLanguage = allMovies.filter(movie => (movie.languages || []).includes(languageName));
    
    for (const movie of moviesWithLanguage) {
        if (activeTrashFilter) {
            await permanentlyDeleteMovie(movie.youtubeId);
        } else {
            await moveMovieToTrash(movie.youtubeId);
        }
    }
    
    if (activeLanguageFilter === languageName) activeLanguageFilter = null;
    await refreshAvailableLanguage();
    await loadAndDisplayAll();
}

function renderTermsBar(termsArray = null) {
    const terms = termsArray !== null ? termsArray : availableTerms;
    if (!terms || terms.length === 0) {
        termsBar.innerHTML = '<div class="terms-placeholder">No Search terms yet.</div>';
        return;
    }
    const html = terms.map(term => {
        const termStr = String(term);
        return `
            <button class="btn btn-secondary btn-sm ${activeTermFilter === termStr ? 'active' : ''}" data-term="${escapeHtml(termStr)}">
                ${escapeHtml(termStr)}
                <span class="term-edit material-symbols-outlined" data-term="${escapeHtml(termStr)}" title="Edit search term globally.">edit</span>
                <span class="term-delete" data-term="${escapeHtml(termStr)}" title="Delete search term from all movies.">✖</span>
            </button>
        `;
    }).join('');
    termsBar.innerHTML = html;

    document.querySelectorAll('#termsBar .btn').forEach(btn => {
        const term = btn.dataset.term;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('term-edit') || e.target.classList.contains('term-delete')) return;
            if (activeTermFilter === term) activeTermFilter = null;
            else activeTermFilter = term;
            syncWindowTermFilter();
            loadAndDisplayAll();
        });
    });

    document.querySelectorAll('.term-edit').forEach(editSpan => {
        editSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oldTerm = editSpan.dataset.term;
            const newTerm = prompt(`Edit term "${oldTerm}":`, oldTerm);
            if (newTerm && newTerm !== oldTerm) {
                await editTermGlobally(oldTerm, newTerm);
            }
        });
    });

    document.querySelectorAll('.term-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const term = deleteSpan.dataset.term;
            await deleteMoviesWithTermFromCurrentView(term);
        });
    });
}

function renderDirectorBar() {
    if (!directorsBar) return;
    if (availableDirector.length === 0) {
        directorsBar.innerHTML = '<div class="terms-placeholder">No directors yet.</div>';
        directorsBar.classList.remove('hidden');
        return;
    }
    directorsBar.classList.remove('hidden');
    const html = availableDirector.map(name => `
        <button class="btn btn-secondary btn-sm ${activeDirectorFilter === name ? 'active' : ''}" data-director="${escapeHtml(name)}">
            ${escapeHtml(name)}
            <span class="director-edit material-symbols-outlined" data-director="${escapeHtml(name)}" title="Edit director globally.">edit</span>
            <span class="director-delete" data-director="${escapeHtml(name)}" title="Delete director from all movies.">✖</span>
        </button>
    `).join('');
    directorsBar.innerHTML = html;

    document.querySelectorAll('#directorsBar .btn').forEach(btn => {
        const name = btn.dataset.director;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('director-edit') || e.target.classList.contains('director-delete')) return;
            if (activeDirectorFilter === name) activeDirectorFilter = null;
            else activeDirectorFilter = name;
            loadAndDisplayAll();
        });
    });

    document.querySelectorAll('.director-edit').forEach(editSpan => {
        editSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oldName = editSpan.dataset.director;
            const newName = prompt(`Edit director "${oldName}":`, oldName);
            if (newName && newName !== oldName) {
                await editDirectorGlobally(oldName, newName);
            }
        });
    });

    document.querySelectorAll('.director-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const name = deleteSpan.dataset.director;
            await deleteDirectorFromCurrentView(name);
        });
    });
}

function renderActorBar() {
    if (!actorsBar) return;
    if (availableActor.length === 0) {
        actorsBar.innerHTML = '<div class="terms-placeholder">No Actor yet.</div>';
        actorsBar.classList.remove('hidden');
        return;
    }
    actorsBar.classList.remove('hidden');
    const html = availableActor.map(name => `
        <button class="btn btn-secondary btn-sm ${activeActorFilter === name ? 'active' : ''}" data-actor="${escapeHtml(name)}">
            ${escapeHtml(name)}
            <span class="actor-edit material-symbols-outlined" data-actor="${escapeHtml(name)}" title="Edit actor globally.">edit</span>
            <span class="actor-delete" data-actor="${escapeHtml(name)}" title="Delete actor from all movies.">✖</span>
        </button>
    `).join('');
    actorsBar.innerHTML = html;

    document.querySelectorAll('#actorsBar .btn').forEach(btn => {
        const name = btn.dataset.actor;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('actor-edit') || e.target.classList.contains('actor-delete')) return;
            if (activeActorFilter === name) activeActorFilter = null;
            else activeActorFilter = name;
            loadAndDisplayAll();
        });
    });

    document.querySelectorAll('.actor-edit').forEach(editSpan => {
        editSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oldName = editSpan.dataset.actor;
            const newName = prompt(`Edit actor "${oldName}":`, oldName);
            if (newName && newName !== oldName) {
                await editActorGlobally(oldName, newName);
            }
        });
    });

    document.querySelectorAll('.actor-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const name = deleteSpan.dataset.actor;
            await deleteActorFromCurrentView(name);
        });
    });
}

function renderGenreBar() {
    if (!genresBar) return;
    if (availableGenre.length === 0) {
        genresBar.innerHTML = '<div class="terms-placeholder">No Genre yet.</div>';
        genresBar.classList.remove('hidden');
        return;
    }
    genresBar.classList.remove('hidden');
    const html = availableGenre.map(name => `
        <button class="btn btn-secondary btn-sm ${activeGenreFilter === name ? 'active' : ''}" data-genre="${escapeHtml(name)}">
            ${escapeHtml(name)}
            <span class="genre-edit material-symbols-outlined" data-genre="${escapeHtml(name)}" title="Edit genre globally.">edit</span>
            <span class="genre-delete" data-genre="${escapeHtml(name)}" title="Delete genre from all movies.">✖</span>
        </button>
    `).join('');
    genresBar.innerHTML = html;

    document.querySelectorAll('#genresBar .btn').forEach(btn => {
        const name = btn.dataset.genre;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('genre-edit') || e.target.classList.contains('genre-delete')) return;
            if (activeGenreFilter === name) activeGenreFilter = null;
            else activeGenreFilter = name;
            loadAndDisplayAll();
        });
    });

    document.querySelectorAll('.genre-edit').forEach(editSpan => {
        editSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oldName = editSpan.dataset.genre;
            const newName = prompt(`Edit genre "${oldName}":`, oldName);
            if (newName && newName !== oldName) {
                await editGenreGlobally(oldName, newName);
            }
        });
    });

    document.querySelectorAll('.genre-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const name = deleteSpan.dataset.genre;
            await deleteGenreFromCurrentView(name);
        });
    });
}

function renderYearBar() {
    if (!yearsBar) return;
    if (availableYear.length === 0) {
        yearsBar.innerHTML = '<div class="terms-placeholder">No years yet.</div>';
        yearsBar.classList.remove('hidden');
        return;
    }
    yearsBar.classList.remove('hidden');
    const html = availableYear.map(year => `
        <button class="btn btn-secondary btn-sm ${activeYearFilter === year ? 'active' : ''}" data-year="${escapeHtml(year)}">
            ${escapeHtml(year)}
            <span class="year-edit material-symbols-outlined" data-year="${escapeHtml(year)}" title="Edit year globally.">edit</span>
            <span class="year-delete" data-year="${escapeHtml(year)}" title="Delete year from all movies.">✖</span>
        </button>
    `).join('');
    yearsBar.innerHTML = html;

    document.querySelectorAll('#yearsBar .btn').forEach(btn => {
        const year = btn.dataset.year;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('year-edit') || e.target.classList.contains('year-delete')) return;
            if (activeYearFilter === year) activeYearFilter = null;
            else activeYearFilter = year;
            loadAndDisplayAll();
        });
    });

    document.querySelectorAll('.year-edit').forEach(editSpan => {
        editSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oldYear = editSpan.dataset.year;
            const newYear = prompt(`Edit year "${oldYear}":`, oldYear);
            if (newYear && newYear !== oldYear) {
                await editYearGlobally(oldYear, newYear);
            }
        });
    });

    document.querySelectorAll('.year-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const year = deleteSpan.dataset.year;
            await deleteYearFromCurrentView(year);
        });
    });
}

function renderCountryBar() {
    if (!countriesBar) return;
    if (availableCountry.length === 0) {
        countriesBar.innerHTML = '<div class="terms-placeholder">No countries yet.</div>';
        countriesBar.classList.remove('hidden');
        return;
    }
    countriesBar.classList.remove('hidden');
    const html = availableCountry.map(name => `
        <button class="btn btn-secondary btn-sm ${activeCountryFilter === name ? 'active' : ''}" data-country="${escapeHtml(name)}">
            ${escapeHtml(name)}
            <span class="country-edit material-symbols-outlined" data-country="${escapeHtml(name)}" title="Edit country globally.">edit</span>
            <span class="country-delete" data-country="${escapeHtml(name)}" title="Delete country from all movies.">✖</span>
        </button>
    `).join('');
    countriesBar.innerHTML = html;

    document.querySelectorAll('#countriesBar .btn').forEach(btn => {
        const name = btn.dataset.country;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('country-edit') || e.target.classList.contains('country-delete')) return;
            if (activeCountryFilter === name) activeCountryFilter = null;
            else activeCountryFilter = name;
            loadAndDisplayAll();
        });
    });

    document.querySelectorAll('.country-edit').forEach(editSpan => {
        editSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oldName = editSpan.dataset.country;
            const newName = prompt(`Edit country "${oldName}":`, oldName);
            if (newName && newName !== oldName) {
                await editCountryGlobally(oldName, newName);
            }
        });
    });

    document.querySelectorAll('.country-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const name = deleteSpan.dataset.country;
            await deleteCountryFromCurrentView(name);
        });
    });
}

function renderLanguageBar() {
    if (!languagesBar) return;
    if (availableLanguage.length === 0) {
        languagesBar.innerHTML = '<div class="terms-placeholder">No languages yet.</div>';
        languagesBar.classList.remove('hidden');
        return;
    }
    languagesBar.classList.remove('hidden');
    const html = availableLanguage.map(name => `
        <button class="btn btn-secondary btn-sm ${activeLanguageFilter === name ? 'active' : ''}" data-language="${escapeHtml(name)}">
            ${escapeHtml(name)}
            <span class="language-edit material-symbols-outlined" data-language="${escapeHtml(name)}" title="Edit language globally.">edit</span>
            <span class="language-delete" data-language="${escapeHtml(name)}" title="Delete language from all movies.">✖</span>
        </button>
    `).join('');
    languagesBar.innerHTML = html;

    document.querySelectorAll('#languagesBar .btn').forEach(btn => {
        const name = btn.dataset.language;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('language-edit') || e.target.classList.contains('language-delete')) return;
            if (activeLanguageFilter === name) activeLanguageFilter = null;
            else activeLanguageFilter = name;
            loadAndDisplayAll();
        });
    });

    document.querySelectorAll('.language-edit').forEach(editSpan => {
        editSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oldName = editSpan.dataset.language;
            const newName = prompt(`Edit language "${oldName}":`, oldName);
            if (newName && newName !== oldName) {
                await editLanguageGlobally(oldName, newName);
            }
        });
    });

    document.querySelectorAll('.language-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const name = deleteSpan.dataset.language;
            await deleteLanguageFromCurrentView(name);
        });
    });
}

// ---------------------- Toggle Terms Bar visibility ----------------------
if (toggleTermsBtn && termsBar) {
    const termsIcon = toggleTermsBtn.querySelector('.material-symbols-outlined');
    
    toggleTermsBtn.addEventListener('click', () => {
        if (activeCollectionFilter) {
            activeCollectionFilter = false;
            updateFilterButtonsUI();
        }
        const isHidden = termsBar.classList.toggle('hidden');
        if (isHidden) {
            toggleTermsBtn.classList.remove('active');
            if (termsIcon) termsIcon.textContent = 'filter_list_off';
        } else {
            toggleTermsBtn.classList.add('active');
            if (termsIcon) termsIcon.textContent = 'filter_list';
        }
        loadAndDisplayAll();
    });
}

// ---------------------- Filter buttons UI update ----------------------
function updateFilterButtonsUI() {
    if (activeWatchingFilter) {
        filterWatchingBtn.classList.add('active');
        filterWatchingBtn.querySelector('.material-symbols-outlined').textContent = 'visibility';
    } else {
        filterWatchingBtn.classList.remove('active');
        filterWatchingBtn.querySelector('.material-symbols-outlined').textContent = 'visibility_off';
    }

    if (activeFavoriteFilter) {
        filterFavoriteBtn.classList.add('active');
        filterFavoriteBtn.querySelector('.material-symbols-outlined').textContent = 'star_shine';
    } else {
        filterFavoriteBtn.classList.remove('active');
        filterFavoriteBtn.querySelector('.material-symbols-outlined').textContent = 'star';
    }

    if (activeTrashFilter) {
        filterTrashBtn.classList.add('active');
    } else {
        filterTrashBtn.classList.remove('active');
    }

    if (activeCollectionFilter && filterCollectionBtn) {
        filterCollectionBtn.classList.add('active');
    } else if (filterCollectionBtn) {
        filterCollectionBtn.classList.remove('active');
    }
    
    if (activeTrashFilter) {
        if (filterWatchingBtn) filterWatchingBtn.classList.add('btn-disabled');
        if (filterFavoriteBtn) filterFavoriteBtn.classList.add('btn-disabled');
    } else {
        if (filterWatchingBtn) filterWatchingBtn.classList.remove('btn-disabled');
        if (filterFavoriteBtn) filterFavoriteBtn.classList.remove('btn-disabled');
    }
    
    if (activeTrashFilter || activeCollectionFilter) {
        if (filterRelatedBtn) {
            filterRelatedBtn.classList.remove('btn-primary');
            filterRelatedBtn.classList.add('btn-secondary');
        }
    } else {
        if (filterRelatedBtn) {
            filterRelatedBtn.classList.remove('btn-secondary');
            filterRelatedBtn.classList.add('btn-primary');
        }
    }
}

// ---------------------- Toggle functions ----------------------
function toggleWatchingFilter() {
    if (activeTrashFilter) return;

    activeWatchingFilter = !activeWatchingFilter;
    if (activeWatchingFilter && activeFavoriteFilter) {
        activeFavoriteFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleFavoriteFilter() {
    if (activeTrashFilter) return;

    activeFavoriteFilter = !activeFavoriteFilter;
    if (activeFavoriteFilter && activeWatchingFilter) {
        activeWatchingFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleTrashFilter() {
    activeTermFilter = null;
    activeDirectorFilter = null;
    activeActorFilter = null;
    activeGenreFilter = null;
    activeYearFilter = null;
    activeCountryFilter = null;
    activeLanguageFilter = null;
    activeTagFilter = null;
    activeCollectionFilter = false;
    
    if (!activeWatchingFilter && !activeFavoriteFilter && !activeTrashFilter) {
        savedRelatedFilter = activeRelatedFilter;
    }
    
    activeTrashFilter = !activeTrashFilter;
    if (activeTrashFilter) {
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
    }
    
    if (!activeWatchingFilter && !activeFavoriteFilter && !activeTrashFilter) {
        activeRelatedFilter = savedRelatedFilter;
        updateRelatedButtonText();
    }
    
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleCollectionFilter() {
    activeTermFilter = null;
    activeDirectorFilter = null;
    activeActorFilter = null;
    activeGenreFilter = null;
    activeYearFilter = null;
    activeCountryFilter = null;
    activeLanguageFilter = null;
    activeTagFilter = null;
    
    if (!activeWatchingFilter && !activeFavoriteFilter && !activeTrashFilter && !activeCollectionFilter) {
        savedRelatedFilter = activeRelatedFilter;
    }
    
    if (activeWatchingFilter || activeFavoriteFilter || activeTrashFilter) {
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
        activeTrashFilter = false;
    }
    
    activeCollectionFilter = !activeCollectionFilter;
    
    if (activeCollectionFilter) {
        if (toggleTermsBtn) toggleTermsBtn.classList.remove('active');
        if (termsBar) termsBar.classList.add('hidden');
    } else {
        activeRelatedFilter = savedRelatedFilter;
        updateRelatedButtonText();
        if (toggleTermsBtn && termsBar && !termsBar.classList.contains('hidden')) {
            toggleTermsBtn.classList.add('active');
        }
    }
    
    updateCollectionButtonText();
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

if (filterWatchingBtn) filterWatchingBtn.addEventListener('click', toggleWatchingFilter);
if (filterFavoriteBtn) filterFavoriteBtn.addEventListener('click', toggleFavoriteFilter);
if (filterTrashBtn) filterTrashBtn.addEventListener('click', toggleTrashFilter);

// ---------------------- Load and display ----------------------
export async function loadAndDisplayAll() {
    await dbReady;
    let allMovies = await getAllMovies();

    if (activeTermFilter) {
        allMovies = allMovies.filter(movie => {
            const terms = movie.searchTerms || [];
            if (activeRelatedFilter === 'exact') {
                return terms.some(t => t.term === activeTermFilter && t.exact === true);
            } else {
                return terms.some(t => t.term === activeTermFilter && t.exact === false);
            }
        });
    }

    if (!activeCollectionFilter && !activeTrashFilter && !activeWatchingFilter && !activeFavoriteFilter && !activeTermFilter) {
        if (activeRelatedFilter === 'exact') {
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => t.exact === true);
            });
        } else if (activeRelatedFilter === 'related') {
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => t.exact === false);
            });
        }
    }

    if (activeCollectionFilter) {
        allMovies = await getAllMovies();
        
        if (collectionsSortBy === 'all') {
            allMovies = allMovies.filter(movie => {
                const hasDirector = (movie.directors || []).length > 0;
                const hasActor = (movie.actors || []).length > 0;
                const hasGenre = (movie.genres || []).length > 0;
                const hasYear = (movie.years || []).length > 0;
                const hasCountry = (movie.countries || []).length > 0;
                const hasLanguage = (movie.languages || []).length > 0;
                const hasTags = (movie.tags || []).length > 0;
                return hasDirector || hasActor || hasGenre || hasYear || hasCountry || hasLanguage || hasTags;
            });
        } else if (collectionsSortBy === 'tags') {
            allMovies = allMovies.filter(movie => (movie.tags || []).length > 0);
        } else if (collectionsSortBy === 'directors') {
            allMovies = allMovies.filter(movie => (movie.directors || []).length > 0);
        } else if (collectionsSortBy === 'actors') {
            allMovies = allMovies.filter(movie => (movie.actors || []).length > 0);
        } else if (collectionsSortBy === 'genres') {
            allMovies = allMovies.filter(movie => (movie.genres || []).length > 0);
        } else if (collectionsSortBy === 'years') {
            allMovies = allMovies.filter(movie => (movie.years || []).length > 0);
        } else if (collectionsSortBy === 'countries') {
            allMovies = allMovies.filter(movie => (movie.countries || []).length > 0);
        } else if (collectionsSortBy === 'languages') {
            allMovies = allMovies.filter(movie => (movie.languages || []).length > 0);
        }
        
        if (collectionsSortBy === 'directors' && activeDirectorFilter) {
            allMovies = allMovies.filter(movie => (movie.directors || []).includes(activeDirectorFilter));
        } else if (collectionsSortBy === 'actors' && activeActorFilter) {
            allMovies = allMovies.filter(movie => (movie.actors || []).includes(activeActorFilter));
        } else if (collectionsSortBy === 'genres' && activeGenreFilter) {
            allMovies = allMovies.filter(movie => (movie.genres || []).includes(activeGenreFilter));
        } else if (collectionsSortBy === 'years' && activeYearFilter) {
            allMovies = allMovies.filter(movie => (movie.years || []).includes(activeYearFilter));
        } else if (collectionsSortBy === 'countries' && activeCountryFilter) {
            allMovies = allMovies.filter(movie => (movie.countries || []).includes(activeCountryFilter));
        } else if (collectionsSortBy === 'languages' && activeLanguageFilter) {
            allMovies = allMovies.filter(movie => (movie.languages || []).includes(activeLanguageFilter));
        } else if (collectionsSortBy === 'tags' && activeTagFilter) {
            allMovies = allMovies.filter(movie => (movie.tags || []).includes(activeTagFilter));
        }
    }
    
    if (activeTagFilter && !activeCollectionFilter) {
        allMovies = allMovies.filter(movie => {
            const inDirectors = (movie.directors || []).includes(activeTagFilter);
            const inActors = (movie.actors || []).includes(activeTagFilter);
            const inGenres = (movie.genres || []).includes(activeTagFilter);
            const inYears = (movie.years || []).includes(activeTagFilter);
            const inCountries = (movie.countries || []).includes(activeTagFilter);
            const inLanguages = (movie.languages || []).includes(activeTagFilter);
            const inTags = (movie.tags || []).includes(activeTagFilter);
            const inSearchTerms = (movie.searchTerms || []).some(t => t.term === activeTagFilter);
            return inDirectors || inActors || inGenres || inYears || inCountries || inLanguages || inTags || inSearchTerms;
        });
    }

    if (activeWatchingFilter) {
        allMovies = allMovies.filter(movie => movie.watching === true);
    }

    if (activeFavoriteFilter) {
        allMovies = allMovies.filter(movie => movie.favorite === true);
    }

    if (activeTrashFilter) {
        allMovies = await getTrashMovies();
    }

    let title;
    if (activeCollectionFilter) {
        let sortLabel = '';
        if (collectionsSortBy === 'all') sortLabel = 'Collection';
        else if (collectionsSortBy === 'tags') sortLabel = 'Tags';
        else if (collectionsSortBy === 'directors') sortLabel = 'Director';
        else if (collectionsSortBy === 'actors') sortLabel = 'Actor';
        else if (collectionsSortBy === 'genres') sortLabel = 'Genre';
        else if (collectionsSortBy === 'years') sortLabel = 'Year';
        else if (collectionsSortBy === 'countries') sortLabel = 'Country';
        else if (collectionsSortBy === 'languages') sortLabel = 'Language';
        
        let filterName = '';
        if (collectionsSortBy !== 'all') {
            if (collectionsSortBy === 'directors' && activeDirectorFilter) filterName = `: ${activeDirectorFilter}`;
            else if (collectionsSortBy === 'actors' && activeActorFilter) filterName = `: ${activeActorFilter}`;
            else if (collectionsSortBy === 'genres' && activeGenreFilter) filterName = `: ${activeGenreFilter}`;
            else if (collectionsSortBy === 'years' && activeYearFilter) filterName = `: ${activeYearFilter}`;
            else if (collectionsSortBy === 'countries' && activeCountryFilter) filterName = `: ${activeCountryFilter}`;
            else if (collectionsSortBy === 'languages' && activeLanguageFilter) filterName = `: ${activeLanguageFilter}`;
            else if (collectionsSortBy === 'tags' && activeTagFilter) filterName = `: ${activeTagFilter}`;
        }
        
        if (activeWatchingFilter && activeFavoriteFilter) {
            title = `<span class="material-symbols-outlined">visibility</span> <span class="material-symbols-outlined">star_shine</span> ${sortLabel}${filterName} (${allMovies.length})`;
        } else if (activeWatchingFilter) {
            title = `<span class="material-symbols-outlined">visibility</span> ${sortLabel}${filterName} (${allMovies.length})`;
        } else if (activeFavoriteFilter) {
            title = `<span class="material-symbols-outlined">star_shine</span> ${sortLabel}${filterName} (${allMovies.length})`;
        } else {
            title = `${sortLabel}${filterName} (${allMovies.length})`;
        }
    } else if (activeTrashFilter) {
        title = `Trash (${allMovies.length})`;
    } else if (activeTermFilter) {
        title = `Search term: "${activeTermFilter}" (${allMovies.length})`;
    } else if (activeDirectorFilter) {
        title = `Director: ${activeDirectorFilter} (${allMovies.length})`;
    } else if (activeActorFilter) {
        title = `Actor: ${activeActorFilter} (${allMovies.length})`;
    } else if (activeGenreFilter) {
        title = `Genre: ${activeGenreFilter} (${allMovies.length})`;
    } else if (activeYearFilter) {
        title = `Year: ${activeYearFilter} (${allMovies.length})`;
    } else if (activeCountryFilter) {
        title = `Country: ${activeCountryFilter} (${allMovies.length})`;
    } else if (activeLanguageFilter) {
        title = `Language: ${activeLanguageFilter} (${allMovies.length})`;
    } else if (activeTagFilter) {
        title = `Tag: "${activeTagFilter}" (${allMovies.length})`;
    } else if (activeWatchingFilter && activeFavoriteFilter) {
        title = `<span class="material-symbols-outlined">visibility</span> <span class="material-symbols-outlined">star_shine</span> ${activeRelatedFilter === 'exact' ? 'Exact results' : 'Related results'} (${allMovies.length})`;
    } else if (activeWatchingFilter) {
        title = `<span class="material-symbols-outlined">visibility</span> ${activeRelatedFilter === 'exact' ? 'Exact results' : 'Related results'} (${allMovies.length})`;
    } else if (activeFavoriteFilter) {
        title = `<span class="material-symbols-outlined">star_shine</span> ${activeRelatedFilter === 'exact' ? 'Exact results' : 'Related results'} (${allMovies.length})`;
    } else if (activeRelatedFilter === 'exact') {
        title = `Exact results (${allMovies.length})`;
    } else {
        title = `Related results (${allMovies.length})`;
    }
    
    const historyTitle = document.getElementById('historyTitle');
    if (historyTitle) historyTitle.innerHTML = title;

    const onSortChange = (newSort) => {
        if (activeCollectionFilter) {
            currentSort = newSort;
            loadAndDisplayAll();
        } else {
            currentSort = newSort;
            loadAndDisplayAll();
        }
    };

    if (activeCollectionFilter) {
        const groupBy = (collectionsSortBy === 'all' ? null : collectionsSortBy);
        renderMovies(resultsGrid, allMovies, 'collections', currentSort, onSortChange, groupBy);
    } else {
        renderMovies(resultsGrid, allMovies, activeTrashFilter ? 'trash' : 'main', currentSort, onSortChange);
    }

    let termsToShow;

    if (!activeCollectionFilter) {
        if (activeTermFilter) {
            const stillExists = await termHasChildren(activeTermFilter);
            if (!stillExists) {
                activeTermFilter = null;
                syncWindowTermFilter();
            }
        }

        if (activeTermFilter) {
            termsToShow = [activeTermFilter];
        } else {
            const allTerms = new Set();
            for (const movie of allMovies) {
                const terms = movie.searchTerms || [];
                terms.forEach(t => {
                    if (!t.term) return;
                    if (activeRelatedFilter === 'exact') {
                        if (t.exact === true) allTerms.add(t.term);
                    } else {
                        if (t.exact === false) allTerms.add(t.term);
                    }
                });
            }
            termsToShow = Array.from(allTerms).sort();
        }
        renderTermsBar(termsToShow);
        
        if (directorsBar) directorsBar.classList.add('hidden');
        if (actorsBar) actorsBar.classList.add('hidden');
        if (genresBar) genresBar.classList.add('hidden');
        if (yearsBar) yearsBar.classList.add('hidden');
        if (countriesBar) countriesBar.classList.add('hidden');
        if (languagesBar) languagesBar.classList.add('hidden');
        if (tagsBar) tagsBar.classList.add('hidden');
    } else {
        if (directorsBar) directorsBar.classList.add('hidden');
        if (actorsBar) actorsBar.classList.add('hidden');
        if (genresBar) genresBar.classList.add('hidden');
        if (yearsBar) yearsBar.classList.add('hidden');
        if (countriesBar) countriesBar.classList.add('hidden');
        if (languagesBar) languagesBar.classList.add('hidden');
        if (tagsBar) tagsBar.classList.add('hidden');
        return;
    }
    
    await refreshAvailableDirector();
    await refreshAvailableActor();
    await refreshAvailableGenre();
    await refreshAvailableYear();
    await refreshAvailableCountry();
    await refreshAvailableLanguage();
    await refreshAvailableTags();
    renderTagsBar();
}

// ---------------------- Modal helpers ----------------------
async function updateMovieTerms(youtubeId, newTerms) {
    const db = await openDB();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    const movie = await new Promise((resolve, reject) => {
        const req = store.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    if (movie) {
        movie.searchTerms = newTerms.map(term => ({ term: String(term), exact: true }));
        movie.lastUpdated = new Date().toISOString();
        await new Promise((resolve, reject) => {
            const req = store.put(movie);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
        await refreshAvailableTerms();
        if (activeTermFilter && !movie.searchTerms.some(t => t.term === activeTermFilter)) {
            loadAndDisplayAll();
        }
    }
}

async function toggleFavorite(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    const movie = await new Promise((resolve, reject) => {
        const req = store.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    if (movie) {
        movie.favorite = !movie.favorite;
        movie.lastUpdated = new Date().toISOString();
        await new Promise((resolve, reject) => {
            const req = store.put(movie);
            req.onsuccess = () => resolve(movie.favorite);
            req.onerror = () => reject(req.error);
        });
        return movie.favorite;
    }
    return false;
}

export function setActiveFilter(filter) {
    if (filter === 'exact' || filter === 'related') {
        activeRelatedFilter = filter;
        savedRelatedFilter = filter;
        updateRelatedButtonText();
        updateFilterButtonsUI();
        loadAndDisplayAll();
    }
}

window.openMovieModal = (movie, source = 'main') => {
    openModal(movie, {
        updateMovieTerms,
        toggleWatching,
        toggleFavorite,
        moveToTrash: moveMovieToTrash,
        restoreFromTrash: restoreMovieFromTrash,
        permanentlyDelete: permanentlyDeleteMovie
    }, source, activeRelatedFilter, setActiveFilter);
};

// ---------------------- Función de búsqueda (sin botón) ----------------------
async function performSearch() {
    if (activeTrashFilter || activeWatchingFilter || activeFavoriteFilter || activeCollectionFilter) {
        activeTrashFilter = false;
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
        activeCollectionFilter = false;
        updateFilterButtonsUI();
        if (!activeWatchingFilter && !activeFavoriteFilter && !activeTrashFilter) {
            activeRelatedFilter = savedRelatedFilter;
            updateRelatedButtonText();
        }
    }
    activeTermFilter = null;
    activeDirectorFilter = null;
    activeActorFilter = null;
    activeGenreFilter = null;
    activeYearFilter = null;
    activeCountryFilter = null;
    activeLanguageFilter = null;
    activeTagFilter = null;
    
    let query = searchInput.value.trim();
    if (!query) {
        resultsGrid.innerHTML = '<div class="stats">Enter a search term (title, director, actor, or genre)</div>';
        return;
    }
    
    let effectiveQuery = query;
    let customTermName = null;
    if (searchOrder === 'viewCount') {
        customTermName = 'Most viewed';
    } else if (searchOrder === 'rating') {
        customTermName = 'Most rated';
    }
    
    const dateFrom = document.getElementById('dateFrom')?.value;
    const dateTo = document.getElementById('dateTo')?.value;
    let publishedAfter = null;
    let publishedBefore = null;
    if (dateFrom) publishedAfter = new Date(dateFrom).toISOString();
    if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        publishedBefore = endDate.toISOString();
    }
    
    const selectedOption = SEARCH_OPTIONS.find(opt => opt.id === currentSearchOptionId);
    if (!selectedOption) return;
    
    if (selectedOption.type === 'api') {
        resultsGrid.innerHTML = '<div class="stats">Searching YouTube Movies...</div>';
        try {
            let channelId = null;
            if (selectedOption.id !== 'plato_db') {
                const userChannel = localStorage.getItem('user_channel') || 'all';
                if (userChannel === 'movies') {
                    channelId = 'UCuVPpxrm2VAgpH3Ktln4HXg';
                } else {
                    channelId = null;
                }
            }

            const moviesFromAPI = await searchYouTube(effectiveQuery, channelId, searchOrder, searchDuration, searchCategoryFilter, publishedAfter, publishedBefore);
            if (moviesFromAPI.length === 0) {
                resultsGrid.innerHTML = '<div class="stats">No results found on YouTube Movies</div>';
                return;
            }
            const termToSave = customTermName ? customTermName : query;
            let newMoviesCount = 0;
            for (const movie of moviesFromAPI) {
                const searchTermLower = termToSave.toLowerCase();
                const titleMatch = movie.title && movie.title.toLowerCase().includes(searchTermLower);
                const descMatch = movie.description && movie.description.toLowerCase().includes(searchTermLower);
                const tagsMatch = movie.tags && Array.isArray(movie.tags) && movie.tags.some(tag => tag.toLowerCase().includes(searchTermLower));
                const isExact = titleMatch || descMatch || tagsMatch;
                
                const existingMovie = await getMovieFromDB(movie.youtubeId);
                await saveMovie(movie, termToSave, isExact);
                await saveExtraInfo(movie.youtubeId, {
                    categoryId: movie.categoryId,
                    defaultLanguage: movie.defaultLanguage,
                    defaultAudioLanguage: movie.defaultAudioLanguage,
                    dimension: movie.dimension,
                    definition: movie.definition,
                    caption: movie.caption,
                    licensedContent: movie.licensedContent,
                    projection: movie.projection,
                    publicStatsViewable: movie.publicStatsViewable,
                    madeForKids: movie.madeForKids,
                    selfDeclaredMadeForKids: movie.selfDeclaredMadeForKids
                });
                if (!existingMovie) newMoviesCount++;
            }
            await refreshAvailableTerms();
            await refreshAvailableYear();
            if (newMoviesCount > 0) {
                await loadAndDisplayAll();
            } else {
                resultsGrid.innerHTML = '<div class="stats">All movies already exist. Stats updated.</div>';
                setTimeout(() => loadAndDisplayAll(), 1500);
            }
            searchInput.value = '';
        } catch (err) {
            console.error(err);
            resultsGrid.innerHTML = `<div class="stats">Error: ${err.message}</div>`;
        }
    } else {
        resultsGrid.innerHTML = '<div class="stats">Searching in Plato DB...</div>';
        let allMovies = await getAllMovies();
        if (publishedAfter || publishedBefore) {
            allMovies = allMovies.filter(movie => {
                if (!movie.publishedAt) return false;
                const publishDate = new Date(movie.publishedAt);
                if (publishedAfter && publishDate < new Date(publishedAfter)) return false;
                if (publishedBefore && publishDate > new Date(publishedBefore)) return false;
                return true;
            });
        }
        const lowerQuery = effectiveQuery.toLowerCase();
        const filtered = allMovies.filter(movie => {
            const titleMatch = movie.title.toLowerCase().includes(lowerQuery);
            const descMatch = movie.description && movie.description.toLowerCase().includes(lowerQuery);
            let termsMatch = false;
            const terms = movie.searchTerms || [];
            terms.forEach(t => {
                if (t.term && t.term.toLowerCase().includes(lowerQuery)) termsMatch = true;
            });
            return titleMatch || descMatch || termsMatch;
        });
        if (filtered.length === 0) {
            resultsGrid.innerHTML = '<div class="stats">No matching movies found in Plato DB</div>';
        } else {
            const onSortChange = (newSort) => {
                currentSort = newSort;
                renderMovies(resultsGrid, filtered, `Search results for "${effectiveQuery}" (${filtered.length})`, 'main', currentSort, onSortChange);
            };
            renderMovies(resultsGrid, filtered, `Search results for "${effectiveQuery}" (${filtered.length})`, 'main', currentSort, onSortChange);
        }
        searchInput.value = '';
    }
}

document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    }
});

// ---------------------- Build Sort dropdown ----------------------
function buildSortDropdown() {
    const sortBtn = document.getElementById('sortBtn');
    const sortPanel = document.getElementById('sortPanel');
    const sortLabel = document.getElementById('sortLabel');
    
    if (!sortBtn || !sortPanel || !sortLabel) return;
    
    sortBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortPanel.classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!sortBtn.contains(e.target) && !sortPanel.contains(e.target)) {
            sortPanel.classList.add('hidden');
        }
    });
    
    sortPanel.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', () => {
            const value = label.dataset.value;
            const textSpan = label.querySelector('.sort-label-text');
            const text = textSpan ? textSpan.textContent : label.textContent.trim();
            const iconSpan = label.querySelector('.material-symbols-outlined');
            const iconName = iconSpan ? iconSpan.textContent : 'sort';
            
            document.getElementById('sortLabel').textContent = text;
            document.getElementById('sortIcon').textContent = iconName;
            
            sortPanel.classList.add('hidden');
            currentSort = value;
            loadAndDisplayAll();
        });
    });
}


// ---------------------- Initialization ----------------------
async function init() {
    await dbReady;
    loadSearchPreferences();
    buildSearchInPanel();
    buildCollectionDropdown();
    buildRelatedDropdown();
    buildSettingsSidebarContent();
    buildSortDropdown();
    
    initModal(async () => {
        await refreshAvailableTerms();
        await loadAndDisplayAll();
    });
    await refreshAvailableTerms();
    await loadAndDisplayAll();
    
    if (termsBar) termsBar.classList.add('hidden');
    if (toggleTermsBtn) {
        toggleTermsBtn.classList.remove('active');
        const icon = toggleTermsBtn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'filter_list_off';
    }

    searchInput.focus();

    if (localStorage.getItem('plato_hideLabels') === 'true') {
        document.body.classList.add('hide-btn-labels');
    }

    updateFilterButtonsUI();
}
init();

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}