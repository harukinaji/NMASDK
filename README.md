# NMASDK

Naji Mini Apps SDK — standalone JavaScript library for building mini apps inside [NajiMe](https://github.com/harukinaji/najime-flutter).

> **Alpha** — this SDK is under active development. APIs may change without notice.

## Install

### Script tag

```html
<script src="https://cdn.jsdelivr.net/gh/harukinaji/NMASDK@main/nmasdk.js"></script>
```

### npm

```bash
npm install naji-miniapp-sdk
```

```js
import NajiMiniApp from 'naji-miniapp-sdk';
```

## Quick Start

```js
// 1. Initialize the SDK
const initData = await NajiMiniApp.init();
console.log('User:', initData.user);

// 2. Signal that the app is ready
NajiMiniApp.ready();

// 3. Use the API
const wallet = await NajiMiniApp.wallet.getState();
console.log('Address:', wallet?.address);
```

## API

### Core

| Method | Returns | Description |
|---|---|---|
| `init()` | `Promise<InitData>` | Initialize SDK, receive user/theme/wallet info |
| `ready()` | `void` | Signal host that mini app is loaded |
| `close()` | `void` | Close the mini app |
| `expand()` | `void` | Expand to fullscreen |
| `collapse()` | `void` | Collapse back |
| `setHeaderColor(color)` | `void` | Set WebView header color |
| `requestContext()` | `Promise<Context>` | Request fresh context from host |
| `ping()` | `Promise<pong>` | Check connection |
| `on(event, handler)` | `Function` (unsubscribe) | Subscribe to an event |
| `off(event, handler?)` | `void` | Unsubscribe (all if no handler) |

**Properties:** `initData`, `user`, `theme`, `platform`, `permissions`, `sparks`, `startParams`, `orientation`, `multiplayer`, `voice`

### Back Button

```js
NajiMiniApp.backButton.show();
NajiMiniApp.backButton.hide();
NajiMiniApp.backButton.onClick(() => { /* handle */ });
```

### Storage

```js
await NajiMiniApp.storage.get('score');          // read
await NajiMiniApp.storage.set('score', 42);      // write
await NajiMiniApp.storage.remove('score');        // delete
const keys = await NajiMiniApp.storage.keys();    // list all
```

### API (Authorized REST)

Limited to whitelisted paths: `/api/miniapp/`, `/api/me`, `/api/stickers/`.

```js
const data = await NajiMiniApp.api.request('/api/miniapp/leaderboard', {
  method: 'GET',
});
```

### Contacts

```js
const contacts = await NajiMiniApp.contacts.list();
await NajiMiniApp.contacts.share({ contactId: '...' });
await NajiMiniApp.contacts.invite({ contactId: '...' });
await NajiMiniApp.contacts.inviteRoom({ contactId: '...' });
```

### UI

```js
NajiMiniApp.ui.alert('Hello!');
await NajiMiniApp.ui.toast('Saved', 'success');
await NajiMiniApp.ui.openLink('https://example.com');
await NajiMiniApp.ui.copy('text to copy');
```

### Wallet

```js
const state = await NajiMiniApp.wallet.getState();
const address = await NajiMiniApp.wallet.getAddress();
const wallet = await NajiMiniApp.wallet.view();   // open connect flow
NajiMiniApp.wallet.refresh();

NajiMiniApp.wallet.onChange((wallet) => {
  console.log('Wallet changed:', wallet?.address);
});

// Signing (host-side approval)
await NajiMiniApp.wallet.signMessage({ message: 'Sign this' });
await NajiMiniApp.wallet.signTransaction({ transaction: '...' });
await NajiMiniApp.wallet.signAndSendTransaction({ transaction: '...' });
```

### Payments

```js
// Solana payment
await NajiMiniApp.payments.solana({ amount: 1.5, recipient: '...' });

// Invoice (Sparks)
await NajiMiniApp.payments.invoice({ amount: 100 });

// Universal — auto-routes based on currency
await NajiMiniApp.payments.requestPayment({
  amount: 2,
  currency: 'SOL',        // 'SOL' or 'SPL-*' → Solana, else → EVM
  recipient: '...',
  label: 'Coffee',
});
```

### Multiplayer

```js
// Create / join a room
const state = await NajiMiniApp.multiplayer.createRoom({ max_players: 4 });
await NajiMiniApp.multiplayer.joinRoom({ room_id: 'abc123' });
await NajiMiniApp.multiplayer.leaveRoom();

// Matchmaking
await NajiMiniApp.multiplayer.joinMatchmaking();
await NajiMiniApp.multiplayer.leaveMatchmaking();

// Send game events
await NajiMiniApp.multiplayer.send('move', { x: 10, y: 20 });
// Transient (no ACK, fire-and-forget)
NajiMiniApp.multiplayer.send('position', { x, y }, { transient: true });

// Update shared game state
await NajiMiniApp.multiplayer.updateState({ board: [...] });

// Listen
NajiMiniApp.multiplayer.onChange((state) => { /* room state */ });
NajiMiniApp.multiplayer.onEvent((event) => { /* game event */ });
NajiMiniApp.multiplayer.onMatchFound((match) => { /* matched */ });
```

**Properties:** `currentRoom`, `queue`, `state`

### Voice

```js
await NajiMiniApp.voice.join();
await NajiMiniApp.voice.leave();
await NajiMiniApp.voice.setMuted(true);
await NajiMiniApp.voice.toggleMuted();

NajiMiniApp.voice.onChange((state) => { /* voice state */ });
NajiMiniApp.voice.onParticipantsChange((list) => { /* participants */ });
NajiMiniApp.voice.onParticipantJoined((p) => { /* joined */ });
NajiMiniApp.voice.onParticipantLeft((p) => { /* left */ });
```

**Properties:** `participants`, `state`

### Gamepad

```js
const gamepads = await NajiMiniApp.gamepad.getState();
NajiMiniApp.gamepad.onChange(({ gamepads, primary }) => { /* ... */ });
NajiMiniApp.gamepad.onConnect(({ gamepad }) => { /* connected */ });
NajiMiniApp.gamepad.onDisconnect(({ gamepad }) => { /* disconnected */ });
```

**Properties:** `supported`, `state`, `primary`

### Orientation

```js
const orientation = await NajiMiniApp.orientation.getState();
NajiMiniApp.orientation.onChange((orientation) => { /* ... */ });
```

### Gyroscope / Accelerometer

```js
NajiMiniApp.gyroscope.start();
NajiMiniApp.gyroscope.stop();
NajiMiniApp.gyroscope.onChange((data) => { /* {alpha, beta, gamma} */ });

NajiMiniApp.accelerometer.start();
NajiMiniApp.accelerometer.stop();
NajiMiniApp.accelerometer.onChange((data) => { /* {x, y, z} */ });
```

### Vibrator

```js
NajiMiniApp.vibrator.vibrate(200); // ms
```

### NFC

```js
const available = await NajiMiniApp.nfc.isAvailable();
const enabled = await NajiMiniApp.nfc.isEnabled();
const tag = await NajiMiniApp.nfc.read();
await NajiMiniApp.nfc.write([{ id: '...', data: '...' }]);
await NajiMiniApp.nfc.sharePayload('text');
NajiMiniApp.nfc.stopShare();
await NajiMiniApp.nfc.connectIsoDep();
await NajiMiniApp.nfc.transceive('00A40400...');
NajiMiniApp.nfc.disconnect();
NajiMiniApp.nfc.onTagRead((tag) => { /* ... */ });
```

### Bluetooth

```js
await NajiMiniApp.bluetooth.startScan({ services: [] });
NajiMiniApp.bluetooth.stopScan();
await NajiMiniApp.bluetooth.connect('device-id');
await NajiMiniApp.bluetooth.sendRaw('device-id', 'data');
const services = await NajiMiniApp.bluetooth.discoverServices('device-id');
await NajiMiniApp.bluetooth.subscribe('device-id', 'service', 'char');
await NajiMiniApp.bluetooth.readRaw('device-id', 'service', 'char');
NajiMiniApp.bluetooth.onDeviceFound((device) => { /* ... */ });
NajiMiniApp.bluetooth.onData((data) => { /* ... */ });
NajiMiniApp.bluetooth.onConnectionStateChanged((state) => { /* ... */ });
```

### Camera

```js
const photo = await NajiMiniApp.camera.takePhoto();
const stream = await NajiMiniApp.camera.getUserMedia({ video: true, audio: true });
```

## Events

| Event | Payload | Description |
|---|---|---|
| `init` | `InitData` | SDK initialized |
| `themeChanged` | `'light' \| 'dark'` | Theme toggled |
| `walletChanged` | `Wallet \| null` | Wallet connected/disconnected |
| `orientationChanged` | `Orientation` | Device rotated |
| `multiplayerStateChanged` | `MultiplayerState` | Room/queue state changed |
| `multiplayerMatchFound` | `Match` | Matchmaking found a match |
| `multiplayerEvent` | `GameEvent` | Received game event |
| `voiceStateChanged` | `VoiceState` | Voice channel state |
| `voiceParticipantsChanged` | `Participant[]` | Participant list updated |
| `voiceParticipantJoined` | `Participant` | Someone joined voice |
| `voiceParticipantLeft` | `Participant` | Someone left voice |
| `gamepadsChanged` | `{gamepads, primary, supported}` | Gamepad state updated |
| `gamepadConnected` | `{gamepad}` | Gamepad plugged in |
| `gamepadDisconnected` | `{gamepad}` | Gamepad unplugged |
| `backButtonClicked` | `void` | Back button pressed |
| `gyroscopeChanged` | `{alpha, beta, gamma}` | Gyroscope data |
| `accelerometerChanged` | `{x, y, z}` | Accelerometer data |
| `nfcTagRead` | `Tag` | NFC tag detected |
| `bluetoothDeviceFound` | `Device` | BLE device found |
| `bluetoothDataReceived` | `Data` | BLE data received |
| `bluetoothConnectionStateChanged` | `State` | BLE connection changed |

## Security

- **HTTPS only** — mini apps must be served over HTTPS
- **URL allowlist** — localhost, private IPs, and link-local addresses are blocked
- **API whitelist** — REST proxy only allows `/api/miniapp/`, `/api/me`, `/api/stickers/`
- **Host approval** — wallet operations require explicit user confirmation in the host app
- **Origin validation** — SDK validates parent origin to prevent injection

## License

[MIT](LICENSE)
