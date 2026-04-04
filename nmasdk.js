(function () {
  if (window.NajiMiniApp) return;

  const DEFAULT_TARGET = "*";
  const pending = new Map();
  const listeners = new Map();
  let reqCounter = 0;
  let initData = null;
  let isReady = false;

  function emit(eventName, payload) {
    const handlers = listeners.get(eventName);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error("[NajiMiniApp] listener error:", error);
      }
    });
  }

  function on(eventName, handler) {
    const handlers = listeners.get(eventName) || new Set();
    handlers.add(handler);
    listeners.set(eventName, handlers);
    return () => off(eventName, handler);
  }

  function off(eventName, handler) {
    const handlers = listeners.get(eventName);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) listeners.delete(eventName);
  }

  function createReqId() {
    reqCounter += 1;
    return "req_" + Date.now() + "_" + reqCounter;
  }

  function post(type, payload) {
    if (!window.parent) return;
    window.parent.postMessage({ type, payload }, DEFAULT_TARGET);
  }

  function request(type, payload) {
    return new Promise((resolve, reject) => {
      const reqId = createReqId();
      pending.set(reqId, { resolve, reject });
      post(type, { ...(payload || {}), reqId });
      setTimeout(() => {
        const current = pending.get(reqId);
        if (!current) return;
        pending.delete(reqId);
        reject(new Error("Mini App request timeout"));
      }, 15000);
    });
  }

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "NAJI_INIT_DATA") {
      initData = data;
      emit("init", data);
      emit("themeChanged", data.theme);
      emit("walletChanged", data.wallet || null);
      return;
    }

    if (data.type === "NAJI_ASYNC_RESPONSE") {
      const entry = pending.get(data.reqId);
      if (!entry) return;
      pending.delete(data.reqId);
      if (data.error) {
        entry.reject(new Error(data.error));
      } else {
        entry.resolve(data.result);
      }
      return;
    }

    if (data.type === "NAJI_EVENT") {
      emit(data.eventName, data.payload);
      if (data.eventName === "backButtonClicked") emit("backButtonClicked", data.payload);
      return;
    }

    if (data.type === "NAJI_WALLET_UPDATE") {
      emit("walletChanged", data.wallet || null);
      emit(data.type, data);
      return;
    }

    if (typeof data.type === "string" && data.type.startsWith("NAJI_")) {
      emit(data.type, data);
    }
  });

  const sdk = {
    init() {
      if (initData) return Promise.resolve(initData);
      return new Promise((resolve) => {
        const unsubscribe = on("init", (payload) => {
          unsubscribe();
          resolve(payload);
        });
        post("NAJI_SDK_INIT");
      });
    },

    ready() {
      if (isReady) return;
      isReady = true;
      post("APP_READY");
    },

    get initData() {
      return initData;
    },

    get user() {
      return initData?.user || null;
    },

    get theme() {
      return initData?.theme || "light";
    },

    get platform() {
      return initData?.platform || "web";
    },

    get permissions() {
      return initData?.permissions || {};
    },

    get sparks() {
      return initData?.sparks || { balance: 0 };
    },

    on,
    off,

    requestContext() {
      return request("GET_CONTEXT");
    },

    close() {
      post("NAJI_CLOSE_APP");
    },

    expand() {
      post("SET_FULLSCREEN_APP", { value: true });
    },

    collapse() {
      post("SET_FULLSCREEN_APP", { value: false });
    },

    setHeaderColor(color) {
      post("SET_HEADER_COLOR", { color });
    },

    backButton: {
      show() {
        post("BACK_BUTTON_UPDATE", { visible: true });
      },
      hide() {
        post("BACK_BUTTON_UPDATE", { visible: false });
      },
      onClick(handler) {
        return on("backButtonClicked", handler);
      },
    },

    storage: {
      get(key) {
        return request("STORAGE_GET", { key });
      },
      set(key, value) {
        return request("STORAGE_SET", { key, value });
      },
      remove(key) {
        return request("STORAGE_REMOVE", { key });
      },
      keys() {
        return request("STORAGE_KEYS");
      },
    },

    ui: {
      alert(message, options) {
        post("SHOW_ALERT", { message, ...(options || {}) });
      },
      toast(message, type) {
        return request("SHOW_TOAST", { message, type: type || "info" });
      },
      openLink(url) {
        return request("OPEN_LINK", { url });
      },
      copy(text) {
        return request("CLIPBOARD_WRITE", { text });
      },
    },

    wallet: {
      getState() {
        return request("GET_CONTEXT").then((ctx) => ctx.wallet || null);
      },
      refresh() {
        post("NAJI_WALLET_STATE_REQUEST");
      },
    },

    payments: {
      invoice(options) {
        return request("CREATE_INVOICE_SPARKS", options || {});
      },
      crypto(options) {
        return request("CRYPTO_REQUEST", options || {});
      },
    },

    ping() {
      return request("NAJI_SDK_PING");
    },
  };

  window.NajiMiniApp = sdk;
})();
