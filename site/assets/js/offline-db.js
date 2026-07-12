// assets/js/offline-db.js
// Encrypted IndexedDB queue for the offline Enumerator App. Interview payloads
// are encrypted with a non-extractable device key and purged after confirmed sync.

const OfflineDB = (() => {
  const DB_NAME = 'voiceinsights_offline';
  const DB_VERSION = 2;
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
        if (!db.objectStoreNames.contains('device_keys')) {
          db.createObjectStore('device_keys', { keyPath: 'id' });
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

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function deviceKey() {
    if (!globalThis.crypto?.subtle) throw new Error('Secure offline storage is unavailable on this device.');
    const existing = await requestResult((await tx('device_keys', 'readonly')).get('device-aes-gcm-v1'));
    if (existing?.key) return existing.key;
    const key = await crypto.subtle.generateKey({ name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
    await requestResult((await tx('device_keys', 'readwrite')).put({ id:'device-aes-gcm-v1', key, createdAt:Date.now() }));
    return key;
  }

  async function encryptPayload(payload) {
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const plain=new TextEncoder().encode(JSON.stringify(payload));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},await deviceKey(),plain);
    return {iv,ciphertext};
  }

  async function decryptRecord(record) {
    if (!record?.encrypted) return record;
    try {
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv)},await deviceKey(),record.ciphertext);
      return JSON.parse(new TextDecoder().decode(plain));
    } catch (_) {
      throw new Error(`Secure offline record ${record.id} could not be decrypted. Do not delete it; contact a supervisor.`);
    }
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
      if (!household?.id) throw new Error('Offline interview id is required.');
      const sealed=await encryptPayload(household);
      const store = await tx('households', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put({id:household.id,assignmentId:household.assignmentId||null,version:household.version||1,updatedAt:household.updatedAt||Date.now(),encrypted:true,iv:sealed.iv,ciphertext:sealed.ciphertext});
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async getAllHouseholds() {
      const store = await tx('households', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = async () => {try{resolve(await Promise.all((req.result||[]).map(decryptRecord)));}catch(error){reject(error);}};
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
