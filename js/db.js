// ==================== CONSTANTES ====================
const DB_NAME = 'PlatoDB';
const DB_VERSION = 8;
const STORE_MOVIES = 'movies';
const STORE_TRASH = 'trash';
const STORE_EXTRA = 'movie_extra';

let dbInstance = null;

// ==================== ABRIR DB ====================
export async function openDB() {
    if (dbInstance) return dbInstance;
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (db.objectStoreNames.contains(STORE_MOVIES)) db.deleteObjectStore(STORE_MOVIES);
            if (db.objectStoreNames.contains(STORE_TRASH)) db.deleteObjectStore(STORE_TRASH);
            if (db.objectStoreNames.contains(STORE_EXTRA)) db.deleteObjectStore(STORE_EXTRA);
            
            const store = db.createObjectStore(STORE_MOVIES, { keyPath: 'youtubeId' });
            store.createIndex('by_dateSaved', 'dateSaved', { unique: false });
            store.createIndex('by_watching', 'watching', { unique: false });
            store.createIndex('by_favorite', 'favorite', { unique: false });
            store.createIndex('by_channelId', 'channelId', { unique: false });
            
            const trashStore = db.createObjectStore(STORE_TRASH, { keyPath: 'youtubeId' });
            trashStore.createIndex('by_deletedAt', 'deletedAt', { unique: false });
            trashStore.createIndex('by_channelId', 'channelId', { unique: false });
            
            db.createObjectStore(STORE_EXTRA, { keyPath: 'youtubeId' });
        };
    });
}

// ==================== FUNCIONES EXISTENTES SIN CAMBIOS ====================
export async function getAllMovies() {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readonly');
    const store = transaction.objectStore(STORE_MOVIES);
    const index = store.index('by_dateSaved');
    return new Promise((resolve, reject) => {
        const request = index.openCursor(null, 'prev');
        const movies = [];
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                movies.push(cursor.value);
                cursor.continue();
            } else {
                resolve(movies);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function getTrashMovies() {
    const db = await openDB();
    const transaction = db.transaction([STORE_TRASH], 'readonly');
    const store = transaction.objectStore(STORE_TRASH);
    const index = store.index('by_deletedAt');
    return new Promise((resolve, reject) => {
        const request = index.openCursor(null, 'prev');
        const movies = [];
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                movies.push(cursor.value);
                cursor.continue();
            } else {
                resolve(movies);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function moveMovieToTrash(youtubeId) {
    const db = await openDB();
    const mainStore = db.transaction([STORE_MOVIES], 'readonly').objectStore(STORE_MOVIES);
    const movie = await new Promise((resolve, reject) => {
        const req = mainStore.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    if (!movie) throw new Error('Movie not found');
    const trashMovie = { ...movie, deletedAt: new Date().toISOString() };
    const trashTransaction = db.transaction([STORE_TRASH], 'readwrite');
    const trashStore = trashTransaction.objectStore(STORE_TRASH);
    await new Promise((resolve, reject) => {
        const req = trashStore.put(trashMovie);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
    const mainTransaction = db.transaction([STORE_MOVIES], 'readwrite');
    const mainDeleteStore = mainTransaction.objectStore(STORE_MOVIES);
    await new Promise((resolve, reject) => {
        const req = mainDeleteStore.delete(youtubeId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function restoreMovieFromTrash(youtubeId) {
    const db = await openDB();
    const trashStore = db.transaction([STORE_TRASH], 'readonly').objectStore(STORE_TRASH);
    const trashMovie = await new Promise((resolve, reject) => {
        const req = trashStore.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    if (!trashMovie) throw new Error('Movie not found in trash');
    const { deletedAt, ...restoredMovie } = trashMovie;
    const mainTransaction = db.transaction([STORE_MOVIES], 'readwrite');
    const mainStore = mainTransaction.objectStore(STORE_MOVIES);
    await new Promise((resolve, reject) => {
        const req = mainStore.put(restoredMovie);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
    const trashDeleteTransaction = db.transaction([STORE_TRASH], 'readwrite');
    const trashDeleteStore = trashDeleteTransaction.objectStore(STORE_TRASH);
    await new Promise((resolve, reject) => {
        const req = trashDeleteStore.delete(youtubeId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function permanentlyDeleteMovie(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction([STORE_TRASH], 'readwrite');
    const store = transaction.objectStore(STORE_TRASH);
    return new Promise((resolve, reject) => {
        const req = store.delete(youtubeId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function toggleWatching(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                movie.watching = !movie.watching;
                movie.lastUpdated = new Date().toISOString();
                const putRequest = store.put(movie);
                putRequest.onsuccess = () => resolve(movie.watching);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function renameTermInAllMovies(oldTerm, newTerm) {
    if (oldTerm === newTerm) return;
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    for (const movie of allMovies) {
        let changed = false;
        if (movie.searchTerms) {
            for (let i = 0; i < movie.searchTerms.length; i++) {
                if (movie.searchTerms[i].term === oldTerm) {
                    movie.searchTerms[i].term = newTerm;
                    changed = true;
                }
            }
        }
        if (changed) {
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

export async function saveExtraInfo(youtubeId, extraData) {
    const db = await openDB();
    const transaction = db.transaction([STORE_EXTRA], 'readwrite');
    const store = transaction.objectStore(STORE_EXTRA);
    const record = { youtubeId, ...extraData };
    return new Promise((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function getExtraInfo(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction([STORE_EXTRA], 'readonly');
    const store = transaction.objectStore(STORE_EXTRA);
    return new Promise((resolve, reject) => {
        const req = store.get(youtubeId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

export async function toggleExact(youtubeId, term) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                const termIndex = movie.searchTerms.findIndex(t => t.term === term);
                if (termIndex !== -1) {
                    movie.searchTerms[termIndex].exact = !movie.searchTerms[termIndex].exact;
                    movie.lastUpdated = new Date().toISOString();
                    const putRequest = store.put(movie);
                    putRequest.onsuccess = () => resolve(movie.searchTerms[termIndex].exact);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    reject(new Error('Term not found in movie'));
                }
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

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

// ==================== FUNCIONES DE METADATOS Y TAGS (agregan a tags, NO a searchTerms) ====================
export async function addDirector(youtubeId, directorName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (!movie.directors) movie.directors = [];
                if (!movie.directors.includes(directorName)) {
                    movie.directors.push(directorName);
                }
                if (!movie.tags) movie.tags = [];
                if (!movie.tags.includes(directorName)) {
                    movie.tags.push(directorName);
                }
                movie.lastUpdated = new Date().toISOString();
                const putRequest = store.put(movie);
                putRequest.onsuccess = () => resolve(movie.directors);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function removeDirector(youtubeId, directorName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (movie.directors) {
                    movie.directors = movie.directors.filter(d => d !== directorName);
                    movie.lastUpdated = new Date().toISOString();
                    const putRequest = store.put(movie);
                    putRequest.onsuccess = () => resolve(movie.directors);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve([]);
                }
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function addActor(youtubeId, actorName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (!movie.actors) movie.actors = [];
                if (!movie.actors.includes(actorName)) {
                    movie.actors.push(actorName);
                }
                if (!movie.tags) movie.tags = [];
                if (!movie.tags.includes(actorName)) {
                    movie.tags.push(actorName);
                }
                movie.lastUpdated = new Date().toISOString();
                const putRequest = store.put(movie);
                putRequest.onsuccess = () => resolve(movie.actors);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function removeActor(youtubeId, actorName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (movie.actors) {
                    movie.actors = movie.actors.filter(a => a !== actorName);
                    movie.lastUpdated = new Date().toISOString();
                    const putRequest = store.put(movie);
                    putRequest.onsuccess = () => resolve(movie.actors);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve([]);
                }
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function addGenre(youtubeId, genreName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (!movie.genres) movie.genres = [];
                if (!movie.genres.includes(genreName)) {
                    movie.genres.push(genreName);
                }
                if (!movie.tags) movie.tags = [];
                if (!movie.tags.includes(genreName)) {
                    movie.tags.push(genreName);
                }
                movie.lastUpdated = new Date().toISOString();
                const putRequest = store.put(movie);
                putRequest.onsuccess = () => resolve(movie.genres);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function removeGenre(youtubeId, genreName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (movie.genres) {
                    movie.genres = movie.genres.filter(g => g !== genreName);
                    movie.lastUpdated = new Date().toISOString();
                    const putRequest = store.put(movie);
                    putRequest.onsuccess = () => resolve(movie.genres);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve([]);
                }
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function addYear(youtubeId, yearValue) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (!movie.years) movie.years = [];
                if (!movie.years.includes(yearValue)) {
                    movie.years.push(yearValue);
                }
                if (!movie.tags) movie.tags = [];
                if (!movie.tags.includes(yearValue)) {
                    movie.tags.push(yearValue);
                }
                movie.lastUpdated = new Date().toISOString();
                const putRequest = store.put(movie);
                putRequest.onsuccess = () => resolve(movie.years);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function removeYear(youtubeId, yearValue) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (movie.years) {
                    movie.years = movie.years.filter(y => y !== yearValue);
                    movie.lastUpdated = new Date().toISOString();
                    const putRequest = store.put(movie);
                    putRequest.onsuccess = () => resolve(movie.years);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve([]);
                }
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function addCountry(youtubeId, countryName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (!movie.countries) movie.countries = [];
                if (!movie.countries.includes(countryName)) {
                    movie.countries.push(countryName);
                }
                if (!movie.tags) movie.tags = [];
                if (!movie.tags.includes(countryName)) {
                    movie.tags.push(countryName);
                }
                movie.lastUpdated = new Date().toISOString();
                const putRequest = store.put(movie);
                putRequest.onsuccess = () => resolve(movie.countries);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function removeCountry(youtubeId, countryName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (movie.countries) {
                    movie.countries = movie.countries.filter(c => c !== countryName);
                    movie.lastUpdated = new Date().toISOString();
                    const putRequest = store.put(movie);
                    putRequest.onsuccess = () => resolve(movie.countries);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve([]);
                }
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function addLanguage(youtubeId, languageName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (!movie.languages) movie.languages = [];
                if (!movie.languages.includes(languageName)) {
                    movie.languages.push(languageName);
                }
                if (!movie.tags) movie.tags = [];
                if (!movie.tags.includes(languageName)) {
                    movie.tags.push(languageName);
                }
                movie.lastUpdated = new Date().toISOString();
                const putRequest = store.put(movie);
                putRequest.onsuccess = () => resolve(movie.languages);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function removeLanguage(youtubeId, languageName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (movie.languages) {
                    movie.languages = movie.languages.filter(l => l !== languageName);
                    movie.lastUpdated = new Date().toISOString();
                    const putRequest = store.put(movie);
                    putRequest.onsuccess = () => resolve(movie.languages);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve([]);
                }
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// ==================== FUNCIONES PARA TAGS LIBRES ====================
export async function addTag(youtubeId, tagName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (!movie.tags) movie.tags = [];
                if (!movie.tags.includes(tagName)) {
                    movie.tags.push(tagName);
                }
                movie.lastUpdated = new Date().toISOString();
                const putRequest = store.put(movie);
                putRequest.onsuccess = () => resolve(movie.tags);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function removeTag(youtubeId, tagName) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                if (movie.tags) {
                    movie.tags = movie.tags.filter(t => t !== tagName);
                    movie.lastUpdated = new Date().toISOString();
                    const putRequest = store.put(movie);
                    putRequest.onsuccess = () => resolve(movie.tags);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve([]);
                }
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// ==================== saveMovie MODIFICADA (sin async dentro de onsuccess) ====================
export async function saveMovie(movieData, searchTerm, isExact = true) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    
    return new Promise((resolve, reject) => {
        const getRequest = store.get(movieData.youtubeId);
        
        getRequest.onsuccess = function() {
            const existing = getRequest.result;
            
            if (existing) {
                let terms = existing.searchTerms || [];
                const existingIndex = terms.findIndex(t => t.term === searchTerm);
                if (existingIndex === -1) {
                    terms.push({ term: searchTerm, exact: isExact });
                } else {
                    if (isExact) terms[existingIndex].exact = true;
                }
                
                const updated = {
                    ...existing,
                    searchTerms: terms,
                    directors: existing.directors || [],
                    actors: existing.actors || [],
                    genres: existing.genres || [],
                    years: existing.years || [],
                    countries: existing.countries || [],
                    languages: existing.languages || [],
                    tags: existing.tags || [],
                    viewCount: movieData.viewCount ?? existing.viewCount,
                    likeCount: movieData.likeCount ?? existing.likeCount,
                    commentCount: movieData.commentCount ?? existing.commentCount,
                    duration: movieData.duration ?? existing.duration,
                    lastUpdated: new Date().toISOString()
                };
                
                const putRequest = store.put(updated);
                putRequest.onsuccess = function() {
                    resolve(updated);
                };
                putRequest.onerror = function() {
                    reject(putRequest.error);
                };
            } else {
                const newMovie = {
                    ...movieData,
                    searchTerms: searchTerm ? [{ term: searchTerm, exact: isExact }] : [],
                    directors: [],
                    actors: [],
                    genres: [],
                    years: [],
                    countries: [],
                    languages: [],
                    tags: [],
                    watching: false,
                    favorite: false,
                    dateSaved: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                
                const addRequest = store.add(newMovie);
                addRequest.onsuccess = function() {
                    resolve(newMovie);
                };
                addRequest.onerror = function() {
                    reject(addRequest.error);
                };
            }
        };
        
        getRequest.onerror = function() {
            reject(getRequest.error);
        };
    });
}