// js/app.js - Plato App (con desplegable Collections corregido)
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
const filterCollectionsBtn = document.getElementById('filterCollectionsBtn');
const termsBar = document.getElementById('termsBar');
const directorsBar = document.getElementById('directorsBar');
const actorsBar = document.getElementById('actorsBar');
const genresBar = document.getElementById('genresBar');
const yearsBar = document.getElementById('yearsBar');
const countriesBar = document.getElementById('countriesBar');
const languagesBar = document.getElementById('languagesBar');
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
let activeCollectionsFilter = false;
let activeTermFilter = null;
let activeDirectorFilter = null;
let activeActorFilter = null;
let activeGenreFilter = null;
let activeYearFilter = null;
let activeCountryFilter = null;
let activeLanguageFilter = null;
let availableTerms = [];
let availableDirectors = [];
let availableActors = [];
let availableGenres = [];
let availableYears = [];
let availableCountries = [];
let availableLanguages = [];
let currentSort = 'date';
let collectionsSortBy = 'directors';

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

// ---------------------- Helper: close panels ----------------------
function closeAllPanels() {
    searchInPanel.classList.add('hidden');
    const collectionsPanel = document.getElementById('collectionsPanel');
    if (collectionsPanel) collectionsPanel.classList.add('hidden');
}

function closePanelWithDelay(panel) {
    setTimeout(() => panel.classList.add('hidden'), 150);
}

// ---------------------- Build Search In panel (con filtros integrados) ----------------------
function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    const youtubeSection = document.createElement('div');
    youtubeSection.innerHTML = `
        <div class="dropdown-header">YouTube Free Movies</div>
        <div style="padding: 8px 12px;">
            <div class="settings-group">
                <label class="settings-label">Content type:</label>
                <div class="radio-group">
                    <label><input type="radio" name="searchCategory" value="movies" ${searchCategoryFilter === 'movies' ? 'checked' : ''}> Include only movies</label>
                    <label><input type="radio" name="searchCategory" value="all" ${searchCategoryFilter === 'all' ? 'checked' : ''}> Include non‑movies</label>
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
        </div>
        <div class="dropdown-header" style="margin-top: 8px;">Plato DB</div>
    `;
    searchInPanel.appendChild(youtubeSection);

    const platoDbLabel = document.createElement('label');
    const platoDbRadio = document.createElement('input');
    platoDbRadio.type = 'radio';
    platoDbRadio.name = 'searchIn';
    platoDbRadio.value = 'plato_db';
    platoDbRadio.checked = (currentSearchOptionId === 'plato_db');
    platoDbRadio.addEventListener('change', () => {
        if (platoDbRadio.checked) {
            currentSearchOptionId = 'plato_db';
            updateSearchInButtonText();
            closePanelWithDelay(searchInPanel);
        }
    });
    platoDbLabel.appendChild(platoDbRadio);
    platoDbLabel.appendChild(document.createTextNode(' Plato DB'));
    searchInPanel.appendChild(platoDbLabel);

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
            const label = option ? option.name : 'YouTube Free Movies';
            searchInBtn.innerHTML = `
                <span class="material-symbols-outlined">subscriptions</span>
                ${label}
                <span class="material-symbols-outlined">arrow_drop_down</span>
            `;
        }
    }

    updateSearchInButtonText();
}

// ---------------------- Build Collections dropdown ----------------------
function buildCollectionsDropdown() {
    if (!filterCollectionsBtn) return;
    
    const panel = document.getElementById('collectionsPanel');
    if (!panel) return;
    
    const options = [
        { value: 'directors', label: 'Directors', icon: 'person' },
        { value: 'actors', label: 'Actors', icon: 'group' },
        { value: 'genres', label: 'Genres', icon: 'theater_comedy' },
        { value: 'years', label: 'Years', icon: 'calendar_month' },
        { value: 'countries', label: 'Countries', icon: 'flag' },
        { value: 'languages', label: 'Languages', icon: 'translate' }
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
    
    panel.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = label.dataset.value;
            if (value && value !== collectionsSortBy) {
                collectionsSortBy = value;
                updateCollectionsButtonText();
                // Activar Collections si no está activo
                if (!activeCollectionsFilter) {
                    // Desactivar otros filtros
                    activeWatchingFilter = false;
                    activeFavoriteFilter = false;
                    activeTrashFilter = false;
                    activeRelatedFilter = false;
                    activeCollectionsFilter = true;
                    updateFilterButtonsUI();
                    if (toggleTermsBtn) toggleTermsBtn.classList.remove('active');
                    if (termsBar) termsBar.classList.add('hidden');
                }
                loadAndDisplayAll();
            }
            panel.classList.add('hidden');
        });
    });
    
    // El botón solo abre/cierra el panel, NO activa/desactiva Collections
    filterCollectionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('hidden');
    });
    
    // Cerrar panel al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!filterCollectionsBtn.contains(e.target) && !panel.contains(e.target)) {
            panel.classList.add('hidden');
        }
    });
    
    updateCollectionsButtonText();
}

function updateCollectionsButtonText() {
    if (!filterCollectionsBtn) return;
    let label = 'Collections';
    switch (collectionsSortBy) {
        case 'directors': label = 'Directors'; break;
        case 'actors': label = 'Actors'; break;
        case 'genres': label = 'Genres'; break;
        case 'years': label = 'Years'; break;
        case 'countries': label = 'Countries'; break;
        case 'languages': label = 'Languages'; break;
    }
    filterCollectionsBtn.innerHTML = `
        <span class="material-symbols-outlined">join_inner</span>
        ${label}
        <span class="material-symbols-outlined">arrow_drop_down</span>
    `;
}

// ---------------------- Sidebar functions (settings) ----------------------
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
    let sidebarContent = document.querySelector('.sidebar-content');
    if (!sidebarContent) {
        sidebarContent = document.createElement('div');
        sidebarContent.className = 'sidebar-content';
        settingsSidebar.appendChild(sidebarContent);
    }
    sidebarContent.innerHTML = `
        <div class="sidebar-section">
            <h3>General Settings</h3>
            <p style="color: #aaa; font-size: 0.875rem;">Future options: API key, default channel, theme, etc.</p>
        </div>
    `;
}

// ---------------------- Funciones globales para directores, actores, géneros, años, países, idiomas ----------------------
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
                if (activeRelatedFilter) {
                    if (t.exact === false) termsSet.add(t.term);
                } else {
                    if (t.exact === true) termsSet.add(t.term);
                }
            }
        });
    }
    availableTerms = Array.from(termsSet).sort();
}

export async function refreshAvailableDirectors() {
    const allMovies = await getAllMovies();
    const directorsSet = new Set();
    for (const movie of allMovies) {
        (movie.directors || []).forEach(d => directorsSet.add(d));
    }
    availableDirectors = Array.from(directorsSet).sort();
}

export async function refreshAvailableActors() {
    const allMovies = await getAllMovies();
    const actorsSet = new Set();
    for (const movie of allMovies) {
        (movie.actors || []).forEach(a => actorsSet.add(a));
    }
    availableActors = Array.from(actorsSet).sort();
}

export async function refreshAvailableGenres() {
    const allMovies = await getAllMovies();
    const genresSet = new Set();
    for (const movie of allMovies) {
        (movie.genres || []).forEach(g => genresSet.add(g));
    }
    availableGenres = Array.from(genresSet).sort();
}

export async function refreshAvailableYears() {
    const allMovies = await getAllMovies();
    const yearsSet = new Set();
    for (const movie of allMovies) {
        (movie.years || []).forEach(y => yearsSet.add(y));
    }
    availableYears = Array.from(yearsSet).sort();
}

export async function refreshAvailableCountries() {
    const allMovies = await getAllMovies();
    const countriesSet = new Set();
    for (const movie of allMovies) {
        (movie.countries || []).forEach(c => countriesSet.add(c));
    }
    availableCountries = Array.from(countriesSet).sort();
}

export async function refreshAvailableLanguages() {
    const allMovies = await getAllMovies();
    const languagesSet = new Set();
    for (const movie of allMovies) {
        (movie.languages || []).forEach(l => languagesSet.add(l));
    }
    availableLanguages = Array.from(languagesSet).sort();
}

export async function termHasChildren(term) {
    const allMovies = await getAllMovies();
    for (const movie of allMovies) {
        const found = (movie.searchTerms || []).some(t => {
            if (t && typeof t === 'object' && t.term === term) {
                if (activeRelatedFilter) {
                    return t.exact === false;
                } else {
                    return t.exact === true;
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
        if (activeRelatedFilter) {
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

// Funciones de edición/eliminación para directores, actores, géneros, años, países, idiomas
async function editDirectorGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameDirectorInAllMovies(oldName, newName.trim());
    if (activeDirectorFilter === oldName) activeDirectorFilter = newName.trim();
    await refreshAvailableDirectors();
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
    await refreshAvailableDirectors();
    await loadAndDisplayAll();
}

async function editActorGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameActorInAllMovies(oldName, newName.trim());
    if (activeActorFilter === oldName) activeActorFilter = newName.trim();
    await refreshAvailableActors();
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
    await refreshAvailableActors();
    await loadAndDisplayAll();
}

async function editGenreGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameGenreInAllMovies(oldName, newName.trim());
    if (activeGenreFilter === oldName) activeGenreFilter = newName.trim();
    await refreshAvailableGenres();
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
    await refreshAvailableGenres();
    await loadAndDisplayAll();
}

async function editYearGlobally(oldYear, newYear) {
    if (oldYear === newYear || !newYear.trim()) return;
    await renameYearInAllMovies(oldYear, newYear.trim());
    if (activeYearFilter === oldYear) activeYearFilter = newYear.trim();
    await refreshAvailableYears();
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
    await refreshAvailableYears();
    await loadAndDisplayAll();
}

async function editCountryGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameCountryInAllMovies(oldName, newName.trim());
    if (activeCountryFilter === oldName) activeCountryFilter = newName.trim();
    await refreshAvailableCountries();
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
    await refreshAvailableCountries();
    await loadAndDisplayAll();
}

async function editLanguageGlobally(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    await renameLanguageInAllMovies(oldName, newName.trim());
    if (activeLanguageFilter === oldName) activeLanguageFilter = newName.trim();
    await refreshAvailableLanguages();
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
    await refreshAvailableLanguages();
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

function renderDirectorsBar() {
    if (!directorsBar) return;
    if (availableDirectors.length === 0) {
        directorsBar.innerHTML = '<div class="terms-placeholder">No directors yet.</div>';
        directorsBar.classList.remove('hidden');
        return;
    }
    directorsBar.classList.remove('hidden');
    const html = availableDirectors.map(name => `
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

function renderActorsBar() {
    if (!actorsBar) return;
    if (availableActors.length === 0) {
        actorsBar.innerHTML = '<div class="terms-placeholder">No Actors yet.</div>';
        actorsBar.classList.remove('hidden');
        return;
    }
    actorsBar.classList.remove('hidden');
    const html = availableActors.map(name => `
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

function renderGenresBar() {
    if (!genresBar) return;
    if (availableGenres.length === 0) {
        genresBar.innerHTML = '<div class="terms-placeholder">No Genres yet.</div>';
        genresBar.classList.remove('hidden');
        return;
    }
    genresBar.classList.remove('hidden');
    const html = availableGenres.map(name => `
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

function renderYearsBar() {
    if (!yearsBar) return;
    if (availableYears.length === 0) {
        yearsBar.innerHTML = '<div class="terms-placeholder">No years yet.</div>';
        yearsBar.classList.remove('hidden');
        return;
    }
    yearsBar.classList.remove('hidden');
    const html = availableYears.map(year => `
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

function renderCountriesBar() {
    if (!countriesBar) return;
    if (availableCountries.length === 0) {
        countriesBar.innerHTML = '<div class="terms-placeholder">No countries yet.</div>';
        countriesBar.classList.remove('hidden');
        return;
    }
    countriesBar.classList.remove('hidden');
    const html = availableCountries.map(name => `
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

function renderLanguagesBar() {
    if (!languagesBar) return;
    if (availableLanguages.length === 0) {
        languagesBar.innerHTML = '<div class="terms-placeholder">No languages yet.</div>';
        languagesBar.classList.remove('hidden');
        return;
    }
    languagesBar.classList.remove('hidden');
    const html = availableLanguages.map(name => `
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
    toggleTermsBtn.addEventListener('click', () => {
        if (activeCollectionsFilter) {
            activeCollectionsFilter = false;
            updateFilterButtonsUI();
        }
        const isHidden = termsBar.classList.toggle('hidden');
        if (isHidden) {
            toggleTermsBtn.classList.remove('active');
        } else {
            toggleTermsBtn.classList.add('active');
        }
        loadAndDisplayAll();
    });
}

// ---------------------- Filter buttons UI update ----------------------
function updateFilterButtonsUI() {
    if (activeWatchingFilter) filterWatchingBtn.classList.add('active');
    else filterWatchingBtn.classList.remove('active');
    if (activeFavoriteFilter) filterFavoriteBtn.classList.add('active');
    else filterFavoriteBtn.classList.remove('active');
    if (activeTrashFilter) filterTrashBtn.classList.add('active');
    else filterTrashBtn.classList.remove('active');
    if (activeRelatedFilter && filterRelatedBtn) filterRelatedBtn.classList.add('active');
    else if (filterRelatedBtn) filterRelatedBtn.classList.remove('active');
    if (activeCollectionsFilter && filterCollectionsBtn) filterCollectionsBtn.classList.add('active');
    else if (filterCollectionsBtn) filterCollectionsBtn.classList.remove('active');
}

// ---------------------- Toggle functions (excluyendo Collections, que ahora maneja el dropdown) ----------------------
function toggleWatchingFilter() {
    activeTermFilter = null;
    activeDirectorFilter = null;
    activeActorFilter = null;
    activeGenreFilter = null;
    activeYearFilter = null;
    activeCountryFilter = null;
    activeLanguageFilter = null;
    activeCollectionsFilter = false;
    syncWindowTermFilter();
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
    activeDirectorFilter = null;
    activeActorFilter = null;
    activeGenreFilter = null;
    activeYearFilter = null;
    activeCountryFilter = null;
    activeLanguageFilter = null;
    activeCollectionsFilter = false;
    syncWindowTermFilter();
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
    activeDirectorFilter = null;
    activeActorFilter = null;
    activeGenreFilter = null;
    activeYearFilter = null;
    activeCountryFilter = null;
    activeLanguageFilter = null;
    activeCollectionsFilter = false;
    syncWindowTermFilter();
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
    activeDirectorFilter = null;
    activeActorFilter = null;
    activeGenreFilter = null;
    activeYearFilter = null;
    activeCountryFilter = null;
    activeLanguageFilter = null;
    activeCollectionsFilter = false;
    syncWindowTermFilter();
    activeTrashFilter = false;
    activeRelatedFilter = !activeRelatedFilter;
    if (activeRelatedFilter) {
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

// toggleCollectionsFilter ya no se usa para el botón principal, pero se mantiene por si otros lugares la llaman
function toggleCollectionsFilter() {
    // Esta función ya no se ejecuta desde el botón Collections
    // Se mantiene por compatibilidad, pero no hace nada
}

if (filterWatchingBtn) filterWatchingBtn.addEventListener('click', toggleWatchingFilter);
if (filterFavoriteBtn) filterFavoriteBtn.addEventListener('click', toggleFavoriteFilter);
if (filterTrashBtn) filterTrashBtn.addEventListener('click', toggleTrashFilter);
if (filterRelatedBtn) filterRelatedBtn.addEventListener('click', toggleRelatedFilter);
// El botón Collections ya tiene su propio listener en buildCollectionsDropdown

// ---------------------- Load and display ----------------------
export async function loadAndDisplayAll() {
    await dbReady;
    let allMovies;

    if (activeCollectionsFilter) {
        allMovies = await getAllMovies();
        allMovies = allMovies.filter(movie => {
            const hasDirectors = (movie.directors || []).length > 0;
            const hasActors = (movie.actors || []).length > 0;
            const hasGenres = (movie.genres || []).length > 0;
            const hasYears = (movie.years || []).length > 0;
            const hasCountries = (movie.countries || []).length > 0;
            const hasLanguages = (movie.languages || []).length > 0;
            return hasDirectors || hasActors || hasGenres || hasYears || hasCountries || hasLanguages;
        });
        
        // Aplicar filtro por el chip seleccionado según el tipo de colección
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
        }
        
        // Ordenar alfabéticamente según el campo del grupo
        if (collectionsSortBy === 'directors') {
            allMovies.sort((a, b) => {
                const aVal = a.directors && a.directors[0] ? a.directors[0] : '';
                const bVal = b.directors && b.directors[0] ? b.directors[0] : '';
                return aVal.localeCompare(bVal);
            });
        } else if (collectionsSortBy === 'actors') {
            allMovies.sort((a, b) => {
                const aVal = a.actors && a.actors[0] ? a.actors[0] : '';
                const bVal = b.actors && b.actors[0] ? b.actors[0] : '';
                return aVal.localeCompare(bVal);
            });
        } else if (collectionsSortBy === 'genres') {
            allMovies.sort((a, b) => {
                const aVal = a.genres && a.genres[0] ? a.genres[0] : '';
                const bVal = b.genres && b.genres[0] ? b.genres[0] : '';
                return aVal.localeCompare(bVal);
            });
        } else if (collectionsSortBy === 'years') {
            allMovies.sort((a, b) => {
                const aVal = a.years && a.years[0] ? a.years[0] : '';
                const bVal = b.years && b.years[0] ? b.years[0] : '';
                return aVal.localeCompare(bVal);
            });
        } else if (collectionsSortBy === 'countries') {
            allMovies.sort((a, b) => {
                const aVal = a.countries && a.countries[0] ? a.countries[0] : '';
                const bVal = b.countries && b.countries[0] ? b.countries[0] : '';
                return aVal.localeCompare(bVal);
            });
        } else if (collectionsSortBy === 'languages') {
            allMovies.sort((a, b) => {
                const aVal = a.languages && a.languages[0] ? a.languages[0] : '';
                const bVal = b.languages && b.languages[0] ? b.languages[0] : '';
                return aVal.localeCompare(bVal);
            });
        }
    } else if (activeTrashFilter) {
        allMovies = await getTrashMovies();
        if (activeTermFilter) {
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => t.term === activeTermFilter);
            });
        }
    } else {
        allMovies = await getAllMovies();
        
        if (activeTermFilter) {
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];
                return terms.some(t => t.term === activeTermFilter);
            });
        }
        
        if (activeWatchingFilter) allMovies = allMovies.filter(movie => movie.watching === true);
        if (activeFavoriteFilter) allMovies = allMovies.filter(movie => movie.favorite === true);
        if (activeRelatedFilter) {
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];

                if (activeTermFilter) {
                    return terms.some(t =>
                        t.term === activeTermFilter &&
                        t.exact === false
                    );
                }

                return terms.some(t => t.exact === false);
            });
        } else {
            allMovies = allMovies.filter(movie => {
                const terms = movie.searchTerms || [];

                if (activeTermFilter) {
                    return terms.some(t =>
                        t.term === activeTermFilter &&
                        t.exact === true
                    );
                }

                return terms.some(t => t.exact === true);
            });
        }
        
        if (activeDirectorFilter) {
            allMovies = allMovies.filter(movie => (movie.directors || []).includes(activeDirectorFilter));
        }
        if (activeActorFilter) {
            allMovies = allMovies.filter(movie => (movie.actors || []).includes(activeActorFilter));
        }
        if (activeGenreFilter) {
            allMovies = allMovies.filter(movie => (movie.genres || []).includes(activeGenreFilter));
        }
        if (activeYearFilter) {
            allMovies = allMovies.filter(movie => (movie.years || []).includes(activeYearFilter));
        }
        if (activeCountryFilter) {
            allMovies = allMovies.filter(movie => (movie.countries || []).includes(activeCountryFilter));
        }
        if (activeLanguageFilter) {
            allMovies = allMovies.filter(movie => (movie.languages || []).includes(activeLanguageFilter));
        }
    }

    let title;
    if (activeCollectionsFilter) {
        let sortLabel = '';
        if (collectionsSortBy === 'directors') sortLabel = 'Director';
        else if (collectionsSortBy === 'actors') sortLabel = 'Actor';
        else if (collectionsSortBy === 'genres') sortLabel = 'Genre';
        else if (collectionsSortBy === 'years') sortLabel = 'Year';
        else if (collectionsSortBy === 'countries') sortLabel = 'Country';
        else if (collectionsSortBy === 'languages') sortLabel = 'Language';
        
        let filterName = '';
        if (collectionsSortBy === 'directors' && activeDirectorFilter) filterName = `: ${activeDirectorFilter}`;
        else if (collectionsSortBy === 'actors' && activeActorFilter) filterName = `: ${activeActorFilter}`;
        else if (collectionsSortBy === 'genres' && activeGenreFilter) filterName = `: ${activeGenreFilter}`;
        else if (collectionsSortBy === 'years' && activeYearFilter) filterName = `: ${activeYearFilter}`;
        else if (collectionsSortBy === 'countries' && activeCountryFilter) filterName = `: ${activeCountryFilter}`;
        else if (collectionsSortBy === 'languages' && activeLanguageFilter) filterName = `: ${activeLanguageFilter}`;
        
        title = `Collections (${sortLabel}${filterName}) (${allMovies.length})`;
    } else if (activeTrashFilter) {
        title = `Trash (${allMovies.length})`;
    } else if (activeWatchingFilter) {
        title = `Watching (${allMovies.length})`;
    } else if (activeFavoriteFilter) {
        title = `Favorites (${allMovies.length})`;
    } else if (activeRelatedFilter) {
        title = `Related results (${allMovies.length})`;
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
    } else {
        title = `Exact match (${allMovies.length})`;
    }

    const onSortChange = (newSort) => {
        if (activeCollectionsFilter) {
            collectionsSortBy = newSort;
            updateCollectionsButtonText();
            activeDirectorFilter = null;
            activeActorFilter = null;
            activeGenreFilter = null;
            activeYearFilter = null;
            activeCountryFilter = null;
            activeLanguageFilter = null;
            loadAndDisplayAll();
        } else {
            currentSort = newSort;
            loadAndDisplayAll();
        }
    };

    if (activeCollectionsFilter) {
        renderMovies(resultsGrid, allMovies, title, 'main', 'collections', null);
    } else {
        renderMovies(resultsGrid, allMovies, title, activeTrashFilter ? 'trash' : 'main', currentSort, onSortChange);
    }

    let termsToShow;

    if (!activeCollectionsFilter) {
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
                    if (activeRelatedFilter) {
                        if (t.exact === false) allTerms.add(t.term);
                    } else {
                        if (t.exact === true) allTerms.add(t.term);
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
    } else {
        if (collectionsSortBy === 'directors') {
            await refreshAvailableDirectors();
            renderDirectorsBar();
            if (actorsBar) actorsBar.classList.add('hidden');
            if (genresBar) genresBar.classList.add('hidden');
            if (yearsBar) yearsBar.classList.add('hidden');
            if (countriesBar) countriesBar.classList.add('hidden');
            if (languagesBar) languagesBar.classList.add('hidden');
        } else if (collectionsSortBy === 'actors') {
            await refreshAvailableActors();
            renderActorsBar();
            if (directorsBar) directorsBar.classList.add('hidden');
            if (genresBar) genresBar.classList.add('hidden');
            if (yearsBar) yearsBar.classList.add('hidden');
            if (countriesBar) countriesBar.classList.add('hidden');
            if (languagesBar) languagesBar.classList.add('hidden');
        } else if (collectionsSortBy === 'genres') {
            await refreshAvailableGenres();
            renderGenresBar();
            if (directorsBar) directorsBar.classList.add('hidden');
            if (actorsBar) actorsBar.classList.add('hidden');
            if (yearsBar) yearsBar.classList.add('hidden');
            if (countriesBar) countriesBar.classList.add('hidden');
            if (languagesBar) languagesBar.classList.add('hidden');
        } else if (collectionsSortBy === 'years') {
            await refreshAvailableYears();
            renderYearsBar();
            if (directorsBar) directorsBar.classList.add('hidden');
            if (actorsBar) actorsBar.classList.add('hidden');
            if (genresBar) genresBar.classList.add('hidden');
            if (countriesBar) countriesBar.classList.add('hidden');
            if (languagesBar) languagesBar.classList.add('hidden');
        } else if (collectionsSortBy === 'countries') {
            await refreshAvailableCountries();
            renderCountriesBar();
            if (directorsBar) directorsBar.classList.add('hidden');
            if (actorsBar) actorsBar.classList.add('hidden');
            if (genresBar) genresBar.classList.add('hidden');
            if (yearsBar) yearsBar.classList.add('hidden');
            if (languagesBar) languagesBar.classList.add('hidden');
        } else if (collectionsSortBy === 'languages') {
            await refreshAvailableLanguages();
            renderLanguagesBar();
            if (directorsBar) directorsBar.classList.add('hidden');
            if (actorsBar) actorsBar.classList.add('hidden');
            if (genresBar) genresBar.classList.add('hidden');
            if (yearsBar) yearsBar.classList.add('hidden');
            if (countriesBar) countriesBar.classList.add('hidden');
        }
        return;
    }
    
    await refreshAvailableDirectors();
    await refreshAvailableActors();
    await refreshAvailableGenres();
    await refreshAvailableYears();
    await refreshAvailableCountries();
    await refreshAvailableLanguages();
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
    if (activeTrashFilter || activeWatchingFilter || activeFavoriteFilter || activeRelatedFilter || activeCollectionsFilter) {
        activeTrashFilter = false;
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
        activeRelatedFilter = false;
        activeCollectionsFilter = false;
        updateFilterButtonsUI();
    }
    activeTermFilter = null;
    activeDirectorFilter = null;
    activeActorFilter = null;
    activeGenreFilter = null;
    activeYearFilter = null;
    activeCountryFilter = null;
    activeLanguageFilter = null;
    syncWindowTermFilter();
    
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
        resultsGrid.innerHTML = '<div class="stats">Searching YouTube Movies...</div>';
        try {
            const channelId = selectedOption.id === 'plato_db' ? null : selectedOption.id;
            const moviesFromAPI = await searchYouTube(effectiveQuery, channelId, searchOrder, searchDuration, searchCategoryFilter);
            if (moviesFromAPI.length === 0) {
                resultsGrid.innerHTML = '<div class="stats">No results found on YouTube Movies</div>';
                return;
            }
            const termToSave = customTermName ? customTermName : (query || effectiveQuery);
            for (const movie of moviesFromAPI) {
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
};

// ---------------------- Initialization ----------------------
async function init() {
    await dbReady;
    loadSearchPreferences();
    buildSearchInPanel();
    buildCollectionsDropdown();
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