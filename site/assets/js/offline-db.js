// assets/js/offline-db.js
// Minimal IndexedDB wrapper for the offline Enumerator App.
// Everything a field worker records (household + audio answers) is stored
// on the DEVICE first. Nothing touches the network until "Sync Now" is
// pressed, which only works once connectivity returns.

const OfflineDB = (() => {
  const DB_NAME = 'voiceinsights_offline';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('households')) {
          db.createObjectStore('households', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cached_questions')) {
          db.createObjectStore('cached_questions', { keyPath: 'campaignId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  return {
    async cacheQuestions(campaignId, campaignName, questions, surveyVersion) {
      const store = await tx('cached_questions', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put({ campaignId, campaignName, questions, surveyVersion: surveyVersion || null, cachedAt: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async getCachedQuestions(campaignId) {
      const store = await tx('cached_questions', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.get(campaignId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    async saveHousehold(household) {
      const store = await tx('households', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(household);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async getAllHouseholds() {
      const store = await tx('households', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },
    async deleteHousehold(id) {
      const store = await tx('households', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
  };
})();
