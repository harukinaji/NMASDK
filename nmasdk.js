(function () {
  if (window.NajiMiniApp) return;

  function parseOriginCandidate(rawValue) {
    if (!rawValue) return null;
    try {
      const parsed = new URL(rawValue, window.location.href);
      if (!["http:", "https:", "capacitor:"].includes(parsed.protocol)) {
        return null;
      }
      return parsed.origin;
    } catch {
      return null;
    }
  }

  function resolveParentOrigins() {
    const params = new URLSearchParams(window.location.search);
    const candidates = [
      params.get("__naji_parent_origin"),
      document.referrer,
      typeof window.location.ancestorOrigins?.[0] === "string" ? window.location.ancestorOrigins[0] : null
    ];
    const origins = [];
    candidates.forEach((candidate) => {
      const nextOrigin = parseOriginCandidate(candidate);
      if (nextOrigin && !origins.includes(nextOrigin)) {
        origins.push(nextOrigin);
      }
    });
    return origins;
  }

  const PARENT_ORIGINS = resolveParentOrigins();
  const PARENT_ORIGIN = PARENT_ORIGINS[0] || null;
  const pending = new Map();
  const listeners = new Map();
  let reqCounter = 0;
  let initData = null;
  let isReady = false;
  let gamepadsState = [];
  let orientationState = null;
  let multiplayerState = null;
  let voiceState = null;

  function serializeBody(body) {
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      return {
        __najiBodyType: "form-data",
        entries: Array.from(body.entries()).map(([key, value]) => ({ key, value }))
      };
    }
    return body;
  }

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
    // Use "*" for delivery; the host validates child origin and source on receive.
    window.parent.postMessage({ type, payload }, "*");
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

  function setGamepads(nextGamepads) {
    gamepadsState = Array.isArray(nextGamepads) ? nextGamepads : [];
    if (initData && typeof initData === "object") {
      initData = { ...initData, gamepads: gamepadsState };
    }
    return gamepadsState;
  }

  function setOrientation(nextOrientation) {
    orientationState = nextOrientation && typeof nextOrientation === "object" ? nextOrientation : null;
    if (initData && typeof initData === "object") {
      initData = { ...initData, orientation: orientationState };
    }
    return orientationState;
  }

  function setMultiplayer(nextState) {
    multiplayerState = nextState && typeof nextState === "object" ? nextState : null;
    if (initData && typeof initData === "object") {
      initData = { ...initData, multiplayer: multiplayerState };
    }
    return multiplayerState;
  }

  function setVoice(nextState) {
    voiceState = nextState && typeof nextState === "object" ? nextState : null;
    if (initData && typeof initData === "object") {
      initData = { ...initData, voice: voiceState };
    }
    return voiceState;
  }

  function buildGamepadPayload(payload) {
    const normalizedPayload = payload || {};
    const nextGamepads = Array.isArray(normalizedPayload.gamepads) ? setGamepads(normalizedPayload.gamepads) : gamepadsState;
    return {
      ...normalizedPayload,
      gamepads: nextGamepads,
      primary: normalizedPayload.primary || nextGamepads[0] || null,
      supported: typeof normalizedPayload.supported === "boolean"
        ? normalizedPayload.supported
        : Boolean(initData?.gamepadSupported)
    };
  }

  window.addEventListener("message", (event) => {
    if (window.parent && window.parent !== window && event.source !== window.parent) {
      return;
    }
    if (PARENT_ORIGINS.length && !PARENT_ORIGINS.includes(event.origin)) {
      return;
    }
    const data = event.data || {};
    if (data.type === "NAJI_INIT_DATA") {
      initData = data;
      setGamepads(data.gamepads);
      setOrientation(data.orientation);
       setMultiplayer(data.multiplayer || null);
       setVoice(data.voice || null);
      emit("init", data);
      emit("themeChanged", data.theme);
      emit("walletChanged", data.wallet || null);
      emit("orientationChanged", data.orientation || null);
      emit("multiplayerStateChanged", data.multiplayer || null);
      emit("voiceStateChanged", data.voice || null);
      emit("voiceParticipantsChanged", data.voice?.participants || []);
      emit("gamepadsChanged", buildGamepadPayload({ reason: "init", gamepads: data.gamepads, supported: data.gamepadSupported }));
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
      const isGamepadEvent = data.eventName === "gamepadsChanged"
        || data.eventName === "gamepadConnected"
        || data.eventName === "gamepadDisconnected";
      if (data.eventName === "orientationChanged") {
        setOrientation(data.payload);
      }
      if (data.eventName === "multiplayerStateChanged" || data.eventName === "multiplayerMatchFound") {
        setMultiplayer(data.payload);
      }
      if (data.eventName === "voiceStateChanged") {
        setVoice(data.payload);
      }
      if (data.eventName === "voiceParticipantsChanged") {
        const nextVoiceState = { ...(voiceState || initData?.voice || {}), participants: Array.isArray(data.payload) ? data.payload : [] };
        setVoice(nextVoiceState);
      }
      if (data.eventName === "launchParamsChanged") {
        const nextStartParams = data.payload?.startParams || data.payload?.launchParams || null;
        if (initData && typeof initData === "object") {
          initData = { ...initData, startParams: nextStartParams, launchParams: nextStartParams };
        }
      }
      emit(data.eventName, isGamepadEvent ? buildGamepadPayload(data.payload) : data.payload);
      if (data.eventName === "backButtonClicked") emit("backButtonClicked", data.payload);
      return;
    }

    if (data.type === "NAJI_WALLET_UPDATE") {
      if (initData && typeof initData === "object") {
        initData = { ...initData, wallet: data.wallet || null };
      }
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

    get parentOrigin() {
      return PARENT_ORIGIN;
    },

    get permissions() {
      return initData?.permissions || {};
    },

    get sparks() {
      return initData?.sparks || { balance: 0 };
    },

    get gamepads() {
      return gamepadsState;
    },

    get gamepadSupported() {
      return Boolean(initData?.gamepadSupported);
    },

    get orientation() {
      return orientationState || initData?.orientation || null;
    },

    get startParams() {
      return initData?.startParams || initData?.launchParams || null;
    },

    get multiplayer() {
      return multiplayerState || initData?.multiplayer || null;
    },

    get voice() {
      return voiceState || initData?.voice || null;
    },

    on,
    off,

    requestContext() {
      return request("GET_CONTEXT").then((ctx) => {
        if (ctx && typeof ctx === "object") {
          initData = { ...(initData || {}), ...ctx };
          if (Array.isArray(ctx.gamepads)) setGamepads(ctx.gamepads);
          if (ctx.orientation) setOrientation(ctx.orientation);
        }
        return ctx;
      });
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

    api: {
      request(path, options) {
        const normalized = options || {};
        return request("API_REQUEST", {
          path,
          method: normalized.method || "GET",
          headers: normalized.headers || {},
          body: serializeBody(normalized.body)
        });
      },
    },

    contacts: {
      list(options) {
        return request("MINIAPP_CONTACTS_GET", options || {}).then((result) => (
          Array.isArray(result) ? result : (result?.contacts || [])
        ));
      },
      get(options) {
        return this.list(options);
      },
      inviteRoom(options) {
        return request("MINIAPP_CONTACT_INVITE", {
          intent: "room_invite",
          ...(options || {})
        });
      },
      share(options) {
        return request("MINIAPP_SHARE_TO_CONTACT", options || {});
      },
      invite(options) {
        return this.inviteRoom(options);
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

    gamepad: {
      get supported() {
        return Boolean(initData?.gamepadSupported);
      },
      get state() {
        return gamepadsState;
      },
      get primary() {
        return gamepadsState[0] || null;
      },
      getState() {
        return request("GET_GAMEPADS").then((gamepads) => setGamepads(gamepads));
      },
      refresh() {
        return request("GET_GAMEPADS").then((gamepads) => setGamepads(gamepads));
      },
      onChange(handler) {
        return on("gamepadsChanged", handler);
      },
      onConnect(handler) {
        return on("gamepadConnected", handler);
      },
      onDisconnect(handler) {
        return on("gamepadDisconnected", handler);
      },
    },

    orientation: {
      get state() {
        return orientationState || initData?.orientation || null;
      },
      getState() {
        return request("GET_ORIENTATION").then((orientation) => setOrientation(orientation));
      },
      refresh() {
        return request("GET_ORIENTATION").then((orientation) => setOrientation(orientation));
      },
      onChange(handler) {
        return on("orientationChanged", handler);
      }
    },

    multiplayer: {
      get state() {
        return multiplayerState || initData?.multiplayer || null;
      },
      get currentRoom() {
        return (multiplayerState || initData?.multiplayer || {}).room || null;
      },
      get queue() {
        return (multiplayerState || initData?.multiplayer || {}).queue || null;
      },
      getState() {
        return request("MINIAPP_MULTIPLAYER_GET_STATE").then((state) => setMultiplayer(state));
      },
      createRoom(options) {
        return request("MINIAPP_MULTIPLAYER_CREATE_ROOM", options || {}).then((state) => setMultiplayer(state));
      },
      joinRoom(options) {
        return request("MINIAPP_MULTIPLAYER_JOIN_ROOM", options || {}).then((state) => setMultiplayer(state));
      },
      leaveRoom(options) {
        return request("MINIAPP_MULTIPLAYER_LEAVE_ROOM", options || {}).then((state) => setMultiplayer(state));
      },
      joinMatchmaking(options) {
        return request("MINIAPP_MULTIPLAYER_JOIN_MATCHMAKING", options || {}).then((state) => setMultiplayer(state));
      },
      leaveMatchmaking(options) {
        return request("MINIAPP_MULTIPLAYER_LEAVE_MATCHMAKING", options || {}).then((state) => setMultiplayer(state));
      },
      updateState(state, options) {
        return request("MINIAPP_MULTIPLAYER_UPDATE_STATE", { ...(options || {}), state: state || {} }).then((nextState) => setMultiplayer(nextState));
      },
      send(eventName, payload, options) {
        const sendOptions = options || {};
        if (sendOptions.transient || sendOptions.noAck || sendOptions.fireAndForget) {
          post("MINIAPP_MULTIPLAYER_SEND_EVENT_FAST", {
            ...sendOptions,
            eventName,
            payload: payload || {}
          });
          return Promise.resolve({ ok: true, transient: true, ts: Date.now() });
        }
        return request("MINIAPP_MULTIPLAYER_SEND_EVENT", {
          ...sendOptions,
          eventName,
          payload: payload || {}
        });
      },
      onChange(handler) {
        return on("multiplayerStateChanged", handler);
      },
      onMatchFound(handler) {
        return on("multiplayerMatchFound", handler);
      },
      onEvent(handler) {
        return on("multiplayerEvent", handler);
      }
    },

    voice: {
      get state() {
        return voiceState || initData?.voice || null;
      },
      get participants() {
        return (voiceState || initData?.voice || {}).participants || [];
      },
      getState() {
        return request("MINIAPP_VOICE_GET_STATE").then((state) => setVoice(state));
      },
      join(options) {
        return request("MINIAPP_VOICE_JOIN", options || {}).then((state) => setVoice(state));
      },
      leave() {
        return request("MINIAPP_VOICE_LEAVE", {}).then((state) => setVoice(state));
      },
      setMuted(muted) {
        return request("MINIAPP_VOICE_SET_MUTED", { muted: !!muted }).then((state) => setVoice(state));
      },
      toggleMuted() {
        const nextMuted = !Boolean((voiceState || initData?.voice || {}).muted);
        return request("MINIAPP_VOICE_SET_MUTED", { muted: nextMuted }).then((state) => setVoice(state));
      },
      onChange(handler) {
        return on("voiceStateChanged", handler);
      },
      onParticipantsChange(handler) {
        return on("voiceParticipantsChanged", handler);
      },
      onParticipantJoined(handler) {
        return on("voiceParticipantJoined", handler);
      },
      onParticipantLeft(handler) {
        return on("voiceParticipantLeft", handler);
      }
    },

    payments: {
      invoice(options) {
        return request("CREATE_INVOICE_SPARKS", options || {});
      },
      crypto(options) {
        return request("CRYPTO_REQUEST", options || {});
      },
      solana(options) {
        return request("MINIAPP_SOLANA_PAYMENT", options || {});
      }
    },

    ping() {
      return request("NAJI_SDK_PING");
    },
  };

  window.NajiMiniApp = sdk;
})();
