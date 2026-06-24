const API_BASE_URL = "https://api.r1zoor.cyou";
const SESSION_AUTH_RETRY_DELAY_MS = 700;
const SESSION_TOKEN_PARAM = "session_token";
const FULL_MAX_DURATION_SECONDS = 360;
const LONG_FULL_TRACK_THRESHOLD_SECONDS = 180;
const miniappSessionToken = new URLSearchParams(window.location.search).get(SESSION_TOKEN_PARAM) || "";

/* Telegram context */
const tg = window.Telegram?.WebApp || null;
let userId = null;
let telegramInitData = "";
let telegramUser = null;
let hasLoggedTelegramBootstrap = false;
let accessUiState = "auth_checking";
let lastAuthCheckResult = null;
let authAutoRetryUsed = false;

const ACCESS_UI_STATES = {
  SESSION_MISSING: "session_missing",
  SESSION_EXPIRED: "session_expired",
  SESSION_INVALID: "session_invalid",
  AUTH_CHECKING: "auth_checking",
  TELEGRAM_AUTH_ERROR: "telegram_auth_error",
  FULL_VERIFIED: "full_verified",
};

const AUTH_ERROR_CODES = new Set([
  "missing_session_token",
  "invalid_session",
  "expired_session",
  "telegram_user_not_found",
]);

/* DOM refs */
const audioFileInput = document.getElementById("audioFile");
const backgroundFileInput = document.getElementById("backgroundFile");
const removeBackgroundButton = document.getElementById("removeBackgroundButton");
const backgroundControls = document.getElementById("backgroundControls");
const toggleDimButton = document.getElementById("toggleDimButton");
const backgroundDimPanel = document.getElementById("backgroundDimPanel");
const backgroundDimInput = document.getElementById("backgroundDim");
const backgroundDimValue = document.getElementById("backgroundDimValue");
const backgroundDimPreview = document.getElementById("backgroundDimPreview");
const backgroundDimSummary = document.getElementById("backgroundDimSummary");
const backgroundDimSummaryValue = document.getElementById("backgroundDimSummaryValue");
const customBackgroundInfo = document.getElementById("customBackgroundInfo");

const engineSelect = document.getElementById("engine");
const styleField = document.getElementById("styleField");
const milkPanel = document.getElementById("milkPanel");
const milkSearchInput = document.getElementById("milkSearchInput");
const milkShuffleButton = document.getElementById("milkShuffleButton");
const milkPresetGrid = document.getElementById("milkPresetGrid");
const milkPresetInput = document.getElementById("milkPresetInput");

const visualizerColorInput = document.getElementById("visualizerColor");
const visualizerColorText = document.getElementById("visualizerColorText");
const accentColorInput = document.getElementById("accentColor");
const accentColorText = document.getElementById("accentColorText");

const modeSelect = document.getElementById("mode");
const orientationSelect = document.getElementById("orientation");
const renderButton = document.getElementById("renderButton");
const resetButton = document.getElementById("resetButton");
const statusBox = document.getElementById("statusBox");
const langToggle = document.getElementById("langToggle");
const customTextField = document.getElementById("customTextField");
const customTextInput = document.getElementById("customTextInput");
const tokensBadge = document.getElementById("tokensBadge");
const renderHistoryList = document.getElementById("renderHistoryList");
const historyRefreshButton = document.getElementById("historyRefreshButton");
const openBotBuyButton = document.getElementById("openBotBuyButton");

/* State */
let currentLang = "ru";
let isDimPanelOpen = false;
let visibleMilkPresets = [];
let previewAnimationId = null;
let currentTokenBalance = null;
let recentRenderHistory = [];
let favoritePresetKeys = new Set();
let pendingFavoriteToggles = new Set();

function updateTokensBadge(value) {
  currentTokenBalance = Number.isFinite(Number(value)) ? Number(value) : null;
  if (tokensBadge) {
    tokensBadge.textContent = `Tokens: ${currentTokenBalance === null ? "—" : currentTokenBalance}`;
  }
}

function buildAccessUrl(path) {
  const url = new URL(`${API_BASE_URL}${path}`);
  return url.toString();
}

function isUsableAccessPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (
        payload.full_render_credits !== undefined ||
        payload.render_tokens !== undefined ||
        payload.full_mode_available !== undefined ||
        payload.access_reason !== undefined
      )
  );
}

function normalizeAccessSnapshot(payload) {
  const renderTokens = Number(payload.full_render_credits ?? payload.render_tokens ?? 0);

  return {
    fullRenderCredits: Number.isFinite(renderTokens) ? renderTokens : 0,
    renderTokens: Number.isFinite(renderTokens) ? renderTokens : 0,
    fullModeAvailable: payload.full_mode_available === true,
    accessReason: payload.access_reason || "none",
  };
}

async function fetchAccessSnapshot(path, context) {
  const url = buildAccessUrl(path);
  const headers = buildSessionAuthHeaders();

  try {
    console.debug("[access] request", {
      path,
      sessionTokenPresent: Boolean(miniappSessionToken),
      initDataLengthDebug: context.init_data ? context.init_data.length : 0,
    });

    const { response, payload } = await fetchJson(url, { method: "GET", headers }, 15000);
    console.debug("[access] response", {
      path,
      status: response.status,
      errorCode: getBackendErrorCode(payload),
    });

    if (response.ok && isUsableAccessPayload(payload)) {
      return { ok: true, path, snapshot: normalizeAccessSnapshot(payload) };
    }

    const errorCode = getBackendErrorCode(payload);
    console.warn("Access preflight failed", {
      path,
      status: response.status,
      errorCode,
      payload: sanitizePayloadForLog(payload),
    });
    if (response.status === 401) {
      console.warn("[access] endpoint returned 401:", path);
    }
    const apiError = normalizeApiError({ url, options: { method: "GET", headers }, response, payload });
    return {
      ok: false,
      path,
      status: response.status,
      errorCode,
      message: response.ok ? "invalid access response" : apiError.userMessage,
      apiError,
    };
  } catch (error) {
    const apiError = error?.apiError || normalizeApiError({ url, options: { method: "GET", headers }, error });
    console.warn("Access preflight failed", {
      path,
      error: apiError,
    });
    return {
      ok: false,
      path,
      message: apiError.userMessage || error?.message || "network error",
      apiError,
    };
  }
}

async function verifyFullModeAccess() {
  const authResult = await runTelegramAuthCheck({ allowAutoRetry: true, renderStatus: true });

  if (
    authResult.state === ACCESS_UI_STATES.SESSION_MISSING ||
    authResult.state === ACCESS_UI_STATES.SESSION_EXPIRED ||
    authResult.state === ACCESS_UI_STATES.SESSION_INVALID ||
    authResult.state === ACCESS_UI_STATES.TELEGRAM_AUTH_ERROR
  ) {
    return { allowed: false, reason: "auth_failed", errorCode: authResult.errorCode, errors: authResult.errors };
  }

  if (authResult.state !== ACCESS_UI_STATES.FULL_VERIFIED) {
    return { allowed: false, reason: authResult.reason || "unverified", errors: authResult.errors };
  }

  const snapshot = authResult.plan?.snapshot || authResult.balance?.snapshot;
  return snapshot?.fullModeAvailable
    ? { allowed: true, source: authResult.source, snapshot }
    : { allowed: false, source: authResult.source, reason: "no_access", snapshot };
}

function fullAccessRequiredMessage() {
  return currentLang === "ru"
    ? "Full render стоит 1 токен. Откройте бота, чтобы выбрать пакет. Доступны пакеты: 25, 100 и 250 токенов."
    : "Full render needs 1 token. Open the bot to choose a package. Packages available: 25, 100, 250 tokens.";
}


function paymentMethodsHtml() {
  return `
    <div class="payment-methods-inline">
      <strong>${escapeHtml(t("paymentMethodsTitle"))}</strong>
      <span>${escapeHtml(t("paymentMethodsText"))}</span>
      <span>${escapeHtml(t("paymentMethodStars"))}</span>
      <span>${escapeHtml(t("paymentMethodCrypto"))}</span>
      <button id="statusOpenBotBuyButton" class="ghost-button payment-open-bot" type="button">${escapeHtml(t("openBotBuyButton"))}</button>
    </div>`;
}

function fullAccessRequiredHtml() {
  return `<p>${formatStatusHtml(fullAccessRequiredMessage())}</p>${paymentMethodsHtml()}`;
}

function openBotToBuyTokens() {
  const webApp = getTelegramWebApp();
  if (webApp && typeof webApp.close === "function") {
    webApp.close();
    return;
  }
  setStatus(t("openBotFallback"), "info");
}
function accessVerificationFailedMessage() {
  return "Unable to verify Full mode access. Please try again or use Demo mode.";
}

function telegramContextRequiredMessage() {
  return "Open the visualizer from the Telegram bot.";
}

function accessAuthFailedMessage() {
  return "Open the visualizer from the Telegram bot.";
}

/* Presets */
const milkPresets = [
  { key: "neon_mandala", name: "Neon Mandala", family: "neon_mandala", desc: "Layered neon symmetry with premium motion." },
  { key: "bass_tunnel", name: "Bass Tunnel", family: "bass_tunnel", desc: "Deep tunnel motion driven by bass." },
  { key: "laser_fan", name: "Laser Fan", family: "laser_fan", desc: "Sharp beams for energetic tracks." },
  { key: "plasma_orb", name: "Plasma Orb", family: "plasma_orb", desc: "Glowing plasma core with audio pulse." },
  { key: "particle_fountain", name: "Particle Fountain", family: "particle_fountain", desc: "Rising neon particles and sparks." },
  { key: "double_ring", name: "Double Ring", family: "double_ring", desc: "Two layered circles with audio energy." },
  { key: "spectrogram_plus", name: "Spectrogram Plus", family: "spectrogram_plus", desc: "Dense colorful spectral movement." },
  { key: "orbital_scope", name: "Orbital Scope", family: "orbital_scope", desc: "Orbiting scope points with rotation." },
  { key: "mandala_bloom", name: "Mandala Bloom", family: "mandala_bloom", desc: "Wider mandala bloom with denser petals." },
  { key: "horizon_wave", name: "Horizon Wave", family: "horizon_wave", desc: "Wide cinematic waveform." },
  { key: "radial_bars", name: "Radial Bars", family: "radial_bars", desc: "Circular bars around a bright core." },
  { key: "particle_crown", name: "Particle Crown", family: "particle_crown", desc: "Wider particle crown with golden sparks." },
  { key: "tunnel_depth", name: "Tunnel Depth", family: "tunnel_depth", desc: "Deeper tunnel rings with tighter motion." },
  { key: "plasma_shell", name: "Plasma Shell", family: "plasma_shell", desc: "Large plasma shell with bright outer glow." },
  { key: "ring_neon", name: "Ring Neon", family: "ring", desc: "Classic glowing ring with soft pulse." },
  { key: "laser_burst", name: "Laser Burst", family: "laser_burst", desc: "Denser beam burst with harder impact." },
  { key: "double_ring_echo", name: "Double Ring Echo", family: "double_ring_echo", desc: "Dense echo rings with finer radial detail." },
  { key: "spectrum_wall", name: "Spectrum Wall", family: "spectrum_wall", desc: "Tall spectral wall with stronger columns." },
  { key: "radial_burst", name: "Radial Burst", family: "radial_burst", desc: "High-density radial burst around the core." },
  { key: "orbital_storm", name: "Orbital Storm", family: "orbital_storm", desc: "More orbit points and a storm-like ring." },
];

/* i18n */
const i18n = {
  en: {
    badge: "● MP3/WAV → MP4 visualizer",
    title: "Create audio visualization in Telegram",
    subtitle: "Upload your track, choose style and mode. In demo you get a short preview with watermark, in full — complete MP4 without restrictions.",
    milkOnlyBadge: "MILK engine only",
    sectionTitle: "New Render",
    fileLabel: "Audio file",
    fileHint: "MP3 and WAV are supported.",
    backgroundLabel: "Background image / GIF / video",
    backgroundHint: "Optional. Video/GIF backgrounds up to 150 MB. If empty, default dark background will be used.",
    customBackgroundSelected: "Custom background selected",
    customBackgroundFill: "Will fill the whole frame",
    toggleDimButton: "Adjust dimming",
    removeBackgroundButton: "Remove background",
    backgroundDimLabel: "Background dim",
    backgroundDimHint: "0% = original background, 100% = fully black.",
    shuffleButton: "Shuffle",
    milkHint: "Showing a few random presets. Search by name or shuffle to discover more.",
    modeLabel: "Mode",
    orientationLabel: "Orientation",
    modeDemo: "Demo",
    modeFull: "Full",
    orientationPortrait: "Portrait (phone)",
    orientationLandscape: "Landscape",
    visualizerColorLabel: "Visualizer color",
    visualizerColorHint: "Main color for wave, bars or core visualizer.",
    accentColorLabel: "Accent color",
    accentColorHint: "Secondary glow / accent color for MILK presets.",
    customTextLabel: "Title for full video",
    customTextHint: "Will be shown at the top center only in Full mode. Up to 80 characters.",
    summaryEngine: "Engine",
    summaryEngineDesc: "MILK only",
    summaryDemo: "Demo",
    summaryDemoDesc: "Up to 60 seconds + watermark",
    summaryFull: "Full",
    summaryFullDesc: "Up to 6 minutes without watermark",
    fullDurationExceeded: "Full mode supports audio up to 6 minutes.",
    longFullTrackNote: "Long track, render may take longer.",
    summaryBackgroundDim: "Background dim",
    renderButton: "Create Video",
    resetButton: "Reset",
    deliveryTitle: "Delivery: Telegram",
    deliverySubtitle: "Your video will be sent to your Telegram chat",
    deliveryLargeNote: "Large videos may be sent as a download link",
    paymentMethodsTitle: "How to pay",
    paymentMethodsText: "You can buy tokens in the bot.",
    paymentMethodStars: "Telegram Stars (in-app)",
    paymentMethodCrypto: "Crypto: USDT, TON (via bot)",
    openBotBuyButton: "Open bot to buy tokens",
    openBotFallback: "Open the Telegram bot to choose a token package.",
    footerNote: "Rendering may take some time. Ready MP4 will be sent by bot directly into Telegram chat.",
    noFile: "Please select an audio file.",
    checkingApi: "Checking API availability...",
    uploading: "Uploading audio...",
    queued: "Rendering video...",
    processing: "Rendering video...",
    finalizing: "Finalizing video...",
    readyTelegram: "Your video will be sent to Telegram",
    sendingTelegram: "Sending to Telegram...",
    sentTelegram: "Video sent to Telegram",
    deliveryFailed: "Your video is ready, but Telegram delivery failed",
    doneChat: "Video sent to Telegram",
    failed: "Render failed",
    networkError: "Network error. Please check API_BASE_URL, tunnel, and CORS.",
    badResponse: "Server returned an unexpected response.",
    healthFailed: "API health check failed.",
    resetDone: "Form reset.",
    invalidColor: "Invalid HEX color. Use format like #28c7e0.",
    download: "Download MP4 instead",
    validationFailed: "Validation error.",
    requestTimeout: "Request timeout. Please try again.",
    statusUnavailable: "Status request failed.",
    networkUnavailable: "Network unavailable or API is down.",
    corsOrMixedContent: "Request blocked by browser (CORS / mixed content).",
    serverError: "Server error",
    authError: "Authorization error",
    progress: "Progress",
    queuePosition: "Queue position",
    queueEta: "Approx. wait",
    queueWaiting: "Waiting for an available render worker",
    queueNext: "Next in line",
    historyTitle: "Recent renders",
    historyRefresh: "Refresh",
    historyLoading: "Loading recent renders...",
    historyEmpty: "No renders yet. Create your first visualizer and it will appear here.",
    historyUnavailable: "Could not load recent renders. Please try again.",
    historyCreated: "Created",
    historyUpdated: "Updated",
    statusQueued: "Queued",
    statusRendering: "Rendering",
    statusFinalizing: "Finalizing",
    statusSending: "Sending",
    statusDone: "Done",
    statusFailed: "Failed",
    statusDeliveryFailed: "Delivery failed",
    favoritePreset: "Add to favorites",
    unfavoritePreset: "Remove from favorites",
    reuseSettings: "Reuse settings",
    retryWithSettings: "Try again with these settings",
    retryNeedsFiles: "You'll need to choose audio/background again.",
    settingsReused: "Settings reused. Upload audio and create a new video.",
    chooseBackgroundAgain: "Previous background file is not reused. Choose a background again if needed.",
    backgroundCustom: "custom background",
    backgroundDefault: "default background",
  },
  ru: {
    badge: "● MP3/WAV → MP4 visualizer",
    title: "Создай аудиовизуализацию в Telegram",
    subtitle: "Загрузи трек, выбери стиль и режим. В demo ты получишь короткий предпросмотр с вотермаркой, в full — полный MP4 без ограничений.",
    milkOnlyBadge: "Только MILK engine",
    sectionTitle: "Новый рендер",
    fileLabel: "Аудиофайл",
    fileHint: "Поддерживаются MP3 и WAV.",
    backgroundLabel: "Фон: изображение / GIF / видео",
    backgroundHint: "Необязательно. Видео/GIF фон до 150 MB. Если не выбрать файл, будет использован тёмный фон по умолчанию.",
    customBackgroundSelected: "Custom background selected",
    customBackgroundFill: "Will fill the whole frame",
    toggleDimButton: "Настроить затемнение",
    removeBackgroundButton: "Убрать фон",
    backgroundDimLabel: "Затемнение фона",
    backgroundDimHint: "0% = исходный фон, 100% = полностью чёрный.",
    shuffleButton: "Случайные",
    milkHint: "Показаны несколько случайных пресетов. Ищи по имени или перемешивай список.",
    modeLabel: "Режим",
    orientationLabel: "Ориентация",
    modeDemo: "Demo",
    modeFull: "Full",
    orientationPortrait: "Вертикально (телефон)",
    orientationLandscape: "Горизонтально",
    visualizerColorLabel: "Цвет визуализатора",
    visualizerColorHint: "Основной цвет волны, баров или центрального визуализатора.",
    accentColorLabel: "Акцентный цвет",
    accentColorHint: "Вторичный glow / accent цвет для пресетов MILK.",
    customTextLabel: "Текст для full-видео",
    customTextHint: "Будет показан сверху по центру только в Full mode. До 80 символов.",
    summaryEngine: "Движок",
    summaryEngineDesc: "Только MILK",
    summaryDemo: "Demo",
    summaryDemoDesc: "До 60 секунд + вотермарка",
    summaryFull: "Full",
    summaryFullDesc: "До 6 минут без вотермарки",
    fullDurationExceeded: "Full mode supports audio up to 6 minutes.",
    longFullTrackNote: "Long track, render may take longer.",
    summaryBackgroundDim: "Затемнение фона",
    renderButton: "Создать видео",
    resetButton: "Сбросить",
    deliveryTitle: "Delivery: Telegram",
    deliverySubtitle: "Your video will be sent to your Telegram chat",
    deliveryLargeNote: "Large videos may be sent as a download link",
    paymentMethodsTitle: "Как оплатить",
    paymentMethodsText: "Токены покупаются в боте.",
    paymentMethodStars: "Telegram Stars (внутри Telegram)",
    paymentMethodCrypto: "Криптовалюта: USDT, TON (через бота)",
    openBotBuyButton: "Открыть бота для покупки токенов",
    openBotFallback: "Откройте Telegram-бота, чтобы выбрать пакет токенов.",
    footerNote: "Рендер может занять время. Готовый MP4 бот отправит прямо в Telegram-чат.",
    noFile: "Сначала выбери аудиофайл.",
    checkingApi: "Проверяю API...",
    uploading: "Uploading audio...",
    queued: "Rendering video...",
    processing: "Rendering video...",
    finalizing: "Finalizing video...",
    readyTelegram: "Your video will be sent to Telegram",
    sendingTelegram: "Sending to Telegram...",
    sentTelegram: "Video sent to Telegram",
    deliveryFailed: "Your video is ready, but Telegram delivery failed",
    doneChat: "Video sent to Telegram",
    failed: "Рендер завершился ошибкой",
    networkError: "Сетевая ошибка. Проверь API_BASE_URL, tunnel и CORS.",
    badResponse: "Сервер вернул неожиданный ответ.",
    healthFailed: "Проверка API не прошла.",
    resetDone: "Форма сброшена.",
    invalidColor: "Некорректный HEX-цвет. Используй формат вроде #28c7e0.",
    download: "Download MP4 instead",
    validationFailed: "Ошибка валидации.",
    requestTimeout: "Таймаут запроса. Попробуй ещё раз.",
    statusUnavailable: "Не удалось получить статус.",
    networkUnavailable: "Сеть недоступна или API выключен.",
    corsOrMixedContent: "Запрос заблокирован браузером (CORS / mixed content).",
    serverError: "Ошибка сервера",
    authError: "Ошибка авторизации",
    progress: "Прогресс",
    queuePosition: "Позиция в очереди",
    queueEta: "Примерно ждать",
    queueWaiting: "Ожидаем свободный render worker",
    queueNext: "Следующий в очереди",
    historyTitle: "Последние рендеры",
    historyRefresh: "Обновить",
    historyLoading: "Загружаю историю...",
    historyEmpty: "Пока нет рендеров. Создай первый визуализатор, и он появится здесь.",
    historyUnavailable: "Не удалось загрузить историю. Попробуй ещё раз.",
    historyCreated: "Создан",
    historyUpdated: "Обновлён",
    statusQueued: "В очереди",
    statusRendering: "Рендерится",
    statusFinalizing: "Финализация",
    statusSending: "Отправляется",
    statusDone: "Готово",
    statusFailed: "Ошибка",
    statusDeliveryFailed: "Доставка не удалась",
    favoritePreset: "Добавить в избранное",
    unfavoritePreset: "Убрать из избранного",
    reuseSettings: "Повторить настройки",
    retryWithSettings: "Попробовать снова с этими настройками",
    retryNeedsFiles: "Аудио и фон нужно будет выбрать заново.",
    settingsReused: "Настройки подставлены. Загрузи аудио и создай новое видео.",
    chooseBackgroundAgain: "Старый файл фона не переиспользуется. Выбери фон заново, если нужно.",
    backgroundCustom: "кастомный фон",
    backgroundDefault: "фон по умолчанию",
  },
};

function t(key) {
  return i18n[currentLang]?.[key] ?? key;
}

/* i18n apply */
function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (key && i18n[currentLang]?.[key]) {
      node.textContent = i18n[currentLang][key];
    }
  });

  document.querySelectorAll("[data-i18n-opt]").forEach((node) => {
    const key = node.getAttribute("data-i18n-opt");
    if (key && i18n[currentLang]?.[key]) {
      node.textContent = i18n[currentLang][key];
    }
  });

  if (milkSearchInput) {
    milkSearchInput.placeholder =
      currentLang === "ru" ? "Поиск пресета по имени" : "Search preset by name";
  }

  if (customTextInput) {
    customTextInput.placeholder =
      currentLang === "ru" ? "Необязательный текст для full mode" : "Optional text for full mode";
  }

  if (langToggle) {
    langToggle.textContent = currentLang === "ru" ? "EN" : "RU";
  }
}

/* Status helpers */
function setStatus(message, type = "info") {
  statusBox.className = "status show";
  if (type === "success") statusBox.classList.add("success");
  if (type === "error") statusBox.classList.add("error");
  const html = String(message || "").trim().startsWith("<") ? message : `<p>${message}</p>`;
  statusBox.innerHTML = html;
  const statusOpenBotButton = document.getElementById("statusOpenBotBuyButton");
  if (statusOpenBotButton) statusOpenBotButton.addEventListener("click", openBotToBuyTokens);
}

function hideStatus() {
  statusBox.className = "status";
  statusBox.innerHTML = "";
}

/* Telegram */
function getTelegramWebApp() {
  return window.Telegram?.WebApp || tg || null;
}

function initTelegramContext() {
  const webApp = getTelegramWebApp();

  if (!hasLoggedTelegramBootstrap) {
    console.debug("[access] Telegram present:", Boolean(window.Telegram));
    console.debug("[access] Telegram WebApp present:", Boolean(webApp));
    hasLoggedTelegramBootstrap = true;
  }

  if (!webApp) return;

  try {
    webApp.ready();
  } catch (_) {}

  try {
    webApp.expand();
  } catch (_) {}

  telegramUser = webApp.initDataUnsafe?.user || webApp.initDataUnsafe?.receiver || null;
  userId = telegramUser?.id || null;
  telegramInitData = webApp.initData || "";
}

function buildTelegramUserContext() {
  const webApp = getTelegramWebApp();
  const webAppUser = webApp?.initDataUnsafe?.user || webApp?.initDataUnsafe?.receiver || null;
  const currentUser = webAppUser || telegramUser || null;
  const initData = webApp?.initData || "";
  const currentUserId = currentUser?.id || userId || null;
  const initParams = new URLSearchParams(initData);
  const hasHash = initParams.has("hash");

  return {
    init_data: initData,
    user_id: currentUserId ? String(currentUserId) : "",
    platform: webApp?.platform || tg?.platform || "",
    username: currentUser?.username || "",
    first_name: currentUser?.first_name || "",
    language_code: currentUser?.language_code || "",
    hasInitData: Boolean(initData),
    hasAuthGradeInitData: Boolean(initData && initData.length > 20 && hasHash),
    hasQueryId: initParams.has("query_id"),
    hasHash,
    hasUnsafeUserId: Boolean(currentUser?.id),
    telegramPresent: Boolean(window.Telegram),
    webAppPresent: Boolean(webApp),
  };
}

function debugTelegramUserContext(scope, context) {
  console.debug(`[access] ${scope} Telegram present:`, context.telegramPresent);
  console.debug(`[access] ${scope} Telegram WebApp present:`, context.webAppPresent);
  console.debug(`[access] ${scope} initData length:`, context.init_data ? context.init_data.length : 0);
  console.debug(`[access] ${scope} initData has query_id:`, context.hasQueryId);
  console.debug(`[access] ${scope} initData has hash:`, context.hasHash);
  console.debug(`[access] ${scope} initDataUnsafe user.id present:`, context.hasUnsafeUserId);
}

function getBackendErrorCode(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (payload.error && typeof payload.error === "object" && typeof payload.error.code === "string") {
    return payload.error.code;
  }
  if (typeof payload.code === "string") return payload.code;
  return "";
}

function isAuthRelatedAccessError(result) {
  return Boolean(result && result.status === 401 && AUTH_ERROR_CODES.has(result.errorCode));
}

function setAccessUiState(state, details = {}) {
  accessUiState = state;
  console.info("[access] final ui state", {
    state: accessUiState,
    retryHappened: authAutoRetryUsed,
    backendErrorCode: details.errorCode || "",
  });
}

function accessMessageForErrorCode(errorCode) {
  if (errorCode === "missing_session_token") {
    return "Open the visualizer from the Telegram bot.";
  }
  if (errorCode === "expired_session") {
    return "Session expired. Reopen the visualizer from the bot.";
  }
  if (errorCode === "invalid_session") {
    return "Session is invalid. Reopen the visualizer from the bot.";
  }
  return accessAuthFailedMessage();
}

function uiStateForSessionError(errorCode) {
  if (errorCode === "missing_session_token") return ACCESS_UI_STATES.SESSION_MISSING;
  if (errorCode === "expired_session") return ACCESS_UI_STATES.SESSION_EXPIRED;
  if (errorCode === "invalid_session") return ACCESS_UI_STATES.SESSION_INVALID;
  return ACCESS_UI_STATES.TELEGRAM_AUTH_ERROR;
}

function setRetryableAuthStatus(message, errorCode = "") {
  const safeMessage = formatStatusHtml(message);
  const codeLine = errorCode ? `<br><span class="hint">error.code: ${escapeHtml(errorCode)}</span>` : "";
  statusBox.className = "status show error";
  statusBox.innerHTML = `<p>${safeMessage}${codeLine}</p><button id="authRetryButton" class="ghost-button" type="button">Retry</button>`;
  document.getElementById("authRetryButton")?.addEventListener("click", () => {
    console.info("[access] manual retry requested");
    runTelegramAuthCheck({ allowAutoRetry: false, renderStatus: true, manualRetry: true });
  });
}

async function runTelegramAuthCheck({ allowAutoRetry = true, renderStatus = false, manualRetry = false } = {}) {
  initTelegramContext();
  const context = buildTelegramUserContext();
  debugTelegramUserContext(manualRetry ? "manual_retry" : "auth_check", context);

  console.info("[access] bootstrap", {
    sessionTokenPresent: Boolean(miniappSessionToken),
    initDataLengthDebug: context.init_data ? context.init_data.length : 0,
    retryHappened: authAutoRetryUsed,
  });

  if (!miniappSessionToken) {
    const result = {
      state: ACCESS_UI_STATES.SESSION_MISSING,
      reason: "missing_session_token",
      errorCode: "missing_session_token",
      errors: [],
    };
    lastAuthCheckResult = result;
    updateTokensBadge(null);
    setAccessUiState(result.state, { errorCode: result.errorCode });
    if (renderStatus) setRetryableAuthStatus(accessMessageForErrorCode(result.errorCode), result.errorCode);
    return result;
  }

  setAccessUiState(ACCESS_UI_STATES.AUTH_CHECKING);
  if (renderStatus) setStatus(t("checkingApi"), "info");

  const balanceResult = await fetchAccessSnapshot("/balance", context);
  if (balanceResult.ok) {
    updateTokensBadge(balanceResult.snapshot.renderTokens);
  } else {
    updateTokensBadge(null);
  }
  const planResult = await fetchAccessSnapshot("/my_plan", context);
  const errors = [balanceResult, planResult].filter((result) => !result.ok);
  const authError = errors.find(isAuthRelatedAccessError);

  if (authError && allowAutoRetry && !authAutoRetryUsed) {
    authAutoRetryUsed = true;
    console.info("[access] automatic retry scheduled", {
      backendErrorCode: authError.errorCode || "",
    });
    await new Promise((resolve) => setTimeout(resolve, SESSION_AUTH_RETRY_DELAY_MS));
    return runTelegramAuthCheck({ allowAutoRetry: false, renderStatus, manualRetry: true });
  }

  if (authError) {
    const state = uiStateForSessionError(authError.errorCode);
    const result = {
      state,
      reason: "auth_failed",
      errorCode: authError.errorCode,
      errors,
    };
    lastAuthCheckResult = result;
    setAccessUiState(state, { errorCode: authError.errorCode });
    if (renderStatus) setRetryableAuthStatus(accessMessageForErrorCode(authError.errorCode), authError.errorCode);
    return result;
  }

  if (balanceResult.ok && planResult.ok) {
    const result = {
      state: ACCESS_UI_STATES.FULL_VERIFIED,
      source: "/balance+/my_plan",
      balance: balanceResult,
      plan: planResult,
    };
    lastAuthCheckResult = result;
    setAccessUiState(ACCESS_UI_STATES.FULL_VERIFIED);
    if (renderStatus) hideStatus();
    loadRenderHistory({ silent: true });
    loadPresetFavorites({ silent: true });
    return result;
  }

  const result = {
    state: accessUiState,
    reason: errors.some((error) => error.apiError) ? "api_error" : "business_or_unverified",
    balance: balanceResult,
    plan: planResult,
    errors,
  };
  lastAuthCheckResult = result;
  if (renderStatus && result.reason === "api_error") {
    setStatus(apiErrorMessage(errors.find((error) => error.apiError)?.apiError), "error");
  } else if (renderStatus) {
    hideStatus();
  }
  console.warn("[access] preflight ended without auth state change", {
    errors: errors.map((error) => ({ path: error.path, status: error.status, errorCode: error.errorCode || "" })),
  });
  return result;
}

function buildSessionAuthHeaders() {
  if (!miniappSessionToken) {
    console.warn("[access] session_token is missing; Authorization header will not be sent");
    return {};
  }

  console.debug("[access] sending Authorization bearer token:", {
    sessionTokenPresent: true,
  });
  return { Authorization: `Bearer ${miniappSessionToken}` };
}

function appendTelegramContextToFormData(formData, context = buildTelegramUserContext()) {
  formData.append("user_id", context.user_id);
  if (context.init_data) formData.append("init_data", context.init_data);
  formData.append("platform", context.platform);
  if (context.username) formData.append("username", context.username);
  if (context.first_name) formData.append("first_name", context.first_name);
  if (context.language_code) formData.append("language_code", context.language_code);
}

function appendTelegramContextToUrl(url, context = buildTelegramUserContext()) {
  if (context.user_id) url.searchParams.set("user_id", context.user_id);
  if (context.platform) url.searchParams.set("platform", context.platform);
  if (context.username) url.searchParams.set("username", context.username);
  if (context.first_name) url.searchParams.set("first_name", context.first_name);
  if (context.language_code) url.searchParams.set("language_code", context.language_code);
  return url;
}

/* Background dim UI */
function updateBackgroundDimUi() {
  const hasBackground = Boolean(backgroundFileInput?.files?.[0]);
  const dimValue = backgroundDimInput.value;

  if (backgroundDimValue) backgroundDimValue.textContent = `${dimValue}%`;
  if (backgroundDimPreview) backgroundDimPreview.textContent = `${dimValue}%`;
  if (backgroundDimSummaryValue) backgroundDimSummaryValue.textContent = `${dimValue}%`;

  if (backgroundControls) backgroundControls.style.display = hasBackground ? "flex" : "none";
  if (removeBackgroundButton) removeBackgroundButton.disabled = !hasBackground;
  if (backgroundDimSummary) backgroundDimSummary.style.display = hasBackground ? "flex" : "none";
  if (customBackgroundInfo) customBackgroundInfo.classList.toggle("hidden", !hasBackground);

  if (!hasBackground) isDimPanelOpen = false;
  if (backgroundDimPanel) backgroundDimPanel.classList.toggle("show", hasBackground && isDimPanelOpen);
}

function clearSelectedBackground() {
  if (backgroundFileInput) backgroundFileInput.value = "";
  if (backgroundDimInput) backgroundDimInput.value = "35";
  isDimPanelOpen = false;
  updateBackgroundDimUi();
}

/* Colors */
function normalizeHexColor(value, fallback) {
  if (!value) return fallback;
  let color = String(value).trim();

  if (!color.startsWith("#")) color = `#${color}`;

  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }

  return fallback;
}

function updateColorControlAppearance(colorInput, textInput, colorValue) {
  if (colorInput) colorInput.value = colorValue;
  if (textInput) {
    textInput.value = colorValue;
    textInput.style.borderColor = colorValue;
    textInput.style.boxShadow = `0 0 0 1px ${colorValue}33`;
  }
}

function syncColorInputs(colorInput, textInput, fallback) {
  const sourceValue = textInput?.value?.trim() || colorInput?.value || fallback;
  const normalized = normalizeHexColor(sourceValue, fallback);
  updateColorControlAppearance(colorInput, textInput, normalized);
  return normalized;
}

function bindColorPair(colorInput, textInput, fallback) {
  if (!colorInput || !textInput) return;

  colorInput.addEventListener("input", () => {
    const normalized = normalizeHexColor(colorInput.value, fallback);
    updateColorControlAppearance(colorInput, textInput, normalized);
    restartPreviewLoop();
  });

  textInput.addEventListener("input", () => {
    const raw = textInput.value.trim();
    if (/^#?[0-9a-fA-F]{3}$/.test(raw) || /^#?[0-9a-fA-F]{6}$/.test(raw)) {
      const normalized = normalizeHexColor(raw, fallback);
      updateColorControlAppearance(colorInput, textInput, normalized);
      restartPreviewLoop();
    }
  });

  textInput.addEventListener("blur", () => {
    const normalized = normalizeHexColor(textInput.value, fallback);
    updateColorControlAppearance(colorInput, textInput, normalized);
    restartPreviewLoop();
  });
}

/* Utils */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatStatusHtml(message) {
  return escapeHtml(message).replaceAll("\n", "<br>");
}

function extractErrorMessage(payload, fallback = "Request failed.") {
  if (!payload) return fallback;

  if (typeof payload === "string") return payload;

  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  if (payload.error && typeof payload.error === "object") {
    if (typeof payload.error.message === "string" && payload.error.message.trim()) return payload.error.message;
    if (typeof payload.error.code === "string" && payload.error.code.trim()) return payload.error.code;
  }
  if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail;
  if (typeof payload.user_message === "string" && payload.user_message.trim()) return payload.user_message;
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message;

  if (Array.isArray(payload.detail)) {
    const lines = payload.detail.map((item) => {
      if (!item || typeof item !== "object") return String(item);
      const loc = Array.isArray(item.loc) ? item.loc.join(" → ") : "field";
      const msg = item.msg || "invalid value";
      return `${loc}: ${msg}`;
    });
    return lines.join("\n");
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch (_) {
    return fallback;
  }
}

function maskSensitiveValue(value) {
  const text = String(value || "");
  if (!text) return "";
  return text.length <= 6 ? `${text.slice(0, 2)}***` : `${text.slice(0, 6)}***`;
}

function sanitizeUrlForLog(value) {
  try {
    const url = new URL(String(value), window.location.href);
    if (url.searchParams.has(SESSION_TOKEN_PARAM)) {
      url.searchParams.set(SESSION_TOKEN_PARAM, maskSensitiveValue(url.searchParams.get(SESSION_TOKEN_PARAM)));
    }
    return url.toString();
  } catch (_) {
    return String(value || "").replace(/(session_token=)([^&]+)/gi, (_, prefix, token) => `${prefix}${maskSensitiveValue(token)}`);
  }
}

function sanitizeHeadersForLog(headers = {}) {
  const result = {};
  const source = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  Object.entries(source || {}).forEach(([key, value]) => {
    if (String(key).toLowerCase() === "authorization") {
      const token = String(value || "").replace(/^Bearer\s+/i, "");
      result[key] = token ? `Bearer ${maskSensitiveValue(token)}` : "";
    } else {
      result[key] = value;
    }
  });
  return result;
}

function sanitizePayloadForLog(value, depth = 0) {
  if (depth > 5) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (value instanceof FormData) return "[FormData]";
  if (value instanceof Blob) return `[Blob ${value.type || "unknown"} ${value.size || 0} bytes]`;
  if (Array.isArray(value)) return value.map((item) => sanitizePayloadForLog(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const lowerKey = String(key).toLowerCase();
      if (lowerKey.includes("token") || lowerKey === "authorization") {
        return [key, maskSensitiveValue(item)];
      }
      return [key, sanitizePayloadForLog(item, depth + 1)];
    })
  );
}

function safeResponseSnippet(payload) {
  const message = extractErrorMessage(payload, "");
  return message ? message.replace(/\s+/g, " ").trim().slice(0, 220) : "";
}

function isCorsOrMixedContentError(error, url) {
  const message = String(error?.message || "").toLowerCase();
  const targetUrl = String(url || "");
  const currentProtocol = window.location?.protocol || "";
  const targetIsHttp = /^http:\/\//i.test(targetUrl);
  return (
    (currentProtocol === "https:" && targetIsHttp) ||
    message.includes("cors") ||
    message.includes("cross-origin") ||
    message.includes("mixed content") ||
    message.includes("blocked by cors") ||
    message.includes("blocked a frame") ||
    message.includes("has been blocked")
  );
}

function normalizeApiError({ url, options = {}, response = null, payload = null, error = null, fallback = "" } = {}) {
  const status = response?.status || error?.status || null;
  const errorCode = getBackendErrorCode(payload) || error?.errorCode || "";
  const rawMessage = error?.message || safeResponseSnippet(payload) || fallback || t("networkError");
  const method = options?.method || "GET";
  const type = status ? "http" : (isCorsOrMixedContentError(error, url) ? "cors_mixed_content" : "network");

  let userMessage;
  if (status === 401 || AUTH_ERROR_CODES.has(errorCode)) {
    const authText = AUTH_ERROR_CODES.has(errorCode)
      ? accessMessageForErrorCode(errorCode)
      : (safeResponseSnippet(payload) || accessAuthFailedMessage());
    userMessage = `${t("authError")}: ${authText}`;
  } else if (!status && type === "cors_mixed_content") {
    userMessage = t("corsOrMixedContent");
  } else if (!status) {
    userMessage = t("networkUnavailable");
  } else if (status >= 500) {
    userMessage = `${t("serverError")}: ${status}${safeResponseSnippet(payload) ? ` ${safeResponseSnippet(payload)}` : ""}`;
  } else {
    userMessage = `${t("serverError")}: ${status}${safeResponseSnippet(payload) ? ` ${safeResponseSnippet(payload)}` : ""}`;
  }

  return {
    type,
    url: sanitizeUrlForLog(url),
    method,
    status,
    errorCode,
    message: rawMessage,
    userMessage,
    payload: sanitizePayloadForLog(payload),
  };
}

function logApiError(scope, details) {
  console.error(scope, {
    type: details.type,
    url: details.url,
    method: details.method,
    headers: details.headers,
    status: details.status,
    errorCode: details.errorCode,
    message: details.message,
    payload: details.payload,
  });
}

function apiErrorMessage(details) {
  return details?.userMessage || t("networkError");
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timerId));
}

async function fetchJson(url, options = {}, timeoutMs = 30000) {
  let response;
  try {
    response = await withTimeout(fetch(url, options), timeoutMs, t("requestTimeout"));
  } catch (error) {
    const details = normalizeApiError({ url, options, error, fallback: t("networkError") });
    details.headers = sanitizeHeadersForLog(options.headers);
    error.apiError = details;
    logApiError("[api] request failed", {
      ...details,
      headers: sanitizeHeadersForLog(options.headers),
    });
    throw error;
  }
  const contentType = response.headers.get("content-type") || "";

  let payload = null;
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text ? { detail: text } : null;
  }

  if (!response.ok) {
    const details = normalizeApiError({ url, options, response, payload });
    details.headers = sanitizeHeadersForLog(options.headers);
    logApiError("[api] response failed", details);
  }

  return { response, payload };
}

function getAudioDurationSeconds(file) {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    let finished = false;

    function cleanup(value) {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      resolve(value);
    }

    audio.preload = "metadata";
    audio.onloadedmetadata = () => cleanup(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => cleanup(0);
    audio.src = url;
    window.setTimeout(() => cleanup(0), 5000);
  });
}

function sortPresetsFavoritesFirst(list) {
  const items = Array.isArray(list) ? list : [];
  return items.slice().sort((a, b) => {
    const aFav = favoritePresetKeys.has(a.key) ? 0 : 1;
    const bFav = favoritePresetKeys.has(b.key) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return milkPresets.findIndex((preset) => preset.key === a.key) - milkPresets.findIndex((preset) => preset.key === b.key);
  });
}

function favoritePresetsInCatalogOrder() {
  return milkPresets.filter((preset) => favoritePresetKeys.has(preset.key));
}

function buildDefaultVisiblePresets() {
  const favorites = favoritePresetsInCatalogOrder();
  const favoriteKeys = new Set(favorites.map((preset) => preset.key));
  const randomRest = shuffleArray(milkPresets.filter((preset) => !favoriteKeys.has(preset.key)));
  return [...favorites, ...randomRest].slice(0, Math.max(6, favorites.length));
}

async function loadPresetFavorites({ silent = true } = {}) {
  if (!miniappSessionToken) {
    favoritePresetKeys = new Set();
    renderMilkPresets(visibleMilkPresets);
    return;
  }

  try {
    const { response, payload } = await fetchJson(
      `${API_BASE_URL}/presets/favorites`,
      { method: "GET", headers: buildSessionAuthHeaders() },
      15000
    );
    if (!response.ok || !Array.isArray(payload?.items)) {
      if (!silent) {
        console.warn("Preset favorites unavailable", normalizeApiError({
          url: `${API_BASE_URL}/presets/favorites`,
          options: { method: "GET", headers: buildSessionAuthHeaders() },
          response,
          payload,
        }));
      }
      return;
    }
    favoritePresetKeys = new Set(payload.items.filter((key) => milkPresets.some((preset) => preset.key === key)));
    visibleMilkPresets = sortPresetsFavoritesFirst(visibleMilkPresets);
    renderMilkPresets(visibleMilkPresets);
  } catch (error) {
    if (!silent) console.warn("Preset favorites unavailable", error?.apiError || error);
  }
}

async function togglePresetFavorite(presetKey, button) {
  if (!miniappSessionToken || pendingFavoriteToggles.has(presetKey)) return;
  pendingFavoriteToggles.add(presetKey);
  if (button) button.disabled = true;

  try {
    const { response, payload } = await fetchJson(
      `${API_BASE_URL}/presets/favorites/toggle`,
      {
        method: "POST",
        headers: { ...buildSessionAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ preset_key: presetKey }),
      },
      15000
    );
    if (!response.ok || payload?.ok !== true) {
      console.warn("Preset favorite toggle unavailable", normalizeApiError({
        url: `${API_BASE_URL}/presets/favorites/toggle`,
        options: { method: "POST", headers: { ...buildSessionAuthHeaders(), "Content-Type": "application/json" } },
        response,
        payload,
      }));
      return;
    }
    if (payload.is_favorite) favoritePresetKeys.add(payload.preset_key || presetKey);
    else favoritePresetKeys.delete(payload.preset_key || presetKey);
    visibleMilkPresets = sortPresetsFavoritesFirst(visibleMilkPresets);
    renderMilkPresets(visibleMilkPresets);
  } catch (error) {
    console.warn("Preset favorite toggle unavailable", error?.apiError || error);
    // Quiet fallback: favorites are optional UX, catalog must keep working.
  } finally {
    pendingFavoriteToggles.delete(presetKey);
    if (button) button.disabled = false;
  }
}
/* Milk presets UI */
function renderMilkPresets(list) {
  const sortedList = sortPresetsFavoritesFirst(list);
  milkPresetGrid.innerHTML = "";

  if (!sortedList.length) {
    milkPresetGrid.innerHTML = `<div class="hint">${currentLang === "ru" ? "Ничего не найдено." : "Nothing found."}</div>`;
    return;
  }

  sortedList.forEach((preset) => {
    const isFavorite = favoritePresetKeys.has(preset.key);
    const card = document.createElement("div");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.className = `preset-card ${milkPresetInput.value === preset.key ? "active" : ""}`;
    card.innerHTML = `
      <button class="favorite-toggle ${isFavorite ? "active" : ""}" type="button" aria-label="${escapeHtml(t(isFavorite ? "unfavoritePreset" : "favoritePreset"))}" title="${escapeHtml(t(isFavorite ? "unfavoritePreset" : "favoritePreset"))}">${isFavorite ? "★" : "☆"}</button>
      <canvas class="preset-preview" width="520" height="220" data-preview-family="${preset.family}"></canvas>
      <div class="preset-name">${escapeHtml(preset.name)}</div>
      <div class="preset-meta">${escapeHtml(preset.family)}</div>
      <p class="preset-desc">${escapeHtml(preset.desc)}</p>
    `;

    const selectPreset = () => {
      milkPresetInput.value = preset.key;
      renderMilkPresets(sortedList);
      restartPreviewLoop();
    };

    card.addEventListener("click", selectPreset);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPreset();
      }
    });

    const favoriteButton = card.querySelector(".favorite-toggle");
    favoriteButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePresetFavorite(preset.key, favoriteButton);
    });

    milkPresetGrid.appendChild(card);
  });

  visibleMilkPresets = sortedList;
  restartPreviewLoop();
}

function refreshMilkRandom() {
  const shuffled = buildDefaultVisiblePresets();
  visibleMilkPresets = shuffled;

  if (!shuffled.find((x) => x.key === milkPresetInput.value)) {
    milkPresetInput.value = shuffled[0]?.key || "neon_mandala";
  }

  renderMilkPresets(shuffled);
}
function filterMilkPresets() {
  const query = milkSearchInput.value.trim().toLowerCase();

  if (!query) {
    renderMilkPresets(visibleMilkPresets);
    return;
  }

  const filtered = milkPresets.filter((preset) =>
    preset.name.toLowerCase().includes(query) ||
    preset.key.toLowerCase().includes(query) ||
    preset.family.toLowerCase().includes(query)
  );

  if (filtered.length && !filtered.find((x) => x.key === milkPresetInput.value)) {
    milkPresetInput.value = filtered[0].key;
  }

  renderMilkPresets(sortPresetsFavoritesFirst(filtered));
}

function updateEngineUi() {
  if (engineSelect) engineSelect.value = "milk";
  if (styleField) styleField.style.display = "none";
  if (milkPanel) milkPanel.classList.add("show");

  if (!visibleMilkPresets.length) refreshMilkRandom();
  restartPreviewLoop();
}

/* Render history */
function presetDisplayName(key) {
  return milkPresets.find((preset) => preset.key === key)?.name || key || "Preset";
}

function formatHistoryDate(value) {
  if (!value) return "";
  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(currentLang === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeHistoryStatus(item) {
  const renderStatus = String(item?.render_status || item?.status || "queued").toLowerCase();
  const deliveryStatus = String(item?.delivery_status || "").toLowerCase();
  const telegramDelivery = String(item?.telegram_delivery || "").toLowerCase();
  if (renderStatus === "done" && (deliveryStatus === "failed" || telegramDelivery === "failed")) return "delivery_failed";
  if (renderStatus === "done" && (deliveryStatus === "pending" || telegramDelivery === "pending")) return "sending";
  if (["sending_to_telegram", "sending", "delivery_pending"].includes(renderStatus)) return "sending";
  if (["processing", "rendering"].includes(renderStatus)) return "rendering";
  if (["finalizing", "muxing"].includes(renderStatus)) return "finalizing";
  if (["done", "delivered"].includes(renderStatus)) return "done";
  if (["failed", "render_failed", "render_timeout"].includes(renderStatus)) return "failed";
  return "queued";
}

function historyStatusLabel(statusKey) {
  const labels = {
    queued: t("statusQueued"),
    rendering: t("statusRendering"),
    finalizing: t("statusFinalizing"),
    sending: t("statusSending"),
    done: t("statusDone"),
    failed: t("statusFailed"),
    delivery_failed: t("statusDeliveryFailed"),
  };
  return labels[statusKey] || t("statusQueued");
}

function historyModeLabel(mode) {
  const normalized = String(mode || "demo").toLowerCase();
  return normalized === "full" ? t("modeFull") : t("modeDemo");
}

function ensurePresetVisible(presetKey) {
  const preset = milkPresets.find((item) => item.key === presetKey);
  if (!preset) return;
  if (!visibleMilkPresets.find((item) => item.key === presetKey)) {
    visibleMilkPresets = sortPresetsFavoritesFirst([preset, ...visibleMilkPresets]).slice(0, Math.max(6, visibleMilkPresets.length || 6));
  }
  renderMilkPresets(visibleMilkPresets);
}

function renderHistory(items) {
  if (!renderHistoryList) return;
  recentRenderHistory = Array.isArray(items) ? items : [];

  if (!recentRenderHistory.length) {
    renderHistoryList.innerHTML = `<div class="history-note">${escapeHtml(t("historyEmpty"))}</div>`;
    return;
  }

  renderHistoryList.innerHTML = recentRenderHistory.map((item, index) => {
    const preset = item.preset || item.style || item.reuse_settings?.milk_preset || "neon_mandala";
    const mode = String(item.mode || item.reuse_settings?.mode || "demo").toLowerCase();
    const statusKey = normalizeHistoryStatus(item);
    const orientation = item.orientation || item.reuse_settings?.orientation || "portrait";
    const backgroundLabel = item.background_mode === "custom" ? t("backgroundCustom") : t("backgroundDefault");
    const canReuse = item.can_reuse_settings === true;
    const isRecoveryAction = statusKey === "failed" || statusKey === "delivery_failed";
    const actionLabel = isRecoveryAction ? t("retryWithSettings") : t("reuseSettings");
    const recoveryHint = isRecoveryAction && canReuse ? t("retryNeedsFiles") : "";
    const createdDate = formatHistoryDate(item.created_at);
    const updatedDate = formatHistoryDate(item.updated_at);
    const dateLabel = createdDate ? `${t("historyCreated")}: ${createdDate}` : (updatedDate ? `${t("historyUpdated")}: ${updatedDate}` : "");
    const modeLabel = historyModeLabel(mode);
    const statusLabel = historyStatusLabel(statusKey);
    const presetName = presetDisplayName(preset);
    return `
      <div class="history-item">
        <div class="history-main">
          <div class="history-copy">
            <div class="history-preset">${escapeHtml(presetName)}</div>
            <div class="history-meta">${escapeHtml([orientation, backgroundLabel].filter(Boolean).join(" · "))}</div>
            <div class="history-note">${escapeHtml(dateLabel)}</div>
            ${recoveryHint ? `<div class="history-note history-recovery-hint">${escapeHtml(recoveryHint)}</div>` : ""}
          </div>
          <div class="history-badges" aria-label="${escapeHtml(`${modeLabel}, ${statusLabel}`)}">
            <span class="history-chip history-chip-mode history-chip-${escapeHtml(mode)}">${escapeHtml(modeLabel)}</span>
            <span class="history-chip history-chip-status history-status-${escapeHtml(statusKey)}">${escapeHtml(statusLabel)}</span>
          </div>
        </div>
        ${canReuse ? `<div class="history-actions"><button class="history-reuse-button ${isRecoveryAction ? "history-retry-button" : ""}" type="button" data-history-index="${index}">${escapeHtml(actionLabel)}</button></div>` : ""}
      </div>
    `;
  }).join("");
}

async function loadRenderHistory({ silent = false } = {}) {
  if (!renderHistoryList) return;
  if (!miniappSessionToken) {
    renderHistory([]);
    return;
  }
  if (!silent) {
    renderHistoryList.innerHTML = `<div class="history-note">${escapeHtml(t("historyLoading"))}</div>`;
  }

  try {
    const { response, payload } = await fetchJson(
      `${API_BASE_URL}/renders/history?limit=10`,
      { method: "GET", headers: buildSessionAuthHeaders() },
      20000
    );
    if (!response.ok) {
      const apiError = normalizeApiError({
        url: `${API_BASE_URL}/renders/history?limit=10`,
        options: { method: "GET", headers: buildSessionAuthHeaders() },
        response,
        payload,
        fallback: t("historyUnavailable"),
      });
      if (!silent) renderHistoryList.innerHTML = `<div class="history-note">${escapeHtml(apiErrorMessage(apiError))}</div>`;
      return;
    }
    renderHistory(Array.isArray(payload) ? payload : []);
  } catch (error) {
    if (!silent) {
      const apiError = error?.apiError || normalizeApiError({
        url: `${API_BASE_URL}/renders/history?limit=10`,
        options: { method: "GET", headers: buildSessionAuthHeaders() },
        error,
        fallback: t("historyUnavailable"),
      });
      renderHistoryList.innerHTML = `<div class="history-note">${escapeHtml(apiErrorMessage(apiError))}</div>`;
    }
  }
}

function applyHistorySettings(item) {
  const settings = item?.reuse_settings || {};
  const preset = settings.milk_preset || settings.style || item?.preset || "neon_mandala";

  milkPresetInput.value = preset;
  ensurePresetVisible(preset);
  clearSelectedBackground();

  if (modeSelect && settings.mode) modeSelect.value = settings.mode;
  if (orientationSelect && settings.orientation) orientationSelect.value = settings.orientation;
  if (backgroundDimInput && settings.background_dim !== undefined) backgroundDimInput.value = String(settings.background_dim);
  if (customTextInput) customTextInput.value = settings.custom_text || "";
  if (settings.visualizer_color) updateColorControlAppearance(visualizerColorInput, visualizerColorText, settings.visualizer_color);
  if (settings.accent_color) updateColorControlAppearance(accentColorInput, accentColorText, settings.accent_color);

  updateCustomTextVisibility();
  updateBackgroundDimUi();
  restartPreviewLoop();

  const backgroundNote = item?.background_mode === "custom" ? `\n${t("chooseBackgroundAgain")}` : "";
  setStatus(`${t("settingsReused")}${backgroundNote}`, "info");
}
/* Preview rendering */
function previewRgba(hex, alpha) {
  const color = normalizeHexColor(hex, "#28c7e0").slice(1);
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const previewVariants = {
  mandala_bloom: { base: "neon_mandala", density: 1.45, scale: 1.10, speed: 0.78, shape: "" },
  tunnel_depth: { base: "bass_tunnel", density: 1.35, scale: 1.05, speed: 0.72, shape: "" },
  laser_burst: { base: "laser_fan", density: 1.48, scale: 1.05, speed: 1.15, shape: "" },
  plasma_shell: { base: "plasma_orb", density: 1.18, scale: 1.16, speed: 0.76, shape: "" },
  particle_crown: { base: "particle_fountain", density: 1.35, scale: 1.10, speed: 0.68, shape: "" },
  double_ring_echo: { base: "double_ring", density: 1.45, scale: 1.04, speed: 0.86, shape: "" },
  radial_burst: { base: "radial_bars", density: 1.38, scale: 1.02, speed: 1.05, shape: "" },
  orbital_storm: { base: "orbital_scope", density: 1.85, scale: 1.10, speed: 1.28, shape: "dense_orbit" },
  spectrum_wall: { base: "spectrogram_plus", density: 1.35, scale: 1.08, speed: 1.00, shape: "" },
};
function drawPreviewScene(ctx, family, width, height, tSec, primary, accent, active) {
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#050914");
  bg.addColorStop(1, "#101622");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const shortSide = Math.min(width, height);
  const variant = previewVariants[family] || {};
  const previewFamily = variant.base || family;
  const density = variant.density || 1;
  const scale = variant.scale || 1;
  const speed = variant.speed || 1;
  const shape = variant.shape || "";
  const amp = (active ? 1 : 0.82) * Math.min(scale, 1.18);
  const motionT = tSec * speed;
  const beat = (0.55 + 0.45 * Math.sin(motionT * 2.2)) * amp;
  const pulse = (0.5 + 0.5 * Math.sin(motionT * 3.7)) * amp;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.36);
  glow.addColorStop(0, previewRgba(accent, active ? 0.22 : 0.14));
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.76;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = active ? 3 : 2;
  ctx.shadowBlur = active ? 14 : 9;
  ctx.shadowColor = primary;
  ctx.strokeStyle = primary;
  ctx.fillStyle = primary;

  if (previewFamily === "ring") {
    const radius = shortSide * ((0.22 + beat * 0.018) * Math.min(scale, 1.10));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < Math.round(64 * density); i += 1) {
      const a = (Math.PI * 2 * i) / Math.round(64 * density);
      const energy = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tSec * 2.8 + i * 0.32));
      const inner = radius + 7;
      const outer = inner + shortSide * (0.04 + energy * 0.10) * amp;
      ctx.strokeStyle = i % 4 < 2 ? primary : accent;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    }
  } else if (previewFamily === "double_ring") {
    (density > 1.2 ? [0.15, 0.24, 0.34] : [0.17, 0.29]).forEach((ratio, idx) => {
      const r = shortSide * (ratio + Math.sin(tSec * (idx ? 1.4 : 2.1)) * 0.012 * amp);
      ctx.strokeStyle = idx ? accent : primary;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    const ringTicks = Math.round(64 * density);
    const tickBase = shortSide * (density > 1.2 ? 0.35 : 0.31);
    for (let i = 0; i < ringTicks; i += 1) {
      const a = (Math.PI * 2 * i) / ringTicks;
      const energy = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(motionT * 2.4 + i * 0.24));
      const outer = tickBase + shortSide * (0.035 + energy * 0.08) * amp;
      ctx.strokeStyle = i % 3 ? primary : accent;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * tickBase, cy + Math.sin(a) * tickBase);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    }
    if (shape === "echo") {
      const ticks = Math.round(48 * density);
      for (let i = 0; i < ticks; i += 1) {
        const a = motionT * 0.18 + (Math.PI * 2 * i) / ticks;
        const inner = shortSide * 0.37;
        const outer = inner + shortSide * (i % 3 === 0 ? 0.055 : 0.032);
        ctx.strokeStyle = i % 2 ? previewRgba(accent, 0.82) : previewRgba(primary, 0.72);
        ctx.shadowColor = i % 2 ? accent : primary;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
        ctx.stroke();
      }
    }
  } else if (previewFamily === "radial_bars") {
    const bars = Math.round(72 * density);
    const base = shortSide * 0.16 * Math.min(scale, 1.08);
    for (let i = 0; i < bars; i += 1) {
      const a = (Math.PI * 2 * i) / bars;
      const energy = 0.30 + 0.70 * (0.5 + 0.5 * Math.sin(tSec * 3.0 + i * 0.37));
      const extra = shortSide * (0.08 + 0.18 * energy) * amp;
      ctx.strokeStyle = i % 3 ? primary : accent;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * base, cy + Math.sin(a) * base);
      ctx.lineTo(cx + Math.cos(a) * (base + extra), cy + Math.sin(a) * (base + extra));
      ctx.stroke();
    }
  } else if (previewFamily === "scope_line") {
    const yBase = cy + shortSide * 0.08;
    ctx.beginPath();
    for (let x = width * 0.08; x <= width * 0.92; x += 5) {
      const n = (x - width * 0.08) / (width * 0.84);
      const wave = Math.sin(n * Math.PI * 8 + tSec * 2.0) * 0.65 + Math.sin(n * Math.PI * 15 - tSec * 1.3) * 0.28;
      const y = yBase + wave * shortSide * 0.14 * amp;
      if (x <= width * 0.08) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = previewRgba(accent, 0.55);
    ctx.beginPath();
    ctx.moveTo(width * 0.08, yBase);
    ctx.lineTo(width * 0.92, yBase);
    ctx.stroke();
  } else if (previewFamily === "mirror_wave") {
    for (let side = -1; side <= 1; side += 2) {
      ctx.strokeStyle = side < 0 ? primary : accent;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      for (let x = width * 0.08; x <= width * 0.92; x += 5) {
        const n = x / width;
        const wave = Math.sin(n * Math.PI * 7 + tSec * 1.7) * 0.7 + Math.sin(n * Math.PI * 14 - tSec) * 0.25;
        const y = cy + side * (shortSide * 0.12 + wave * shortSide * 0.11 * amp);
        if (x <= width * 0.08) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (previewFamily === "center_bars") {
    const bars = 21;
    const spacing = width * 0.58 / bars;
    for (let i = 0; i < bars; i += 1) {
      const p = i / (bars - 1);
      const wave = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(tSec * 2.4 + i * 0.45));
      const h = shortSide * (0.06 + 0.23 * wave * amp);
      const x = cx - spacing * bars / 2 + i * spacing;
      ctx.fillStyle = p < 0.5 ? primary : accent;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(x, cy - h, Math.max(3, spacing * 0.55), h * 2);
    }
  } else if (previewFamily === "dark_tunnel") {
    for (let i = 8; i >= 0; i -= 1) {
      const depth = i / 8;
      const r = shortSide * (0.06 + depth * 0.38 + beat * 0.01);
      ctx.strokeStyle = i % 2 ? previewRgba(accent, 0.55 + depth * 0.35) : previewRgba(primary, 0.5 + depth * 0.35);
      ctx.shadowColor = i % 2 ? accent : primary;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (previewFamily === "pulse_core") {
    const core = shortSide * (0.06 + pulse * 0.025);
    for (let i = 4; i >= 0; i -= 1) {
      ctx.fillStyle = previewRgba(i % 2 ? accent : primary, 0.08 + i * 0.055);
      ctx.beginPath();
      ctx.arc(cx, cy, core * (1 + i * 1.15), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = primary;
    ctx.beginPath();
    ctx.arc(cx, cy, core * 2.6, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      const a = tSec * 0.65 + i * Math.PI / 2;
      ctx.strokeStyle = i % 2 ? accent : primary;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * core * 3.2, cy + Math.sin(a) * core * 3.2);
      ctx.lineTo(cx + Math.cos(a) * core * 5.0, cy + Math.sin(a) * core * 5.0);
      ctx.stroke();
    }
  } else if (previewFamily === "neon_mandala") {
    for (let layer = 0; layer < 3; layer += 1) {
      const points = Math.round((10 + layer * 6) * density);
      const base = shortSide * (0.14 + layer * 0.08) * Math.min(scale, 1.12);
      ctx.strokeStyle = layer % 2 ? accent : primary;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      for (let i = 0; i <= points; i += 1) {
        const a = (Math.PI * 2 * i) / points + motionT * 0.32 * (layer + 1);
        const r = base + Math.sin(i * 2 + tSec * 2.2) * shortSide * 0.035 * amp;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    if (shape === "bloom") {
      const petals = 18;
      const petalR = shortSide * 0.40;
      for (let i = 0; i < petals; i += 1) {
        const a = motionT * 0.20 + (Math.PI * 2 * i) / petals;
        const x = cx + Math.cos(a) * petalR;
        const y = cy + Math.sin(a) * petalR;
        ctx.fillStyle = i % 2 ? previewRgba(accent, 0.72) : previewRgba(primary, 0.62);
        ctx.shadowColor = i % 2 ? accent : primary;
        ctx.beginPath();
        ctx.arc(x, y, shortSide * 0.015 * amp, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (previewFamily === "laser_fan") {
    const originY = height * 0.88;
    const beams = Math.round(26 * density);
    for (let i = 0; i < beams; i += 1) {
      const a = -Math.PI * 0.90 + (Math.PI * 1.8 * i) / Math.max(1, beams - 1);
      const energy = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(tSec * 4.2 + i * 0.61));
      const len = shortSide * (0.24 + 0.32 * energy) * amp * Math.min(scale, 1.18);
      ctx.strokeStyle = i % 2 ? accent : primary;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(cx, originY);
      ctx.lineTo(cx + Math.cos(a) * len, originY + Math.sin(a) * len);
      ctx.stroke();
    }
  } else if (previewFamily === "bass_tunnel") {
    const rings = Math.round(8 * density);
    for (let i = rings; i >= 0; i -= 1) {
      const depth = i / Math.max(1, rings);
      const r = shortSide * (0.07 + depth * 0.36 + beat * 0.012);
      const twist = motionT * 0.45 + i * 0.36;
      ctx.strokeStyle = i % 2 ? previewRgba(accent, 0.42 + depth * 0.42) : previewRgba(primary, 0.46 + depth * 0.38);
      ctx.shadowColor = i % 2 ? accent : primary;
      for (let arc = 0; arc < 5; arc += 1) {
        const start = twist + arc * Math.PI * 0.40;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + Math.PI * (0.16 + depth * 0.10));
        ctx.stroke();
      }
    }
    const lanes = Math.round(26 * density);
    for (let i = 0; i < lanes; i += 1) {
      const a = motionT * 0.30 + (Math.PI * 2 * i) / lanes;
      const inner = shortSide * 0.08;
      const outer = shortSide * (0.32 + 0.18 * (0.5 + 0.5 * Math.sin(motionT * 1.6 + i)));
      ctx.strokeStyle = i % 2 ? primary : accent;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    }
  } else if (previewFamily === "plasma_orb") {
    const r = shortSide * (0.13 + pulse * 0.035) * Math.min(scale, 1.24);
    const plasma = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
    plasma.addColorStop(0, previewRgba(primary, 0.95));
    plasma.addColorStop(0.42, previewRgba(accent, 0.72));
    plasma.addColorStop(1, "transparent");
    ctx.fillStyle = plasma;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.55, 0, Math.PI * 2);
    ctx.stroke();
    if (shape === "shell") {
      ctx.strokeStyle = previewRgba(primary, 0.72);
      ctx.shadowColor = primary;
      [1.95, 2.35].forEach((ratio, idx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * ratio, Math.PI * (0.12 + idx * 0.12), Math.PI * (1.88 - idx * 0.12));
        ctx.stroke();
      });
    }
  } else if (previewFamily === "horizon_wave") {
    const yBase = cy + shortSide * 0.08;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = yBase + Math.sin(x * 0.025 + tSec * 2.0) * shortSide * 0.09 * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = previewRgba(primary, 0.15);
    ctx.fill();
  } else if (previewFamily === "spectrogram_plus") {
    const cols = Math.round(56 * density);
    const colW = width / cols;
    const wallBase = height * 0.92;
    for (let i = 0; i < cols; i += 1) {
      const energy = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(motionT * 3.2 + i * 0.42));
      const h = shortSide * (0.10 + 0.36 * energy) * amp * Math.min(scale, 1.22);
      const grad = ctx.createLinearGradient(0, wallBase, 0, wallBase - h);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, primary);
      ctx.fillStyle = grad;
      const y = wallBase - h;
      ctx.fillRect(i * colW + 1, y, Math.max(colW - 2, 3), h);
    }
  } else if (previewFamily === "orbital_scope") {
    const r = shortSide * (0.21 + beat * 0.012) * Math.min(scale, 1.12);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < Math.round(16 * density); i += 1) {
      const a = motionT * 0.9 + (Math.PI * 2 * i) / Math.round(16 * density);
      const orbit = r * (1.25 + 0.18 * Math.sin(tSec * 0.8 + i));
      const size = 3 + pulse * 3;
      ctx.fillStyle = i % 2 ? accent : primary;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * orbit, cy + Math.sin(a) * orbit, size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 5; i += 1) {
      const a = motionT * 0.35 + i * 0.66;
      ctx.strokeStyle = previewRgba(accent, 0.52);
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1.14 + i * 0.02), a, a + Math.PI * 0.26);
      ctx.stroke();
    }
  } else if (previewFamily === "spiral_beam") {
    const arms = 4;
    for (let arm = 0; arm < arms; arm += 1) {
      for (let step = 0; step < 18; step += 1) {
        const frac = step / 17;
        const a = tSec * 0.75 + arm * Math.PI * 2 / arms + frac * Math.PI * 2.6;
        const r = shortSide * frac * (0.08 + 0.34 * amp);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const size = Math.max(2, (1 - frac) * 6);
        ctx.fillStyle = arm % 2 ? accent : primary;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (previewFamily === "particle_fountain") {
    const baseY = height * 0.66;
    const ribbons = shape === "crown" ? 7 : 5;
    for (let ribbon = 0; ribbon < ribbons; ribbon += 1) {
      const side = ribbon - (ribbons - 1) / 2;
      const sideNorm = side / Math.max(1, (ribbons - 1) / 2);
      ctx.strokeStyle = ribbon % 2 ? previewRgba(accent, 0.70) : previewRgba(primary, 0.66);
      ctx.shadowColor = ribbon % 2 ? accent : primary;
      ctx.beginPath();
      for (let step = 0; step <= 18; step += 1) {
        const q = step / 18;
        const bend = Math.sin(q * Math.PI + motionT * 0.7 + ribbon * 0.9);
        const x = cx + sideNorm * width * (0.06 + Math.sin(q * Math.PI) * 0.22) + bend * width * 0.018;
        const y = baseY - q * height * (0.24 + 0.05 * Math.abs(sideNorm));
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < Math.round(78 * density); i += 1) {
      const phase = (i * 0.137 + motionT * 0.10) % 1;
      const spread = ((i % 18) - 8.5) / 8.5;
      const x = cx + spread * width * 0.28 * Math.min(scale, 1.18) + Math.sin(motionT * 1.6 + i) * shortSide * 0.025;
      const y = baseY - phase * height * 0.62 * Math.min(scale, 1.15);
      const size = 2 + 4 * (1 - phase) * amp;
      ctx.fillStyle = i % 2 ? accent : primary;
      ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, baseY, shortSide * (0.13 + beat * 0.015), Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}
function restartPreviewLoop() {
  if (previewAnimationId) {
    cancelAnimationFrame(previewAnimationId);
    previewAnimationId = null;
  }

  const canvases = Array.from(document.querySelectorAll(".preset-preview"));
  if (!canvases.length) return;

  const primary = syncColorInputs(visualizerColorInput, visualizerColorText, "#28c7e0");
  const accent = syncColorInputs(accentColorInput, accentColorText, "#7c4dff");

  const tick = (ts) => {
    const tSec = ts / 1000;

    canvases.forEach((canvas) => {
      const ctx = canvas.getContext("2d");
      const family = canvas.dataset.previewFamily || "ring";
      const isActive = canvas.closest(".preset-card")?.classList.contains("active");
      drawPreviewScene(ctx, family, canvas.width, canvas.height, tSec, primary, accent, isActive);
    });

    previewAnimationId = requestAnimationFrame(tick);
  };

  previewAnimationId = requestAnimationFrame(tick);
}

/* Custom text */
function updateCustomTextVisibility() {
  if (customTextField) {
    customTextField.style.display = modeSelect.value === "full" ? "block" : "none";
  }
}

/* API helpers */
async function checkHealth() {
  const url = `${API_BASE_URL}/`;
  const options = { method: "GET" };
  const { response, payload } = await fetchJson(url, options, 15000);
  if (!response.ok) {
    const apiError = normalizeApiError({ url, options, response, payload, fallback: t("healthFailed") });
    const error = new Error(apiErrorMessage(apiError));
    error.apiError = apiError;
    throw error;
  }
  return payload;
}

function buildDownloadUrl(downloadUrl) {
  if (!downloadUrl) return "";
  if (downloadUrl.startsWith("http://") || downloadUrl.startsWith("https://")) return downloadUrl;
  return `${API_BASE_URL}${downloadUrl}`;
}

function normalizeRenderStatus(payload) {
  const rawStatus =
    payload?.render_status ??
    payload?.status ??
    payload?.state ??
    payload?.result?.render_status ??
    payload?.result?.status ??
    payload?.result?.state ??
    "";
  const value = String(rawStatus).trim().toLowerCase();

  if (["done", "success", "succeeded", "complete", "completed"].includes(value)) return "done";
  if (["failed", "failure", "error", "revoked"].includes(value)) return "failed";
  if (["processing", "progress", "started", "running"].includes(value)) return "processing";
  if (["queued", "pending", "received", "retry"].includes(value)) return "queued";
  return value || "unknown";
}

function extractRenderProgress(payload) {
  const candidates = [
    payload?.percent,
    payload?.progress,
    payload?.meta?.percent,
    payload?.info?.percent,
    payload?.result?.percent,
    payload?.result?.progress,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const percent = Number(candidate);
    if (Number.isFinite(percent)) {
      return Math.max(0, Math.min(100, percent));
    }
  }

  return null;
}

function extractRenderStage(payload) {
  return String(
    payload?.stage ??
      payload?.render_stage ??
      payload?.result?.stage ??
      payload?.result?.render_stage ??
      ""
  ).trim().toLowerCase();
}

function formatApproxEta(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "";
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `~${hours}h ${rest}m` : `~${hours}h`;
}

function extractQueueInfo(payload) {
  const rawPosition = payload?.queue_position ?? payload?.result?.queue_position;
  const rawAhead = payload?.queue_size_ahead ?? payload?.result?.queue_size_ahead;
  const rawEta = payload?.eta_seconds ?? payload?.result?.eta_seconds;
  const position = rawPosition === null || rawPosition === undefined ? null : Number(rawPosition);
  const ahead = rawAhead === null || rawAhead === undefined ? null : Number(rawAhead);
  const eta = rawEta === null || rawEta === undefined ? null : Number(rawEta);
  return {
    queueName: payload?.queue_name ?? payload?.result?.queue_name ?? "",
    position: Number.isFinite(position) ? position : null,
    ahead: Number.isFinite(ahead) ? ahead : null,
    etaSeconds: Number.isFinite(eta) ? eta : null,
    note: payload?.queue_note ?? payload?.status_hint ?? payload?.result?.queue_note ?? "",
  };
}

function renderQueueHint(queueInfo) {
  if (!queueInfo) return "";
  const lines = [];
  if (queueInfo.position !== null && queueInfo.position > 0) {
    lines.push(`${t("queuePosition")}: ${queueInfo.position}`);
  } else if (queueInfo.position === 0) {
    lines.push(t("queueNext"));
  }
  const etaText = formatApproxEta(queueInfo.etaSeconds);
  if (etaText) lines.push(`${t("queueEta")}: ${etaText}`);
  if (queueInfo.note) lines.push(queueInfo.note);
  return lines.map((line) => escapeHtml(line)).join("\n");
}

function normalizeDeliveryStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["delivered", "sent", "success", "done"].includes(normalized)) return "delivered";
  if (["failed", "failure", "error", "delivery_failed"].includes(normalized)) return "failed";
  if (["pending", "sending", "queued", "processing"].includes(normalized)) return "pending";
  return "";
}

function extractDeliveryStatus(payload) {
  return normalizeDeliveryStatus(
    payload?.delivery_status ??
      payload?.telegram_delivery ??
      payload?.result?.delivery_status ??
      payload?.result?.telegram_delivery ??
      ""
  );
}

function extractDeliveryError(payload) {
  return (
    payload?.delivery_error ??
    payload?.telegram_delivery_error ??
    payload?.result?.delivery_error ??
    ""
  );
}

function extractDownloadUrl(payload, taskId) {
  const directUrl =
    payload?.download_url ??
    payload?.downloadUrl ??
    payload?.result?.download_url ??
    payload?.result?.downloadUrl ??
    "";
  if (directUrl) return buildDownloadUrl(String(directUrl));

  const resultFile = payload?.result_file ?? payload?.resultFile ?? payload?.result?.result_file ?? "";
  if (resultFile && taskId) return buildDownloadUrl(`/download/${taskId}`);

  return taskId ? buildDownloadUrl(`/download/${taskId}`) : "";
}

function renderDownloadFallback(url) {
  if (!url) return "";
  return `<br><a class="fallback-download" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${t("download")}</a>`;
}

function isTemporaryStatusError(value) {
  return [408, 429, 500, 502, 503, 504].includes(Number(value));
}

function transientStatusMessage(errorCount, percent) {
  return `${t("statusUnavailable")} Progress: ${percent}% (${errorCount})`;
}

/* Main upload/render */
async function uploadAndRender() {
  const file = audioFileInput.files?.[0];
  const backgroundFile = backgroundFileInput?.files?.[0] || null;

  if (!file) {
    setStatus(t("noFile"), "error");
    return;
  }

  initTelegramContext();

  const visualizerColor = syncColorInputs(visualizerColorInput, visualizerColorText, "#28c7e0");
  const accentColor = syncColorInputs(accentColorInput, accentColorText, "#7c4dff");

  if (!/^#[0-9a-f]{6}$/i.test(visualizerColor) || !/^#[0-9a-f]{6}$/i.test(accentColor)) {
    setStatus(t("invalidColor"), "error");
    return;
  }

  const engine = "milk";
  const style = milkPresetInput.value || "neon_mandala";
  const milkPreset = milkPresetInput.value || "neon_mandala";
  const mode = modeSelect.value || "demo";
  const orientation = orientationSelect.value || "landscape";
  const customText = customTextInput.value.trim();
  const backgroundDim = Number(backgroundDimInput.value || 35);
  let audioDurationSeconds = 0;
  let isLongFullTrack = false;

  try {
    renderButton.disabled = true;

    if (mode === "full") {
      audioDurationSeconds = await getAudioDurationSeconds(file);
      if (audioDurationSeconds > FULL_MAX_DURATION_SECONDS) {
        setStatus(t("fullDurationExceeded"), "error");
        return;
      }
      isLongFullTrack = audioDurationSeconds > LONG_FULL_TRACK_THRESHOLD_SECONDS;
    }

    setStatus(t("checkingApi"), "info");
    await checkHealth();

    if (mode === "full") {
      const accessResult = await verifyFullModeAccess();
      if (!accessResult.allowed) {
        console.warn("Full mode access preflight blocked render", accessResult);
        let message = fullAccessRequiredHtml();
        if (accessResult.reason === "no_telegram_context") {
          message = telegramContextRequiredMessage();
        } else if (accessResult.reason === "auth_failed") {
          message = accessMessageForErrorCode(accessResult.errorCode);
        } else if (accessResult.reason === "api_error") {
          message = accessResult.errors?.find((error) => error.apiError)?.apiError?.userMessage || t("networkUnavailable");
        } else if (accessResult.reason === "unverified") {
          message = accessVerificationFailedMessage();
        }

        setStatus(message, "error");
        return;
      }
      console.debug("Full mode access preflight passed", accessResult);
    }

    setStatus(t("uploading"), "info");

    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("engine", engine);
    formData.append("style", style);
    formData.append("milk_preset", milkPreset);
    formData.append("mode", mode);
    formData.append("orientation", orientation);
    formData.append("background_dim", String(backgroundDim));
    formData.append("visualizer_color", visualizerColor);
    formData.append("accent_color", accentColor);

    const telegramContext = buildTelegramUserContext();
    appendTelegramContextToFormData(formData, telegramContext);
    if (backgroundFile) formData.append("background_file", backgroundFile, backgroundFile.name);
    if (customText) formData.append("custom_text", customText);

    console.log("TMA debug", {
      platform: tg?.platform,
      initDataLength: telegramContext.init_data.length,
      userId: telegramContext.user_id || null,
      preset: milkPreset,
    });

    const uploadUrl = `${API_BASE_URL}/api/v1/render`;
    const uploadOptions = {
      method: "POST",
      headers: buildSessionAuthHeaders(),
      body: formData,
    };
    const { response: uploadResponse, payload: uploadData } = await fetchJson(
      uploadUrl,
      uploadOptions,
      120000
    );

    if (!uploadResponse.ok) {
      const uploadErrorCode = getBackendErrorCode(uploadData);
      const uploadApiError = normalizeApiError({
        url: uploadUrl,
        options: uploadOptions,
        response: uploadResponse,
        payload: uploadData,
        fallback: t("validationFailed"),
      });
      const errorMessage = AUTH_ERROR_CODES.has(uploadErrorCode)
        ? accessMessageForErrorCode(uploadErrorCode)
        : apiErrorMessage(uploadApiError);
      setStatus(formatStatusHtml(errorMessage), "error");
      console.error("TMA upload failed", uploadResponse.status, {
        backendErrorCode: uploadErrorCode,
        apiError: uploadApiError,
      });
      return;
    }

    const taskId = uploadData?.task_id;
    if (!taskId) {
      setStatus(t("badResponse"), "error");
      return;
    }

    const uploadMessage = uploadData?.message || t("readyTelegram");
    setStatus(isLongFullTrack ? `${uploadMessage}\n${t("longFullTrackNote")}` : uploadMessage, "info");

    let statusNetworkErrors = 0;
    let lastKnownPercent = 0;

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      let statusResponse;
      let statusData;

      try {
        const statusUrl = `${API_BASE_URL}/status/${taskId}`;
        const statusOptions = { method: "GET", headers: buildSessionAuthHeaders() };
        const statusResult = await fetchJson(
          statusUrl,
          statusOptions,
          30000
        );
        statusResponse = statusResult.response;
        statusData = statusResult.payload;
      } catch (error) {
        statusNetworkErrors += 1;
        const apiError = error?.apiError || normalizeApiError({
          url: `${API_BASE_URL}/status/${taskId}`,
          options: { method: "GET", headers: buildSessionAuthHeaders() },
          error,
          fallback: t("statusUnavailable"),
        });
        setStatus(`${apiErrorMessage(apiError)}\n${transientStatusMessage(statusNetworkErrors, lastKnownPercent)}`, "info");
        continue;
      }

      if (!statusResponse.ok) {
        const statusErrorCode = getBackendErrorCode(statusData);
        const authError = statusResponse.status === 401 || AUTH_ERROR_CODES.has(statusErrorCode);
        if (authError) {
          const authMessage = AUTH_ERROR_CODES.has(statusErrorCode)
            ? accessMessageForErrorCode(statusErrorCode)
            : accessAuthFailedMessage();
          setRetryableAuthStatus(authMessage, statusErrorCode);
          return;
        }

        if (isTemporaryStatusError(statusResponse.status)) {
          statusNetworkErrors += 1;
          const statusApiError = normalizeApiError({
            url: `${API_BASE_URL}/status/${taskId}`,
            options: { method: "GET", headers: buildSessionAuthHeaders() },
            response: statusResponse,
            payload: statusData,
            fallback: t("statusUnavailable"),
          });
          setStatus(`${apiErrorMessage(statusApiError)}\n${transientStatusMessage(statusNetworkErrors, lastKnownPercent)}`, "info");
          continue;
        }

        const statusApiError = normalizeApiError({
          url: `${API_BASE_URL}/status/${taskId}`,
          options: { method: "GET", headers: buildSessionAuthHeaders() },
          response: statusResponse,
          payload: statusData,
          fallback: t("statusUnavailable"),
        });
        const errorMessage = apiErrorMessage(statusApiError);
        setStatus(formatStatusHtml(errorMessage), "error");
        return;
      }

      statusNetworkErrors = 0;
      console.debug("[render] status poll response", {
        taskId,
        httpStatus: statusResponse.status,
        payload: statusData,
      });

      const renderStatus = normalizeRenderStatus(statusData);
      const deliveryStatus = extractDeliveryStatus(statusData);
      const renderStage = extractRenderStage(statusData);
      const receivedProgress = extractRenderProgress(statusData);
      const queueInfo = extractQueueInfo(statusData);
      const queueHint = renderQueueHint(queueInfo);
      console.debug("[render] received status=", renderStatus);
      console.debug("[render] received stage=", renderStage || "none");
      console.debug("[render] received delivery=", deliveryStatus || "none");
      console.debug("[render] received progress=", receivedProgress);

      if (receivedProgress !== null) {
        lastKnownPercent = receivedProgress;
      }

      if (renderStatus === "queued") {
        const base = queueHint ? `${t("queued")}\n${queueHint}` : t("queueWaiting");
        setStatus(isLongFullTrack ? `${base}\n${t("longFullTrackNote")}` : base, "info");
      } else if (
        renderStatus === "processing"
      ) {
        const percent = lastKnownPercent;
        const stageText = renderStage === "finalizing"
          ? t("finalizing")
          : renderStage === "sending_to_telegram"
            ? t("sendingTelegram")
            : t("processing");
        const progressText = `${stageText}${Number.isFinite(percent) ? ` — ${percent}%` : ""}`;
        setStatus(queueHint ? `${progressText}\n${queueHint}` : progressText, "info");
      } else if (renderStatus === "failed") {
        const errorText = extractErrorMessage(
          {
            error: statusData?.error,
            detail: statusData?.detail,
            user_message: statusData?.user_message,
            message: statusData?.message,
            result: statusData?.result,
          },
          t("failed")
        );
        console.debug("[render] render failed UI state entered", {
          taskId,
          errorText,
          payload: statusData,
        });
        setStatus(`${t("failed")}:\n${formatStatusHtml(errorText)}`, "error");
        return;
      } else if (renderStatus === "done") {
        lastKnownPercent = 100;
        const url = extractDownloadUrl(statusData, taskId);

        console.debug("[render] render completed UI state entered", {
          taskId,
          downloadUrl: url,
          deliveryStatus,
          payload: statusData,
        });

        if (deliveryStatus === "pending") {
          setStatus(t("sendingTelegram"), "info");
          continue;
        }

        if (deliveryStatus === "failed") {
          setStatus(`${t("deliveryFailed")}${renderDownloadFallback(url)}`, "success");
          loadRenderHistory({ silent: true });
          return;
        }

        setStatus(t("sentTelegram"), "success");
        loadRenderHistory({ silent: true });
        return;
      }
    }
  } catch (error) {
    const message = apiErrorMessage(error?.apiError) || error?.message || t("networkError");
    setStatus(formatStatusHtml(message), "error");
  } finally {
    renderButton.disabled = false;
  }
}

/* Reset */
function resetForm() {
  audioFileInput.value = "";
  clearSelectedBackground();

  if (engineSelect) engineSelect.value = "milk";
  if (styleField) styleField.style.display = "none";

  milkPresetInput.value = "neon_mandala";
  modeSelect.value = "demo";
  orientationSelect.value = "portrait";
  customTextInput.value = "";
  milkSearchInput.value = "";

  updateColorControlAppearance(visualizerColorInput, visualizerColorText, "#28c7e0");
  updateColorControlAppearance(accentColorInput, accentColorText, "#7c4dff");

  refreshMilkRandom();
  updateEngineUi();
  updateCustomTextVisibility();
  updateBackgroundDimUi();

  hideStatus();
  setStatus(t("resetDone"), "info");
  setTimeout(hideStatus, 2000);
}

/* Event bindings */
langToggle?.addEventListener("click", () => {
  currentLang = currentLang === "en" ? "ru" : "en";
  applyTranslations();
  renderMilkPresets(visibleMilkPresets);
  renderHistory(recentRenderHistory);
});

modeSelect.addEventListener("change", updateCustomTextVisibility);
openBotBuyButton?.addEventListener("click", openBotToBuyTokens);

removeBackgroundButton?.addEventListener("click", clearSelectedBackground);

backgroundFileInput.addEventListener("change", () => {
  if (!backgroundFileInput.files?.[0]) {
    isDimPanelOpen = false;
    backgroundDimInput.value = "35";
  }
  updateBackgroundDimUi();
});

toggleDimButton?.addEventListener("click", () => {
  isDimPanelOpen = !isDimPanelOpen;
  updateBackgroundDimUi();
});

backgroundDimInput?.addEventListener("input", updateBackgroundDimUi);
milkShuffleButton?.addEventListener("click", refreshMilkRandom);
milkSearchInput?.addEventListener("input", filterMilkPresets);

bindColorPair(visualizerColorInput, visualizerColorText, "#28c7e0");
bindColorPair(accentColorInput, accentColorText, "#7c4dff");

renderButton?.addEventListener("click", uploadAndRender);
resetButton?.addEventListener("click", resetForm);
historyRefreshButton?.addEventListener("click", () => loadRenderHistory());
renderHistoryList?.addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-history-index]");
  if (!button) return;
  const index = Number(button.dataset.historyIndex);
  if (!Number.isInteger(index)) return;
  applyHistorySettings(recentRenderHistory[index]);
});

/* Initial */
orientationSelect.value = "portrait";
initTelegramContext();
applyTranslations();
runTelegramAuthCheck({ allowAutoRetry: true, renderStatus: true });
updateColorControlAppearance(visualizerColorInput, visualizerColorText, "#28c7e0");
updateColorControlAppearance(accentColorInput, accentColorText, "#7c4dff");
refreshMilkRandom();
updateEngineUi();
updateCustomTextVisibility();
updateBackgroundDimUi();
loadRenderHistory();
