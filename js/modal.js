// js/modal.js - Modal para editar metadatos de películas
// Soporta entrada múltiple separada por comas en todos los campos (Search term, Director, Actor, etc.)

import { getExtraInfo, toggleExact, addDirector, removeDirector, addActor, removeActor, addGenre, removeGenre, addYear, removeYear, addCountry, removeCountry, addLanguage, removeLanguage, addTag, removeTag, openDB } from './db.js';
import { refreshAvailableTerms, loadAndDisplayAll, syncWindowTermFilter, getActiveTermFilter } from './app.js';

// ---------------------- Estado global del modal ----------------------
let currentMovie = null;           // Película actualmente abierta
let currentOnUpdate = null;        // Callback para actualizar la UI principal
let currentMovieSource = null;     // 'main' o 'trash'
let currentTrashFunctions = null;  // Funciones de papelera
let extraInfoVisible = false;      // Estado del panel de info extra

// ---------------------- Inicialización ----------------------
export function initModal(onUpdateCallback) {
    currentOnUpdate = onUpdateCallback;
    const modal = document.getElementById('movieModal');
    const closeBtn = document.querySelector('.close-modal');
    const watchBtn = document.getElementById('watchMovieBtn');

    if (closeBtn) closeBtn.onclick = () => closeModal();
    if (watchBtn) watchBtn.onclick = () => {
        if (currentMovie && currentMovie.url) window.open(currentMovie.url);
    };
    window.onclick = (e) => { if (e.target === modal) closeModal(); };
}

// ---------------------- Abrir modal ----------------------
export async function openModal(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source = 'main') {
    currentMovie = movie;
    currentMovieSource = source;
    currentTrashFunctions = { moveToTrash, restoreFromTrash, permanentlyDelete };
    const modal = document.getElementById('movieModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = renderModalContent(movie, source);
    modal.style.display = 'flex';
    extraInfoVisible = false;

    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
}

// ---------------------- Cerrar modal ----------------------
function closeModal() {
    const modal = document.getElementById('movieModal');
    if (modal) modal.style.display = 'none';
    currentMovie = null;
    currentMovieSource = null;
    currentTrashFunctions = null;
    extraInfoVisible = false;
}

// ---------------------- Renderizar contenido del modal ----------------------
function renderModalContent(movie, source) {
    const isInTrash = (source === 'trash');
    const watchingIconName = movie.watching ? 'visibility' : 'visibility_off';
    const favoriteIconName = movie.favorite ? 'star_shine' : 'star';
    
    const showExactToggle = window.activeTermFilter && !isInTrash;
    const exactForCurrentTerm = showExactToggle && movie.searchTerms?.some(t => t.term === window.activeTermFilter && t.exact === true);
    const toggleIcon = exactForCurrentTerm ? 'graph_4' : 'subscriptions';
    const toggleLabel = exactForCurrentTerm ? 'Move to Related' : 'Move to Exact';
    
    const tagsHtml = movie.tags && Array.isArray(movie.tags) && movie.tags.length > 0
        ? `<p><strong>Tags:</strong> ${escapeHtml(movie.tags.join(', '))}</p>`
        : '';

    const directors = movie.directors || [];
    const actors = movie.actors || [];
    const genres = movie.genres || [];
    const years = movie.years || [];
    const countries = movie.countries || [];
    const languages = movie.languages || [];

    return `
        <div class="modal-header">
            <div class="modal-spacer"></div>
            <h2>${escapeHtml(movie.title)}</h2>
            <div class="modal-spacer"></div>
        </div>
        <img class="modal-image" src="${movie.imageUrl}" alt="${movie.title}">
        <p><strong>Year:</strong> ${movie.publishedAt ? new Date(movie.publishedAt).toLocaleDateString() : 'Unknown year'}</p>
        <div class="modal-description">${escapeHtml(movie.description || 'No Description')}</div>
        ${tagsHtml}
        <p><strong>Duration:</strong> ${formatDuration(movie.duration)}</p>
        <p><strong>Saved on:</strong> ${new Date(movie.dateSaved).toLocaleString()}</p>
        ${isInTrash ? `<p><strong>Deleted on:</strong> ${movie.deletedAt ? new Date(movie.deletedAt).toLocaleString() : 'Unknown date'}</p>` : ''}
        
        <!-- ========== SEARCH TERM SECTION ========== -->
        <div class="modal-section">
            <strong>Search term:</strong>
            <div id="termsList" class="terms-list">
                ${(movie.searchTerms || []).map(t => `
                    <span class="term-chip">
                        ${escapeHtml(t.term)}
                        ${!isInTrash ? `<span class="remove-term" data-term="${escapeHtml(t.term)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newTermInput" class="modal-input" placeholder="Add new term (separate multiple with commas)">
                <span id="addTermBtn" class="modal-add-icon" title="Add term">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- ========== DIRECTOR SECTION ========== -->
        <div class="modal-section">
            <strong>Director:</strong>
            <div id="directorsList" class="terms-list">
                ${directors.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-director" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newDirectorInput" class="modal-input" placeholder="Add director (separate multiple with commas)">
                <span id="addDirectorBtn" class="modal-add-icon" title="Add director">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- ========== ACTOR SECTION ========== -->
        <div class="modal-section">
            <strong>Actor:</strong>
            <div id="actorsList" class="terms-list">
                ${actors.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-actor" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newActorInput" class="modal-input" placeholder="Add actor (separate multiple with commas)">
                <span id="addActorBtn" class="modal-add-icon" title="Add actor">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- ========== GENRE SECTION ========== -->
        <div class="modal-section">
            <strong>Genre:</strong>
            <div id="genresList" class="terms-list">
                ${genres.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-genre" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newGenreInput" class="modal-input" placeholder="Add genre (separate multiple with commas)">
                <span id="addGenreBtn" class="modal-add-icon" title="Add genre">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- ========== YEAR SECTION ========== -->
        <div class="modal-section">
            <strong>Year:</strong>
            <div id="yearsList" class="terms-list">
                ${years.map(year => `
                    <span class="term-chip">
                        ${escapeHtml(year)}
                        ${!isInTrash ? `<span class="remove-year" data-name="${escapeHtml(year)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newYearInput" class="modal-input" placeholder="Add year (separate multiple with commas)">
                <span id="addYearBtn" class="modal-add-icon" title="Add year">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- ========== COUNTRY SECTION ========== -->
        <div class="modal-section">
            <strong>Country:</strong>
            <div id="countriesList" class="terms-list">
                ${countries.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-country" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newCountryInput" class="modal-input" placeholder="Add country (separate multiple with commas)">
                <span id="addCountryBtn" class="modal-add-icon" title="Add country">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- ========== LANGUAGE SECTION ========== -->
        <div class="modal-section">
            <strong>Language:</strong>
            <div id="languagesList" class="terms-list">
                ${languages.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-language" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newLanguageInput" class="modal-input" placeholder="Add language (separate multiple with commas)">
                <span id="addLanguageBtn" class="modal-add-icon" title="Add language">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- ========== TAGS SECTION ========== -->
        <div class="modal-section">
            <strong>Tags:</strong>
            <div id="tagsList" class="terms-list">
                ${(movie.tags || []).map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-tag" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newTagInput" class="modal-input" placeholder="Add tag (separate multiple with commas)">
                <span id="addTagBtn" class="modal-add-icon" title="Add tag">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- ========== TOGGLES: WATCHING / FAVORITE ========== -->
        <div class="modal-section toggle-row ${isInTrash ? 'disabled' : ''}" id="watchingToggleRow">
            <span>Watching:</span>
            <span class="material-symbols-outlined" id="modalWatchingIcon">${watchingIconName}</span>
        </div>

        <div class="modal-section toggle-row ${isInTrash ? 'disabled' : ''}" id="favoriteToggleRow">
            <span>Favorite:</span>
            <span class="material-symbols-outlined" id="modalFavoriteIcon">${favoriteIconName}</span>
        </div>

        <!-- ========== TRASH ACTIONS ========== -->
        ${!isInTrash ? `
        <div class="modal-section toggle-row" id="moveToTrashRow">
            <span>Move to Trash:</span>
            <span class="material-symbols-outlined">delete</span>
        </div>
        ` : `
        <div class="modal-section trash-actions">
            <div class="toggle-row" id="restoreRow">
                <span>Restore:</span>
                <span class="material-symbols-outlined">restore_from_trash</span>
            </div>
            <div class="toggle-row" id="permanentDeleteRow">
                <span>Delete Permanently:</span>
                <span class="material-symbols-outlined">delete_forever</span>
            </div>
        </div>
        `}

        <!-- ========== EXACT/RELATED TOGGLE (solo si hay filtro activo) ========== -->
        ${showExactToggle ? `
        <div class="modal-section toggle-row" id="toggleExactRow">
            <span>${toggleLabel}:</span>
            <span class="material-symbols-outlined">${toggleIcon}</span>
        </div>
        ` : ''}

        <!-- ========== EXTRA INFO BUTTON ========== -->
        <div class="modal-section">
            <button id="toggleExtraInfoBtn" class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 0;">
                <span class="material-symbols-outlined">info</span> Extra Info
            </button>
            <div id="extraInfoPanel" class="extra-info-panel hidden" style="margin-top: 12px;"></div>
        </div>
    `;
}

// ---------------------- Función auxiliar: dividir string por comas y limpiar ----------------------
// Convierte "Woody Allen, Mia Farrow" en ["Woody Allen", "Mia Farrow"]
function splitByCommas(input) {
    if (!input || !input.trim()) return [];
    return input.split(',').map(s => s.trim()).filter(s => s);
}

// ---------------------- Función auxiliar: agregar múltiples términos (Search term) ----------------------
async function addMultipleTerms(movieId, termsString, updateMovieTermsFn) {
    const terms = splitByCommas(termsString);
    if (terms.length === 0) return;
    
    // Obtener términos existentes
    const db = await openDB();
    const transaction = db.transaction(['movies'], 'readonly');
    const store = transaction.objectStore('movies');
    const movie = await new Promise((resolve, reject) => {
        const req = store.get(movieId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    
    if (movie) {
        const existingTerms = (movie.searchTerms || []).map(t => t.term);
        const newTermsArray = [...existingTerms];
        let added = false;
        
        for (const term of terms) {
            if (!newTermsArray.includes(term)) {
                newTermsArray.push(term);
                added = true;
            }
        }
        
        if (added) {
            await updateMovieTermsFn(movieId, newTermsArray);
        }
    }
}

// ---------------------- Función auxiliar genérica para agregar múltiples valores ----------------------
// Recibe la función addX (addDirector, addActor, etc.) y el string con valores separados por comas
async function addMultipleValues(movieId, valuesString, addFunction) {
    const values = splitByCommas(valuesString);
    if (values.length === 0) return;
    
    for (const value of values) {
        await addFunction(movieId, value);
    }
}

// ---------------------- Actualizar lista de términos en el modal ----------------------
async function updateTermsListInModal(movie, source, attachModalEventsFn, {
    updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
}) {
    const termsContainer = document.getElementById('termsList');
    if (termsContainer) {
        termsContainer.innerHTML = (movie.searchTerms || []).map(t => `
            <span class="term-chip">
                ${escapeHtml(t.term)}
                <span class="remove-term" data-term="${escapeHtml(t.term)}">✖</span>
            </span>
        `).join('');
        attachModalEventsFn(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
    }
}

// ---------------------- Asignar eventos a todos los elementos del modal ----------------------
async function attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source) {
    const isInTrash = (source === 'trash');

    // ========== TRASH ACTIONS ==========
    const moveToTrashRow = document.getElementById('moveToTrashRow');
    if (moveToTrashRow && !isInTrash) {
        moveToTrashRow.onclick = async () => {
            if (confirm('Move this movie to trash?')) {
                await moveToTrash(movie.youtubeId);
                closeModal();
                if (currentOnUpdate) await currentOnUpdate();
            }
        };
    }

    const restoreRow = document.getElementById('restoreRow');
    if (restoreRow && isInTrash) {
        restoreRow.onclick = async () => {
            await restoreFromTrash(movie.youtubeId);
            closeModal();
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    const permanentDeleteRow = document.getElementById('permanentDeleteRow');
    if (permanentDeleteRow && isInTrash) {
        permanentDeleteRow.onclick = async () => {
            if (confirm('Permanently delete this movie? This action cannot be undone.')) {
                await permanentlyDelete(movie.youtubeId);
                closeModal();
                if (currentOnUpdate) await currentOnUpdate();
            }
        };
    }

    // ========== WATCHING TOGGLE ==========
    const watchingRow = document.getElementById('watchingToggleRow');
    if (watchingRow && !isInTrash) {
        const watchingIcon = document.getElementById('modalWatchingIcon');
        watchingRow.onclick = async () => {
            const newStatus = await toggleWatching(movie.youtubeId);
            movie.watching = newStatus;
            if (watchingIcon) watchingIcon.textContent = newStatus ? 'visibility' : 'visibility_off';
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    // ========== FAVORITE TOGGLE ==========
    const favoriteRow = document.getElementById('favoriteToggleRow');
    if (favoriteRow && !isInTrash) {
        const favoriteIcon = document.getElementById('modalFavoriteIcon');
        favoriteRow.onclick = async () => {
            const newStatus = await toggleFavorite(movie.youtubeId);
            movie.favorite = newStatus;
            if (favoriteIcon) favoriteIcon.textContent = newStatus ? 'star_shine' : 'star';
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    // ========== EXACT/RELATED TOGGLE ==========
    const toggleExactRow = document.getElementById('toggleExactRow');
    if (toggleExactRow && window.activeTermFilter && !isInTrash) {
        toggleExactRow.onclick = async () => {
            const term = window.activeTermFilter;
            await toggleExact(movie.youtubeId, term);
            
            await refreshAvailableTerms();
            await loadAndDisplayAll();
            
            const stillExists = window.availableTerms ? window.availableTerms.includes(term) : false;
            if (!stillExists && getActiveTermFilter() === term) {
                window.activeTermFilter = null;
                if (syncWindowTermFilter) syncWindowTermFilter();
                await loadAndDisplayAll();
            }
            
            closeModal();
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    // ========== EXTRA INFO ==========
    const toggleExtraInfoBtn = document.getElementById('toggleExtraInfoBtn');
    const extraInfoPanel = document.getElementById('extraInfoPanel');
    if (toggleExtraInfoBtn && extraInfoPanel) {
        toggleExtraInfoBtn.onclick = async () => {
            if (extraInfoPanel.classList.contains('hidden')) {
                const extra = await getExtraInfo(movie.youtubeId);
                const fields = [
                    { label: 'Published on YouTube', value: formatDisplayDate(movie.publishedAt) },
                    { label: 'Channel ID', value: movie.channelId || 'Unknown' },
                    { label: 'Channel Title', value: movie.channelTitle || 'Unknown' },
                    { label: 'Tags', value: (movie.tags && movie.tags.length) ? movie.tags.join(', ') : 'Unknown' },
                    { label: 'View Count', value: movie.viewCount || 'Unknown' },
                    { label: 'Duration', value: movie.duration || 'Unknown' },
                    { label: 'Category ID', value: extra?.categoryId || 'Unknown' },
                    { label: 'Default Language', value: extra?.defaultLanguage || 'Unknown' },
                    { label: 'Default Audio Language', value: extra?.defaultAudioLanguage || 'Unknown' },
                    { label: 'Dimension', value: extra?.dimension || 'Unknown' },
                    { label: 'Definition', value: extra?.definition || 'Unknown' },
                    { label: 'Caption', value: extra?.caption || 'Unknown' },
                    { label: 'Licensed Content', value: extra?.licensedContent !== undefined ? extra.licensedContent : 'Unknown' },
                    { label: 'Projection', value: extra?.projection || 'Unknown' },
                    { label: 'Public Stats Viewable', value: extra?.publicStatsViewable !== undefined ? extra.publicStatsViewable : 'Unknown' },
                    { label: 'Made for Kids', value: extra?.madeForKids !== undefined ? extra.madeForKids : 'Unknown' },
                    { label: 'Self Declared Made for Kids', value: extra?.selfDeclaredMadeForKids !== undefined ? extra.selfDeclaredMadeForKids : 'Unknown' }
                ];
                extraInfoPanel.innerHTML = fields.map(f => `
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-light);">
                        <strong>${escapeHtml(f.label)}</strong>
                        <span>${escapeHtml(String(f.value))}</span>
                    </div>
                `).join('');
                extraInfoPanel.classList.remove('hidden');
                toggleExtraInfoBtn.innerHTML = '<span class="material-symbols-outlined">info</span> Hide Extra Info';
            } else {
                extraInfoPanel.classList.add('hidden');
                toggleExtraInfoBtn.innerHTML = '<span class="material-symbols-outlined">info</span> Extra Info';
            }
        };
    }
    
    // ========== REMOVE SEARCH TERM (con eliminación en todos los grupos) ==========
    if (!isInTrash) {
        document.querySelectorAll('.remove-term').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();

                const term = el.dataset.term;
                
                // Verificar si el término existe en algún otro grupo (Director, Actor, Genre, Year, Country, Language, Tag)
                const existsInDirectors = (movie.directors || []).includes(term);
                const existsInActors = (movie.actors || []).includes(term);
                const existsInGenres = (movie.genres || []).includes(term);
                const existsInYears = (movie.years || []).includes(term);
                const existsInCountries = (movie.countries || []).includes(term);
                const existsInLanguages = (movie.languages || []).includes(term);
                const existsInTags = (movie.tags || []).includes(term);
                
                const hasGroupMatches = existsInDirectors || existsInActors || existsInGenres || existsInYears || existsInCountries || existsInLanguages || existsInTags;
                
                // Filtrar términos restantes
                const remainingTerms = (movie.searchTerms || [])
                    .filter(t => t.term !== term);
                
                // Si no quedan términos en Search term y no hay coincidencias en grupos, mover a trash
                if (remainingTerms.length === 0 && !hasGroupMatches) {
                    if (confirm('Removing the last term will move this movie to Trash. Continue?')) {
                        await moveToTrash(movie.youtubeId);
                        closeModal();
                        if (currentOnUpdate) await currentOnUpdate();
                    }
                    return;
                }
                
                // Confirmar si hay coincidencias en grupos
                if (hasGroupMatches) {
                    let groupNames = [];
                    if (existsInDirectors) groupNames.push('Director');
                    if (existsInActors) groupNames.push('Actor');
                    if (existsInGenres) groupNames.push('Genre');
                    if (existsInYears) groupNames.push('Year');
                    if (existsInCountries) groupNames.push('Country');
                    if (existsInLanguages) groupNames.push('Language');
                    if (existsInTags) groupNames.push('Tag');
                    
                    const confirmMsg = `The term "${term}" also exists in: ${groupNames.join(', ')}.\n\nRemove it from these groups as well?`;
                    if (!confirm(confirmMsg)) {
                        return;
                    }
                }
                
                // 1. Eliminar de Search term
                const newTerms = remainingTerms.map(t => t.term);
                await updateMovieTerms(movie.youtubeId, newTerms);
                movie.searchTerms = remainingTerms;
                
                // 2. Eliminar de Directors si existe
                if (existsInDirectors) {
                    await removeDirector(movie.youtubeId, term);
                    movie.directors = (movie.directors || []).filter(d => d !== term);
                    const directorsContainer = document.getElementById('directorsList');
                    if (directorsContainer) {
                        directorsContainer.innerHTML = movie.directors.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-director" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                    }
                }
                
                // 3. Eliminar de Actors si existe
                if (existsInActors) {
                    await removeActor(movie.youtubeId, term);
                    movie.actors = (movie.actors || []).filter(a => a !== term);
                    const actorsContainer = document.getElementById('actorsList');
                    if (actorsContainer) {
                        actorsContainer.innerHTML = movie.actors.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-actor" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                    }
                }
                
                // 4. Eliminar de Genres si existe
                if (existsInGenres) {
                    await removeGenre(movie.youtubeId, term);
                    movie.genres = (movie.genres || []).filter(g => g !== term);
                    const genresContainer = document.getElementById('genresList');
                    if (genresContainer) {
                        genresContainer.innerHTML = movie.genres.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-genre" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                    }
                }
                
                // 5. Eliminar de Years si existe
                if (existsInYears) {
                    await removeYear(movie.youtubeId, term);
                    movie.years = (movie.years || []).filter(y => y !== term);
                    const yearsContainer = document.getElementById('yearsList');
                    if (yearsContainer) {
                        yearsContainer.innerHTML = movie.years.map(year => `
                            <span class="term-chip">
                                ${escapeHtml(year)}
                                <span class="remove-year" data-name="${escapeHtml(year)}">✖</span>
                            </span>
                        `).join('');
                    }
                }
                
                // 6. Eliminar de Countries si existe
                if (existsInCountries) {
                    await removeCountry(movie.youtubeId, term);
                    movie.countries = (movie.countries || []).filter(c => c !== term);
                    const countriesContainer = document.getElementById('countriesList');
                    if (countriesContainer) {
                        countriesContainer.innerHTML = movie.countries.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-country" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                    }
                }
                
                // 7. Eliminar de Languages si existe
                if (existsInLanguages) {
                    await removeLanguage(movie.youtubeId, term);
                    movie.languages = (movie.languages || []).filter(l => l !== term);
                    const languagesContainer = document.getElementById('languagesList');
                    if (languagesContainer) {
                        languagesContainer.innerHTML = movie.languages.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-language" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                    }
                }
                
                // 8. Eliminar de Tags si existe
                if (existsInTags) {
                    await removeTag(movie.youtubeId, term);
                    movie.tags = (movie.tags || []).filter(t => t !== term);
                    const tagsContainer = document.getElementById('tagsList');
                    if (tagsContainer) {
                        tagsContainer.innerHTML = (movie.tags || []).map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-tag" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                    }
                }
                
                // Actualizar la lista de términos en el modal
                const termsContainer = document.getElementById('termsList');
                if (termsContainer) {
                    termsContainer.innerHTML = movie.searchTerms.map(t => `
                        <span class="term-chip">
                            ${escapeHtml(t.term)}
                            <span class="remove-term" data-term="${escapeHtml(t.term)}">✖</span>
                        </span>
                    `).join('');
                    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                }
                
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== ADD SEARCH TERM (con soporte múltiple) ==========
    if (!isInTrash) {
        const addTermBtn = document.getElementById('addTermBtn');
        const newTermInput = document.getElementById('newTermInput');
        if (addTermBtn && newTermInput) {
            addTermBtn.onclick = async () => {
                const rawInput = newTermInput.value.trim();
                if (rawInput) {
                    await addMultipleTerms(movie.youtubeId, rawInput, updateMovieTerms);
                    
                    // Recargar la película actualizada
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie) {
                        movie.searchTerms = updatedMovie.searchTerms;
                        movie.directors = updatedMovie.directors;
                        movie.actors = updatedMovie.actors;
                        movie.genres = updatedMovie.genres;
                        movie.years = updatedMovie.years;
                        movie.countries = updatedMovie.countries;
                        movie.languages = updatedMovie.languages;
                        movie.tags = updatedMovie.tags;
                    }
                    
                    newTermInput.value = '';
                    const termsContainer = document.getElementById('termsList');
                    if (termsContainer) {
                        termsContainer.innerHTML = (movie.searchTerms || []).map(t => `
                            <span class="term-chip">
                                ${escapeHtml(t.term)}
                                <span class="remove-term" data-term="${escapeHtml(t.term)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newTermInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addTermBtn.click();
            });
        }
    }

    // ========== DIRECTORES (con soporte múltiple) ==========
    if (!isInTrash) {
        const addDirectorBtn = document.getElementById('addDirectorBtn');
        const newDirectorInput = document.getElementById('newDirectorInput');
        if (addDirectorBtn && newDirectorInput) {
            addDirectorBtn.onclick = async () => {
                const rawInput = newDirectorInput.value.trim();
                if (rawInput) {
                    await addMultipleValues(movie.youtubeId, rawInput, addDirector);
                    
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie) {
                        movie.directors = updatedMovie.directors;
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    
                    newDirectorInput.value = '';
                    const directorsContainer = document.getElementById('directorsList');
                    if (directorsContainer) {
                        directorsContainer.innerHTML = movie.directors.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-director" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newDirectorInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addDirectorBtn.click();
            });
        }

        document.querySelectorAll('.remove-director').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeDirector(movie.youtubeId, name);
                movie.directors = (movie.directors || []).filter(d => d !== name);
                const directorsContainer = document.getElementById('directorsList');
                if (directorsContainer) {
                    directorsContainer.innerHTML = movie.directors.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-director" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== ACTORES (con soporte múltiple) ==========
    if (!isInTrash) {
        const addActorBtn = document.getElementById('addActorBtn');
        const newActorInput = document.getElementById('newActorInput');
        if (addActorBtn && newActorInput) {
            addActorBtn.onclick = async () => {
                const rawInput = newActorInput.value.trim();
                if (rawInput) {
                    await addMultipleValues(movie.youtubeId, rawInput, addActor);
                    
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie) {
                        movie.actors = updatedMovie.actors;
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    
                    newActorInput.value = '';
                    const actorsContainer = document.getElementById('actorsList');
                    if (actorsContainer) {
                        actorsContainer.innerHTML = movie.actors.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-actor" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newActorInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addActorBtn.click();
            });
        }

        document.querySelectorAll('.remove-actor').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeActor(movie.youtubeId, name);
                movie.actors = (movie.actors || []).filter(a => a !== name);
                const actorsContainer = document.getElementById('actorsList');
                if (actorsContainer) {
                    actorsContainer.innerHTML = movie.actors.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-actor" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== GÉNEROS (con soporte múltiple) ==========
    if (!isInTrash) {
        const addGenreBtn = document.getElementById('addGenreBtn');
        const newGenreInput = document.getElementById('newGenreInput');
        if (addGenreBtn && newGenreInput) {
            addGenreBtn.onclick = async () => {
                const rawInput = newGenreInput.value.trim();
                if (rawInput) {
                    await addMultipleValues(movie.youtubeId, rawInput, addGenre);
                    
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie) {
                        movie.genres = updatedMovie.genres;
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    
                    newGenreInput.value = '';
                    const genresContainer = document.getElementById('genresList');
                    if (genresContainer) {
                        genresContainer.innerHTML = movie.genres.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-genre" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newGenreInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addGenreBtn.click();
            });
        }

        document.querySelectorAll('.remove-genre').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeGenre(movie.youtubeId, name);
                movie.genres = (movie.genres || []).filter(g => g !== name);
                const genresContainer = document.getElementById('genresList');
                if (genresContainer) {
                    genresContainer.innerHTML = movie.genres.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-genre" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== AÑOS (con soporte múltiple) ==========
    if (!isInTrash) {
        const addYearBtn = document.getElementById('addYearBtn');
        const newYearInput = document.getElementById('newYearInput');
        if (addYearBtn && newYearInput) {
            addYearBtn.onclick = async () => {
                const rawInput = newYearInput.value.trim();
                if (rawInput) {
                    await addMultipleValues(movie.youtubeId, rawInput, addYear);
                    
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie) {
                        movie.years = updatedMovie.years;
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    
                    newYearInput.value = '';
                    const yearsContainer = document.getElementById('yearsList');
                    if (yearsContainer) {
                        yearsContainer.innerHTML = movie.years.map(year => `
                            <span class="term-chip">
                                ${escapeHtml(year)}
                                <span class="remove-year" data-name="${escapeHtml(year)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newYearInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addYearBtn.click();
            });
        }

        document.querySelectorAll('.remove-year').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const year = el.dataset.name;
                await removeYear(movie.youtubeId, year);
                movie.years = (movie.years || []).filter(y => y !== year);
                const yearsContainer = document.getElementById('yearsList');
                if (yearsContainer) {
                    yearsContainer.innerHTML = movie.years.map(year => `
                        <span class="term-chip">
                            ${escapeHtml(year)}
                            <span class="remove-year" data-name="${escapeHtml(year)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== PAÍSES (con soporte múltiple) ==========
    if (!isInTrash) {
        const addCountryBtn = document.getElementById('addCountryBtn');
        const newCountryInput = document.getElementById('newCountryInput');
        if (addCountryBtn && newCountryInput) {
            addCountryBtn.onclick = async () => {
                const rawInput = newCountryInput.value.trim();
                if (rawInput) {
                    await addMultipleValues(movie.youtubeId, rawInput, addCountry);
                    
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie) {
                        movie.countries = updatedMovie.countries;
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    
                    newCountryInput.value = '';
                    const countriesContainer = document.getElementById('countriesList');
                    if (countriesContainer) {
                        countriesContainer.innerHTML = movie.countries.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-country" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newCountryInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addCountryBtn.click();
            });
        }

        document.querySelectorAll('.remove-country').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeCountry(movie.youtubeId, name);
                movie.countries = (movie.countries || []).filter(c => c !== name);
                const countriesContainer = document.getElementById('countriesList');
                if (countriesContainer) {
                    countriesContainer.innerHTML = movie.countries.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-country" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== IDIOMAS (con soporte múltiple) ==========
    if (!isInTrash) {
        const addLanguageBtn = document.getElementById('addLanguageBtn');
        const newLanguageInput = document.getElementById('newLanguageInput');
        if (addLanguageBtn && newLanguageInput) {
            addLanguageBtn.onclick = async () => {
                const rawInput = newLanguageInput.value.trim();
                if (rawInput) {
                    await addMultipleValues(movie.youtubeId, rawInput, addLanguage);
                    
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie) {
                        movie.languages = updatedMovie.languages;
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    
                    newLanguageInput.value = '';
                    const languagesContainer = document.getElementById('languagesList');
                    if (languagesContainer) {
                        languagesContainer.innerHTML = movie.languages.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-language" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newLanguageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addLanguageBtn.click();
            });
        }

        document.querySelectorAll('.remove-language').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeLanguage(movie.youtubeId, name);
                movie.languages = (movie.languages || []).filter(l => l !== name);
                const languagesContainer = document.getElementById('languagesList');
                if (languagesContainer) {
                    languagesContainer.innerHTML = movie.languages.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-language" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== TAGS (con soporte múltiple) ==========
    if (!isInTrash) {
        const addTagBtn = document.getElementById('addTagBtn');
        const newTagInput = document.getElementById('newTagInput');
        if (addTagBtn && newTagInput) {
            addTagBtn.onclick = async () => {
                const rawInput = newTagInput.value.trim();
                if (rawInput) {
                    await addMultipleValues(movie.youtubeId, rawInput, addTag);
                    
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie) {
                        movie.tags = updatedMovie.tags;
                    }
                    
                    newTagInput.value = '';
                    const tagsContainer = document.getElementById('tagsList');
                    if (tagsContainer) {
                        tagsContainer.innerHTML = (movie.tags || []).map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-tag" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newTagInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addTagBtn.click();
            });
        }

        document.querySelectorAll('.remove-tag').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeTag(movie.youtubeId, name);
                movie.tags = (movie.tags || []).filter(t => t !== name);
                const tagsContainer = document.getElementById('tagsList');
                if (tagsContainer) {
                    tagsContainer.innerHTML = (movie.tags || []).map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-tag" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }
}

// ---------------------- Obtener película actualizada desde DB ----------------------
async function getMovieFromDB(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction(['movies'], 'readonly');
    const store = transaction.objectStore('movies');
    return new Promise((resolve, reject) => {
        const req = store.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ----------------------- Funciones auxiliares de formato ------------------------
function formatDisplayDate(utcDateString) {
    if (!utcDateString) return 'Unknown';
    const date = new Date(utcDateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

function formatDuration(duration) {
    if (!duration || duration === 'Unknown') return 'Unknown';
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] ? match[1].slice(0, -1) : 0);
    const minutes = (match[2] ? match[2].slice(0, -1) : 0);
    const seconds = (match[3] ? match[3].slice(0, -1) : 0);
    return `${hours ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}