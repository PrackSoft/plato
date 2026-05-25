// js/app.js - Plato App (con filtro Related estático)
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
let activeTermFilter = null;
let availableTerms = [];
let currentSort = 'date';

let searchOrder = 'relevance';
let searchDuration = 'long';
let searchCategoryFilter = 'movies';

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
        (movie.searchTerms || []).forEach(t => {
            if (t && typeof t === 'object' && t.term) {
                termsSet.add(t.term);
            } else if (typeof t === 'string') {
                termsSet.add(t);
            }
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
        if (movie.searchTerms) {
            const newTerms = movie.searchTerms.filter(t => {
                const termValue = (t && typeof t === 'object') ? t.term : t;
                return termValue !== term;
            });
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
            moviesToProcess = moviesToProcess.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => {
                    const termValue = (t && typeof t === 'object') ? t.term : t;
                    return termValue === activeTermFilter;
                });
            });
        }
        if (activeWatchingFilter) moviesToProcess = moviesToProcess.filter(movie => movie.watching === true);
        if (activeFavoriteFilter) moviesToProcess = moviesToProcess.filter(movie => movie.favorite === true);
        if (activeRelatedFilter) moviesToProcess = moviesToProcess.filter(movie => {
            const terms = movie.searchTerms || [];
            return terms.some(t => {
                const exact = (t && typeof t === 'object') ? t.exact : true;
                return exact === false;
            });
        });
    }
    const moviesWithTerm = moviesToProcess.filter(movie => {
        const terms = movie.searchTerms || [];
        return terms.some(t => {
            const termValue = (t && typeof t === 'object') ? t.term : t;
            return termValue === term;
        });
    });
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
    await refreshAvailableTerms();
    await loadAndDisplayAll();
}

function renderTermsBar(termsArray = null) {
    const terms = termsArray !== null ? termsArray : availableTerms;
    if (!terms || terms.length === 0) {
        termsBar.innerHTML = '<div class="terms-placeholder">No search terms yet</div>';
        return;
    }
    const html = terms.map(term => {
        const termStr = String(term);
        return `
            <button class="btn btn-secondary btn-sm ${activeTermFilter === termStr ? 'active' : ''}" data-term="${escapeHtml(termStr)}">
                ${escapeHtml(termStr)}
                <span class="term-edit material-symbols-outlined" data-term="${escapeHtml(termStr)}" title="Edit term globally">edit</span>
                <span class="term-delete" data-term="${escapeHtml(termStr)}" title="Delete term from all movies">✖</span>
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
    if (activeRelatedFilter && filterRelatedBtn) filterRelatedBtn.classList.add('active');
    else if (filterRelatedBtn) filterRelatedBtn.classList.remove('active');
}

function toggleWatchingFilter() {
    activeTermFilter = null;
    activeRelatedFilter = false;
    if (activeTrashFilter) {
        activeTrashFilter = false;
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
    activeRelatedFilter = false;
    if (activeTrashFilter) {
        activeTrashFilter = false;
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
    activeRelatedFilter = false;
    activeTrashFilter = !activeTrashFilter;
    if (activeTrashFilter) {
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
        activeRelatedFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleRelatedFilter() {
    activeTermFilter = null;
    activeTrashFilter = false;
    activeRelatedFilter = !activeRelatedFilter;
    if (activeRelatedFilter) {
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
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
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => {
                    const termValue = (t && typeof t === 'object') ? t.term : t;
                    return termValue === activeTermFilter;
                });
            });
        }
    } else {
        allMovies = await getAllMovies();
        
        // Filtrar por término exacto si está activo
        if (activeTermFilter) {
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => {
                    const termValue = (t && typeof t === 'object') ? t.term : t;
                    return termValue === activeTermFilter;
                });
            });
        }
        
        // Aplicar filtros de Watching, Favorites, Related
        if (activeWatchingFilter) allMovies = allMovies.filter(movie => movie.watching === true);
        if (activeFavoriteFilter) allMovies = allMovies.filter(movie => movie.favorite === true);
        if (activeRelatedFilter) {
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => {
                    const exact = (t && typeof t === 'object') ? t.exact : true;
                    return exact === false;
                });
            });
        } else {
            // Si NO hay filtro Related activo, mostrar solo películas que tengan al menos un término exacto (true)
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => {
                    const exact = (t && typeof t === 'object') ? t.exact : true;
                    return exact === true;
                });
            });
        }
    }

    let title;
    if (activeTrashFilter) {
        title = `Trash (${allMovies.length})`;
    } else if (activeWatchingFilter) {
        title = `Watching (${allMovies.length})`;
    } else if (activeFavoriteFilter) {
        title = `Favorites (${allMovies.length})`;
    } else if (activeRelatedFilter) {
        title = `Related results (${allMovies.length})`;
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

    let termsToShow;
    if (activeTermFilter) {
        termsToShow = [activeTermFilter];
    } else {
        const allTerms = new Set();
        for (const movie of allMovies) {
            const terms = movie.searchTerms || [];
            terms.forEach(t => {
                const termValue = (t && typeof t === 'object') ? t.term : t;
                if (termValue) allTerms.add(termValue);
            });
        }
        termsToShow = Array.from(allTerms).sort();
    }
    renderTermsBar(termsToShow);
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
                // Comparar término contra title, description y tags (case insensitive)
                const searchTermLower = termToSave.toLowerCase();
                const titleMatch = movie.title && movie.title.toLowerCase().includes(searchTermLower);
                const descMatch = movie.description && movie.description.toLowerCase().includes(searchTermLower);
                const tagsMatch = movie.tags && Array.isArray(movie.tags) && movie.tags.some(tag => tag.toLowerCase().includes(searchTermLower));
                const isExact = titleMatch || descMatch || tagsMatch;
                
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
            let termsMatch = false;
            const terms = movie.searchTerms || [];
            terms.forEach(t => {
                const termValue = (t && typeof t === 'object') ? t.term : t;
                if (termValue && termValue.toLowerCase().includes(lowerQuery)) termsMatch = true;
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
    return String(str).replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}