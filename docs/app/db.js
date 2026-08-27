// ============================================================
// Capa de acceso a IndexedDB. Todo el estado de la app vive aca:
// activacion (code, deviceId) y los trades (con su imagen como blob).
// Nada de esto se envia a ningun servidor.
// ============================================================
(function () {
  const DB_NAME = "diario-trading-db";
  const DB_VERSION = 1;
  const STORE_META = "meta";
  const STORE_TRADES = "trades";

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE_TRADES)) {
          const store = db.createObjectStore(STORE_TRADES, { keyPath: "id" });
          store.createIndex("fecha", "fecha", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- meta / activacion ----------

  async function getMeta(key) {
    const store = await tx(STORE_META, "readonly");
    return reqToPromise(store.get(key));
  }

  async function setMeta(key, value) {
    const store = await tx(STORE_META, "readwrite");
    return reqToPromise(store.put({ key, ...value }));
  }

  async function getDeviceId() {
    const existing = await getMeta("deviceId");
    if (existing && existing.value) return existing.value;
    const id = crypto.randomUUID();
    await setMeta("deviceId", { value: id });
    return id;
  }

  async function getActivation() {
    const rec = await getMeta("activation");
    return rec || null;
  }

  async function saveActivation({ code, deviceId }) {
    return setMeta("activation", {
      activated: true,
      code,
      deviceId,
      activatedAt: Date.now(),
    });
  }

  // ---------- trades ----------

  async function addTrade(trade) {
    const store = await tx(STORE_TRADES, "readwrite");
    return reqToPromise(store.add(trade));
  }

  async function getAllTrades() {
    const store = await tx(STORE_TRADES, "readonly");
    const result = await reqToPromise(store.getAll());
    return result || [];
  }

  async function getTrade(id) {
    const store = await tx(STORE_TRADES, "readonly");
    return reqToPromise(store.get(id));
  }

  async function updateTrade(trade) {
    const store = await tx(STORE_TRADES, "readwrite");
    return reqToPromise(store.put(trade));
  }

  async function deleteTrade(id) {
    const store = await tx(STORE_TRADES, "readwrite");
    return reqToPromise(store.delete(id));
  }

  async function deleteTrades(ids) {
    const store = await tx(STORE_TRADES, "readwrite");
    return Promise.all(ids.map((id) => reqToPromise(store.delete(id))));
  }

  window.DiarioDB = {
    getDeviceId,
    getActivation,
    saveActivation,
    addTrade,
    getAllTrades,
    getTrade,
    updateTrade,
    deleteTrade,
    deleteTrades,
  };
})();
