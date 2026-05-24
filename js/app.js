// js/app.js - Plato App (soporte para términos exactos y relacionados, con filtro "Related items")
import { openDB, getAllMovies, getTrashMovies, saveMovie, toggleWatching, moveMovieToTrash, restoreMovieFromTrash, permanentlyDeleteMovie, renameTermInAllMovies, saveExtraInfo } from './db.js';
import { searchYouTube } from './api/youtube.js';
import { renderMovies } from './render.js';
import { SEARCH_OPTIONS } from './channels.js';
import { initModal, openModal } from './modal.js';

// ---------------------- DOM elements ----------------------
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');
const searchInBtn = document.getElementById('searchInBtn');
const searchInPanel = document.getElementById('searchInPanel');
const filterWatchingBtn = document.getElementById('filterWatchingBtn');
const filterFavoriteBtn = document.getElementById('filterFavoriteBtn');
const filterTrashBtn = document.getElementById('filterTrashBtn');
const filterRelatedBtn = document.getElementById('filterRelatedBtn');
const termsBar = document.getElementById('termsBar');
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
let activeRelatedFilter = false;
let activeTermFilter = null;      // término activo en modo normal (exactos)
let relatedTermFilter = null;     // término activo en modo relacionados (exact === false)
let availableTerms = [];
let currentSort = 'date';

// Search filters (settings)
let searchOrder = 'relevance';   // 'relevance', 'viewCount', 'rating'
let searchDuration = 'long';      // 'long', 'medium', 'short', 'any'
let searchCategoryFilter = 'movies'; // 'movies' or 'all'

// ---------------------- Helper: close panels ----------------------
function closeAllPanels() {
    searchInPanel.classList.add('hidden');
}

function closePanelWithDelay(panel) {
    setTimeout(() => panel.classList.add('hidden'), 150);
}

// ---------------------- Build Search In panel ----------------------
function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'dropdown-header';
    header.textContent = 'Search in';
    searchInPanel.appendChild(header);

    function setExclusive(clickedOptionId) {
        currentSearchOptionId = clickedOptionId;
        updateSearchInButtonText();
        closePanelWithDelay(searchInPanel);
    }

    function updateSearchInButtonText() {
        const option = SEARCH_OPTIONS.find(opt => opt.id === currentSearchOptionId);
        const label = option ? option.name : 'Select';
        searchInBtn.innerHTML = `
            <span class="material-symbols-outlined">subscriptions</span>
            ${label}
            <span class="material-symbols-outlined">arrow_drop_down</span>
        `;
    }

    SEARCH_OPTIONS.forEach(option => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'searchIn';
        radio.value = option.id;
        radio.checked = (currentSearchOptionId === option.id);
        radio.addEventListener('change', () => {
            if (radio.checked) {
                setExclusive(option.id);
            }
        });
        label.appendChild(radio);
        label.appendChild(document.createTextNode(option.name));
        searchInPanel.appendChild(label);
    });

    updateSearchInButtonText();
}

// ---------------------- Sidebar functions (settings) ----------------------
function openSettingsSidebar() {
    settingsSidebar.classList.remove('hidden');
    sidebarOverlay.classList.remove('hidden');
    const orderRadios = document.querySelectorAll('input[name="searchOrder"]');
    orderRadios.forEach(radio => {
        if (radio.value === searchOrder) radio.checked = true;
    });
    const durationRadios = document.querySelectorAll('input[name="searchDuration"]');
    durationRadios.forEach(radio => {
        if (radio.value === searchDuration) radio.checked = true;
    });
    const categoryRadios = document.querySelectorAll('input[name="searchCategory"]');
    categoryRadios.forEach(radio => {
        if (radio.value === searchCategoryFilter) radio.checked = true;
    });
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
    let sidebarContent = document.querySelector('.sidebar-content');
    if (!sidebarContent) {
        sidebarContent = document.createElement('div');
        sidebarContent.className = 'sidebar-content';
        settingsSidebar.appendChild(sidebarContent);
    }
    sidebarContent.innerHTML = `
        <div class="sidebar-section">
            <h3>Search Filters</h3>
            <div class="settings-group">
                <label class="settings-label">Content type:</label>
                <div class="radio-group">
                    <label><input type="radio" name="searchCategory" value="movies"> Include only movies</label>
                    <label><input type="radio" name="searchCategory" value="all"> Include non‑movies</label>
                </div>
            </div>
            <div class="settings-group">
                <label class="settings-label">Order by:</label>
                <div class="radio-group">
                    <label><input type="radio" name="searchOrder" value="relevance"> Best match</label>
                    <label><input type="radio" name="searchOrder" value="viewCount"> Most viewed</label>
                    <label><input type="radio" name="searchOrder" value="rating"> Most liked</label>
                </div>
            </div>
            <div class="settings-group">
                <label class="settings-label">Duration:</label>
                <div class="radio-group">
                    <label><input type="radio" name="searchDuration" value="long"> Long (&gt;20 min)</label>
                    <label><input type="radio" name="searchDuration" value="medium"> Medium (4-20 min)</label>
                    <label><input type="radio" name="searchDuration" value="short"> Short (&lt;4 min)</label>
                    <label><input type="radio" name="searchDuration" value="any"> Any duration</label>
                </div>
            </div>
        </div>
    `;

    const orderRadios = document.querySelectorAll('input[name="searchOrder"]');
    orderRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) saveSearchOrder(e.target.value);
        });
    });
    const durationRadios = document.querySelectorAll('input[name="searchDuration"]');
    durationRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) saveSearchDuration(e.target.value);
        });
    });
    const categoryRadios = document.querySelectorAll('input[name="searchCategory"]');
    categoryRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) saveSearchCategory(e.target.value);
        });
    });
}

// ---------------------- Terms Bar ----------------------
async function refreshAvailableTerms() {
    const allMovies = await getAllMovies();
    const termsSet = new Set();
    for (const movie of allMovies) {
        (movie.searchTerms || []).forEach(termObj => {
            if (termObj && termObj.term) termsSet.add(termObj.term);
        });
    }
    availableTerms = Array.from(termsSet).sort();
}

async function removeTermFromAllMovies(term) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.searchTerms && movie.searchTerms.some(t => t.term === term)) {
            movie.searchTerms = movie.searchTerms.filter(t => t.term !== term);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

async function editTermGlobally(oldTerm, newTerm) {
    if (oldTerm === newTerm || !newTerm.trim()) return;
    await renameTermInAllMovies(oldTerm, newTerm.trim());
    if (activeTermFilter === oldTerm) activeTermFilter = newTerm.trim();
    if (relatedTermFilter === oldTerm) relatedTermFilter = newTerm.trim();
    await refreshAvailableTerms();
    await loadAndDisplayAll();
}

async function deleteMoviesWithTermFromCurrentView(term) {
    let moviesToProcess;
    if (activeTrashFilter) {
        moviesToProcess = await getTrashMovies();
    } else {
        moviesToProcess = await getAllMovies();
        if (activeTermFilter) {
            moviesToProcess = moviesToProcess.filter(movie => (movie.searchTerms || []).some(t => t.term === activeTermFilter && t.exact === true));
        } else if (activeRelatedFilter && relatedTermFilter) {
            moviesToProcess = moviesToProcess.filter(movie => (movie.searchTerms || []).some(t => t.term === relatedTermFilter && t.exact === false));
        } else {
            if (activeWatchingFilter) moviesToProcess = moviesToProcess.filter(movie => movie.watching === true);
            if (activeFavoriteFilter) moviesToProcess = moviesToProcess.filter(movie => movie.favorite === true);
        }
    }
    const moviesWithTerm = moviesToProcess.filter(movie => (movie.searchTerms || []).some(t => t.term === term));
    if (moviesWithTerm.length === 0) return;

    const confirmMsg = activeTrashFilter
        ? `Permanently delete ${moviesWithTerm.length} movie(s) with term "${term}" from trash?`
        : `Move ${moviesWithTerm.length} movie(s) with term "${term}" to trash?`;
    if (!confirm(confirmMsg)) return;

    for (const movie of moviesWithTerm) {
        if (activeTrashFilter) {
            await permanentlyDeleteMovie(movie.youtubeId);
        } else {
            await moveMovieToTrash(movie.youtubeId);
        }
    }
    if (activeTermFilter === term) activeTermFilter = null;
    if (relatedTermFilter === term) relatedTermFilter = null;
    await refreshAvailableTerms();
    await loadAndDisplayAll();
}

function renderTermsBar(termsArray = null, mode = 'normal') {
    const terms = termsArray !== null ? termsArray : availableTerms;
    if (terms.length === 0) {
        termsBar.innerHTML = '<div class="terms-placeholder">No search terms yet</div>';
        return;
    }
    const activeTerm = (mode === 'related') ? relatedTermFilter : activeTermFilter;
    const html = terms.map(term => `
        <button class="btn btn-secondary btn-sm ${activeTerm === term ? 'active' : ''}" data-term="${escapeHtml(term)}">
            ${escapeHtml(term)}
            <span class="term-edit material-symbols-outlined" data-term="${escapeHtml(term)}" title="Edit term globally">edit</span>
            <span class="term-delete" data-term="${escapeHtml(term)}" title="Delete term from all movies">✖</span>
        </button>
    `).join('');
    termsBar.innerHTML = html;

    document.querySelectorAll('#termsBar .btn').forEach(btn => {
        const term = btn.dataset.term;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('term-edit') || e.target.classList.contains('term-delete')) return;
            if (mode === 'related') {
                if (relatedTermFilter === term) relatedTermFilter = null;
                else relatedTermFilter = term;
                loadAndDisplayAll();
            } else {
                if (activeTermFilter === term) activeTermFilter = null;
                else activeTermFilter = term;
                loadAndDisplayAll();
            }
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
            if (mode === 'related' && relatedTermFilter === term) relatedTermFilter = null;
            else if (activeTermFilter === term) activeTermFilter = null;
            await deleteMoviesWithTermFromCurrentView(term);
        });
    });
}

// ---------------------- Toggle Terms Bar visibility ----------------------
if (toggleTermsBtn && termsBar) {
    toggleTermsBtn.addEventListener('click', () => {
        const isHidden = termsBar.classList.toggle('hidden');
        if (isHidden) {
            toggleTermsBtn.classList.remove('active');
        } else {
            toggleTermsBtn.classList.add('active');
        }
    });
}

// ---------------------- Filter buttons ----------------------
function updateFilterButtonsUI() {
    if (activeWatchingFilter) filterWatchingBtn.classList.add('active');
    else filterWatchingBtn.classList.remove('active');
    if (activeFavoriteFilter) filterFavoriteBtn.classList.add('active');
    else filterFavoriteBtn.classList.remove('active');
    if (activeTrashFilter) filterTrashBtn.classList.add('active');
    else filterTrashBtn.classList.remove('active');
    if (activeRelatedFilter) filterRelatedBtn.classList.add('active');
    else filterRelatedBtn.classList.remove('active');
}

function toggleWatchingFilter() {
    activeTermFilter = null;
    relatedTermFilter = null;
    activeRelatedFilter = false;
    if (activeTrashFilter) {
        activeTrashFilter = false;
        updateFilterButtonsUI();
    }
    activeWatchingFilter = !activeWatchingFilter;
    if (activeWatchingFilter) {
        activeFavoriteFilter = false;
        activeRelatedFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleFavoriteFilter() {
    activeTermFilter = null;
    relatedTermFilter = null;
    activeRelatedFilter = false;
    if (activeTrashFilter) {
        activeTrashFilter = false;
        updateFilterButtonsUI();
    }
    activeFavoriteFilter = !activeFavoriteFilter;
    if (activeFavoriteFilter) {
        activeWatchingFilter = false;
        activeRelatedFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleTrashFilter() {
    activeTermFilter = null;
    relatedTermFilter = null;
    activeRelatedFilter = false;
    activeTrashFilter = !activeTrashFilter;
    if (activeTrashFilter) {
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleRelatedFilter() {
    activeTermFilter = null;
    relatedTermFilter = null;
    if (activeTrashFilter || activeWatchingFilter || activeFavoriteFilter) {
        activeTrashFilter = false;
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
        updateFilterButtonsUI();
    }
    activeRelatedFilter = !activeRelatedFilter;
    if (activeRelatedFilter) {
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
        activeTrashFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

if (filterWatchingBtn) filterWatchingBtn.addEventListener('click', toggleWatchingFilter);
if (filterFavoriteBtn) filterFavoriteBtn.addEventListener('click', toggleFavoriteFilter);
if (filterTrashBtn) filterTrashBtn.addEventListener('click', toggleTrashFilter);
if (filterRelatedBtn) filterRelatedBtn.addEventListener('click', toggleRelatedFilter);

// ---------------------- Load and display ----------------------
async function loadAndDisplayAll() {
    await dbReady;
    let allMovies;

    if (activeTrashFilter) {
        allMovies = await getTrashMovies();
        if (activeTermFilter) {
            allMovies = allMovies.filter(movie => (movie.searchTerms || []).some(t => t.term === activeTermFilter));
        }
    } else if (activeRelatedFilter) {
        allMovies = await getAllMovies();
        // Solo películas que tengan ALGÚN término con exact === false
        allMovies = allMovies.filter(movie => (movie.searchTerms || []).some(t => t.exact === false));
        if (relatedTermFilter) {
            allMovies = allMovies.filter(movie => (movie.searchTerms || []).some(t => t.term === relatedTermFilter && t.exact === false));
        }
    } else {
        allMovies = await getAllMovies();
        if (activeTermFilter) {
            // En modo normal (exactos), solo términos exactos
            allMovies = allMovies.filter(movie => (movie.searchTerms || []).some(t => t.term === activeTermFilter && t.exact === true));
        }
        if (activeWatchingFilter) allMovies = allMovies.filter(movie => movie.watching === true);
        if (activeFavoriteFilter) allMovies = allMovies.filter(movie => movie.favorite === true);
    }

    let title;
    if (activeTrashFilter) {
        title = `Trash (${allMovies.length})`;
    } else if (activeWatchingFilter) {
        title = `Watching (${allMovies.length})`;
    } else if (activeFavoriteFilter) {
        title = `Favorites (${allMovies.length})`;
    } else if (activeRelatedFilter) {
        title = relatedTermFilter ? `Related: "${relatedTermFilter}" (${allMovies.length})` : `Related items (${allMovies.length})`;
    } else if (activeTermFilter) {
        title = `Movies: "${activeTermFilter}" (${allMovies.length})`;
    } else {
        title = `All Movies (${allMovies.length})`;
    }

    const onSortChange = (newSort) => {
        currentSort = newSort;
        loadAndDisplayAll();
    };

    renderMovies(resultsGrid, allMovies, title, activeTrashFilter ? 'trash' : 'main', currentSort, onSortChange);

    // Renderizar la barra de términos según el modo
    let termsToShow;
    if (activeTermFilter) {
        termsToShow = [activeTermFilter];
    } else if (activeRelatedFilter) {
        const termsSet = new Set();
        allMovies.forEach(movie => {
            (movie.searchTerms || []).forEach(t => {
                if (t.exact === false) termsSet.add(t.term);
            });
        });
        termsToShow = Array.from(termsSet).sort();
        renderTermsBar(termsToShow, 'related');
    } else {
        const termsSet = new Set();
        allMovies.forEach(movie => {
            (movie.searchTerms || []).forEach(t => {
                if (t.exact === true) termsSet.add(t.term);
            });
        });
        termsToShow = Array.from(termsSet).sort();
        renderTermsBar(termsToShow, 'normal');
    }
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
        // Convertir array de strings a array de objetos { term, exact: true }
        movie.searchTerms = newTerms.map(term => ({ term, exact: true }));
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

window.openMovieModal = (movie, source = 'main') => {
    openModal(movie, {
        updateMovieTerms,
        toggleWatching,
        toggleFavorite,
        moveToTrash: moveMovieToTrash,
        restoreFromTrash: restoreMovieFromTrash,
        permanentlyDelete: permanentlyDeleteMovie
    }, source);
};

// ---------------------- Search ----------------------
searchBtn.onclick = async () => {
    if (activeTrashFilter || activeWatchingFilter || activeFavoriteFilter || activeRelatedFilter) {
        activeTrashFilter = false;
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
        activeRelatedFilter = false;
        updateFilterButtonsUI();
    }
    activeTermFilter = null;
    relatedTermFilter = null;
    
    let query = searchInput.value.trim();
    let effectiveQuery = query;
    let customTermName = null;
    
    if (!query) {
        if (searchOrder === 'viewCount') {
            effectiveQuery = 'movie';
            customTermName = 'Most viewed';
        } else if (searchOrder === 'rating') {
            effectiveQuery = 'movie';
            customTermName = 'Most rated';
        } else {
            resultsGrid.innerHTML = '<div class="stats">Enter a search term</div>';
            return;
        }
    }
    
    const selectedOption = SEARCH_OPTIONS.find(opt => opt.id === currentSearchOptionId);
    if (!selectedOption) return;
    
    if (selectedOption.type === 'api') {
        resultsGrid.innerHTML = '<div class="stats">Searching YouTube...</div>';
        try {
            const channelId = selectedOption.id === 'plato_db' ? null : selectedOption.id;
            const moviesFromAPI = await searchYouTube(effectiveQuery, channelId, searchOrder, searchDuration, searchCategoryFilter);
            if (moviesFromAPI.length === 0) {
                resultsGrid.innerHTML = '<div class="stats">No movies found on YouTube</div>';
                return;
            }
            const termToSave = customTermName ? customTermName : (query || effectiveQuery);
            for (const movie of moviesFromAPI) {
                // Guardar como exacto (true) para los resultados de búsqueda directa
                await saveMovie(movie, termToSave, true);
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
            }
            await refreshAvailableTerms();
            await loadAndDisplayAll();
            searchInput.value = '';
        } catch (err) {
            console.error(err);
            resultsGrid.innerHTML = `<div class="stats">Error: ${err.message}</div>`;
        }
    } else {
        resultsGrid.innerHTML = '<div class="stats">Searching in Plato DB...</div>';
        const allMovies = await getAllMovies();
        const lowerQuery = effectiveQuery.toLowerCase();
        const filtered = allMovies.filter(movie => {
            const titleMatch = movie.title.toLowerCase().includes(lowerQuery);
            const descMatch = movie.description && movie.description.toLowerCase().includes(lowerQuery);
            const termsMatch = (movie.searchTerms || []).some(t => t.term.toLowerCase().includes(lowerQuery));
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
};

// ---------------------- Initialization ----------------------
async function init() {
    await dbReady;
    loadSearchPreferences();
    buildSearchInPanel();
    buildSettingsSidebarContent();
    
    searchInBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchInPanel.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!searchInBtn.contains(e.target) && !searchInPanel.contains(e.target)) {
            searchInPanel.classList.add('hidden');
        }
    });
    
    initModal(async () => {
        await refreshAvailableTerms();
        await loadAndDisplayAll();
    });
    await refreshAvailableTerms();
    await loadAndDisplayAll();
}
init();

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}