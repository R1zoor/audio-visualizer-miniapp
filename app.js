const API_BASE = "https://attorney-titanium-ward-summit.trycloudflare.com";

const tg = window.Telegram?.WebApp || null;
let userId = null;
let telegramInitData = "";

const audioFileInput = document.getElementById("audioFile");
const backgroundFileInput = document.getElementById("backgroundFile");
const backgroundControls = document.getElementById("backgroundControls");
const toggleDimButton = document.getElementById("toggleDimButton");
const backgroundDimPanel = document.getElementById("backgroundDimPanel");
const backgroundDimInput = document.getElementById("backgroundDim");
const backgroundDimValue = document.getElementById("backgroundDimValue");
const backgroundDimPreview = document.getElementById("backgroundDimPreview");
const backgroundDimSummary = document.getElementById("backgroundDimSummary");
const backgroundDimSummaryValue = document.getElementById("backgroundDimSummaryValue");

const engineSelect = document.getElementById("engine");
const styleField = document.getElementById("styleField");
const styleSelect = document.getElementById("style");
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

let currentLang = "en";
let isDimPanelOpen = false;
let visibleMilkPresets = [];
let previewAnimationId = null;
let lastTelegramDebug = null;

const milkPresets = [
  { key: "ring_neon", name: "Ring Neon", family: "ring", desc: "Single glowing ring with soft pulse." },
  { key: "double_ring", name: "Double Ring", family: "double_ring", desc: "Two layered circles with audio energy." },
  { key: "radial_bars", name: "Radial Bars", family: "radial_bars", desc: "Circular bars around a bright core." },
  { key: "scope_line", name: "Scope Line", family: "scope", desc: "Classic oscilloscope with bloom." },
  { key: "mirror_wave", name: "Mirror Wave", family: "mirror_wave", desc: "Mirrored waveform with center symmetry." },
  { key: "center_bars", name: "Center Bars", family: "center_bars", desc: "Bars rising from the middle line." },
  { key: "dark_tunnel", name: "Dark Tunnel", family: "tunnel", desc: "Tunnel-like depth and bass motion." },
  { key: "pulse_core", name: "Pulse Core", family: "pulse_core", desc: "Energy core with expanding audio pulse." },
  { key: "horizon_wave", name: "Horizon Wave", family: "horizon_wave", desc: "Wide cinematic horizon waveform." },
  { key: "spectrogram_plus", name: "Spectrogram Plus", family: "spectrogram_plus", desc: "Dense colorful spectral movement." },
  { key: "orbital_scope", name: "Orbital Scope", family: "orbital_scope", desc: "Circular scope orbit with rotating feel." },
  { key: "spiral_beam", name: "Spiral Beam", family: "spiral_beam", desc: "Spiral energy with dynamic lines." }
];

const i18n = {
  en: {
    badge: "● MP3/WAV → MP4 visualizer",
    title: "Create audio visualization in Telegram",
    subtitle: "Upload your track, choose style and mode. In demo you get a short preview with watermark, in full — complete MP4 without restrictions.",
    sectionTitle: "New Render",
    fileLabel: "Audio file",
    fileHint: "MP3 and WAV are supported.",
    backgroundLabel: "Background image / GIF / video",
    backgroundHint: "Optional. If empty, default dark background will be used.",
    toggleDimButton: "Adjust dimming",
    backgroundDimLabel: "Background dim",
    backgroundDimHint: "0% = original background, 100% = fully black.",
    engineLabel: "Engine",
    engineClassic: "Classic",
    engineMilk: "MILK",
    styleLabel: "Style",
    modeLabel: "Mode",
    orientationLabel: "Orientation",
    orientationPortrait: "Portrait (phone)",
    orientationLandscape: "Landscape",
    styleWaveLine: "Wave Line",
    styleWaveFilled: "Wave Filled",
    styleBars: "Bars",
    styleSpectrogram: "Spectrogram",
    modeDemo: "Demo",
    modeFull: "Full",
    milkHint: "Showing a few random presets. Search by name or shuffle to discover more.",
    shuffleButton: "Shuffle",
    visualizerColorLabel: "Visualizer color",
    visualizerColorHint: "Main color for wave, bars or core visualizer.",
    accentColorLabel: "Accent color",
    accentColorHint: "Secondary glow / accent color, especially useful for MILK.",
    summaryDemo: "Demo",
    summaryDemoDesc: "Up to 30 seconds + watermark",
    summaryFull: "Full",
    summaryFullDesc: "Full track without watermark",
    summaryBackgroundDim: "Background dim",
    renderButton: "Create Video",
    resetButton: "Reset",
    footerNote: "Rendering may take some time. Ready MP4 will be sent by bot directly into Telegram chat.",
    noFile: "Please select an audio file.",
    checkingApi: "Checking API availability...",
    uploading: "Uploading file...",
    queued: "Task queued. Waiting for processing...",
    processing: "Processing audio",
    doneChat: "Done! Ready MP4 has been sent to your Telegram chat.",
    failed: "Render failed",
    networkError: "Network error. Please check API_BASE, tunnel, and CORS.",
    badResponse: "Server returned an unexpected response.",
    healthFailed: "API health check failed.",
    resetDone: "Form reset.",
    telegramRequired: "Telegram context missing. Open Mini App from bot and check debug details below.",
    customTextLabel: "Title for full video",
    customTextHint: "Shown at the top center only in Full mode. Up to 80 characters.",
    invalidColor: "Invalid HEX color. Use format like #28c7e0.",
    debugTitle: "Telegram debug",
    tgDetected: "Telegram detected",
    webAppDetected: "WebApp detected",
    initDataPresent: "initData present",
    initDataLength: "initData length",
    userIdPresent: "userId present",
    userIdValue: "userId",
    platform: "platform",
    version: "version",
    colorScheme: "colorScheme"
  },
  ru: {
    badge: "● MP3/WAV → MP4 визуализатор",
    title: "Создай аудио-визуализацию прямо в Telegram",
    subtitle: "Загрузи трек, выбери стиль и режим. В demo ты получишь короткое превью с watermark, а в full — полный MP4 без ограничений.",
    sectionTitle: "Новый рендер",
    fileLabel: "Аудиофайл",
    fileHint: "Поддерживаются MP3 и WAV.",
    backgroundLabel: "Фон: картинка / GIF / видео",
    backgroundHint: "Необязательно. Если не выбрать, будет использован стандартный тёмный фон.",
    toggleDimButton: "Настроить затемнение",
    backgroundDimLabel: "Затемнение фона",
    backgroundDimHint: "0% = исходный фон, 100% = полностью чёрный.",
    engineLabel: "Движок",
    engineClassic: "Classic",
    engineMilk: "MILK",
    styleLabel: "Стиль",
    modeLabel: "Режим",
    orientationLabel: "Ориентация",
    orientationPortrait: "Портрет (телефон)",
    orientationLandscape: "Альбомная",
    styleWaveLine: "Линия волны",
    styleWaveFilled: "Заполненная волна",
    styleBars: "Столбцы",
    styleSpectrogram: "Спектрограмма",
    modeDemo: "Demo",
    modeFull: "Full",
    milkHint: "Показывается несколько случайных пресетов. Ищи по имени или перемешай список.",
    shuffleButton: "Перемешать",
    visualizerColorLabel: "Цвет визуализатора",
    visualizerColorHint: "Основной цвет волны, столбцов или центрального визуализатора.",
    accentColorLabel: "Акцентный цвет",
    accentColorHint: "Вторичный цвет свечения / акцента, особенно полезен для MILK.",
    summaryDemo: "Демо",
    summaryDemoDesc: "До 30 секунд + watermark",
    summaryFull: "Full",
    summaryFullDesc: "Полный трек без watermark",
    summaryBackgroundDim: "Затемнение фона",
    renderButton: "Создать видео",
    resetButton: "Сбросить",
    footerNote: "Рендер может занять время. Готовый MP4 бот отправит прямо в Telegram чат.",
    noFile: "Пожалуйста, выбери аудиофайл.",
    checkingApi: "Проверка доступности API...",
    uploading: "Загрузка файла...",
    queued: "Задача в очереди. Ожидание обработки...",
    processing: "Обработка аудио",
    doneChat: "Готово! MP4 отправлен тебе сообщением в Telegram чат.",
    failed: "Ошибка рендера",
    networkError: "Сетевая ошибка. Проверь API_BASE, tunnel и CORS.",
    badResponse: "Сервер вернул неожиданный ответ.",
    healthFailed: "Проверка API не пройдена.",
    resetDone: "Форма сброшена.",
    telegramRequired: "Контекст Telegram не найден. Открой Mini App из бота и посмотри debug ниже.",
    customTextLabel: "Надпись для full‑видео",
    customTextHint: "Показывается сверху по центру только в режиме Full. До 80 символов.",
    invalidColor: "Неверный HEX-цвет. Используй формат вроде #28c7e0.",
    debugTitle: "Telegram debug",
    tgDetected: "Telegram найден",
    webAppDetected: "WebApp найден",
    initDataPresent: "initData есть",
    initDataLength: "Длина initData",
    userIdPresent: "userId есть",
    userIdValue: "userId",
    platform: "platform",
    version: "version",
    colorScheme: "colorScheme"
  }
};

function t(key) {
  return i18n[currentLang][key] || key;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (i18n[currentLang][key]) el.textContent = i18n[currentLang][key];
  });

  document.querySelectorAll("[data-i18n-opt]").forEach((el) => {
    const key = el.dataset.i18nOpt;
    if (i18n[currentLang][key]) el.textContent = i18n[currentLang][key];
  });

  if (customTextInput) {
    customTextInput.placeholder =
      currentLang === "ru"
        ? "Необязательный текст для full режима"
        : "Optional text for full mode";
  }

  if (milkSearchInput) {
    milkSearchInput.placeholder =
      currentLang === "ru"
        ? "Поиск пресета по имени"
        : "Search preset by name";
  }

  langToggle.textContent = currentLang === "en" ? "RU" : "EN";
}

function setStatus(message, type = "info") {
  statusBox.className = "status show";
  if (type === "success") statusBox.classList.add("success");
  if (type === "error") statusBox.classList.add("error");
  statusBox.innerHTML = `<p>${message}</p>`;
}

function setStatusHtml(html, type = "info") {
  statusBox.className = "status show";
  if (type === "success") statusBox.classList.add("success");
  if (type === "error") statusBox.classList.add("error");
  statusBox.innerHTML = html;
}

function hideStatus() {
  statusBox.className = "status";
  statusBox.innerHTML = "";
}

function collectTelegramDebug() {
  const hasTelegram = Boolean(window.Telegram);
  const hasWebApp = Boolean(window.Telegram?.WebApp);
  const initDataValue = window.Telegram?.WebApp?.initData || "";
  const unsafeUser = window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  const unsafeReceiver = window.Telegram?.WebApp?.initDataUnsafe?.receiver || null;
  const resolvedUserId = unsafeUser?.id || unsafeReceiver?.id || null;

  return {
    hasTelegram,
    hasWebApp,
    hasInitData: Boolean(initDataValue),
    initDataLength: initDataValue ? initDataValue.length : 0,
    hasUserId: Boolean(resolvedUserId),
    userId: resolvedUserId || "",
    platform: window.Telegram?.WebApp?.platform || "",
    version: window.Telegram?.WebApp?.version || "",
    colorScheme: window.Telegram?.WebApp?.colorScheme || ""
  };
}

function renderTelegramDebug(debug) {
  return `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08)">
      <div style="font-weight:700;margin-bottom:8px;">${escapeHtml(t("debugTitle"))}</div>
      <div>${escapeHtml(t("tgDetected"))}: <b>${debug.hasTelegram ? "yes" : "no"}</b></div>
      <div>${escapeHtml(t("webAppDetected"))}: <b>${debug.hasWebApp ? "yes" : "no"}</b></div>
      <div>${escapeHtml(t("initDataPresent"))}: <b>${debug.hasInitData ? "yes" : "no"}</b></div>
      <div>${escapeHtml(t("initDataLength"))}: <b>${escapeHtml(debug.initDataLength)}</b></div>
      <div>${escapeHtml(t("userIdPresent"))}: <b>${debug.hasUserId ? "yes" : "no"}</b></div>
      <div>${escapeHtml(t("userIdValue"))}: <b>${escapeHtml(debug.userId || "-")}</b></div>
      <div>${escapeHtml(t("platform"))}: <b>${escapeHtml(debug.platform || "-")}</b></div>
      <div>${escapeHtml(t("version"))}: <b>${escapeHtml(debug.version || "-")}</b></div>
      <div>${escapeHtml(t("colorScheme"))}: <b>${escapeHtml(debug.colorScheme || "-")}</b></div>
    </div>
  `;
}

function setStatusWithDebug(message, type = "info") {
  const debug = collectTelegramDebug();
  lastTelegramDebug = debug;
  setStatusHtml(`<p>${escapeHtml(message)}</p>${renderTelegramDebug(debug)}`, type);
}

function initTelegramContext() {
  if (!tg) {
    lastTelegramDebug = collectTelegramDebug();
    return;
  }

  try { tg.ready(); } catch (_) {}
  try { tg.expand(); } catch (_) {}

  userId = tg.initDataUnsafe?.user?.id || tg.initDataUnsafe?.receiver?.id || null;
  telegramInitData = tg.initData || "";
  lastTelegramDebug = collectTelegramDebug();
}

function updateBackgroundDimUi() {
  const hasBackground = Boolean(backgroundFileInput?.files?.[0]);
  const dimValue = `${backgroundDimInput.value}%`;

  backgroundDimValue.textContent = dimValue;
  backgroundDimPreview.textContent = dimValue;
  backgroundDimSummaryValue.textContent = dimValue;

  backgroundControls.style.display = hasBackground ? "flex" : "none";
  backgroundDimSummary.style.display = hasBackground ? "flex" : "none";

  if (!hasBackground) isDimPanelOpen = false;
  backgroundDimPanel.classList.toggle("show", hasBackground && isDimPanelOpen);
}

function normalizeHexColor(value, fallback) {
  if (!value) return fallback;
  let color = value.trim();
  if (!color.startsWith("#")) color = `#${color}`;

  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
  return fallback;
}

function syncColorInputs(colorInput, textInput, fallback) {
  const normalized = normalizeHexColor(textInput.value || colorInput.value, fallback);
  colorInput.value = normalized;
  textInput.value = normalized;
  return normalized;
}

function bindColorPair(colorInput, textInput, fallback) {
  colorInput.addEventListener("input", () => {
    textInput.value = colorInput.value.toLowerCase();
    restartPreviewLoop();
  });

  textInput.addEventListener("blur", () => {
    const normalized = normalizeHexColor(textInput.value, fallback);
    colorInput.value = normalized;
    textInput.value = normalized;
    restartPreviewLoop();
  });
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderMilkPresets(list) {
  milkPresetGrid.innerHTML = "";

  if (!list.length) {
    milkPresetGrid.innerHTML = `<div class="hint">${currentLang === "ru" ? "Ничего не найдено." : "Nothing found."}</div>`;
    return;
  }

  list.forEach((preset) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `preset-card ${milkPresetInput.value === preset.key ? "active" : ""}`;
    card.innerHTML = `
      <canvas class="preset-preview" width="520" height="220" data-preview-family="${escapeHtml(preset.family)}"></canvas>
      <div class="preset-name">${escapeHtml(preset.name)}</div>
      <div class="preset-meta">${escapeHtml(preset.family)}</div>
      <p class="preset-desc">${escapeHtml(preset.desc)}</p>
    `;
    card.addEventListener("click", () => {
      milkPresetInput.value = preset.key;
      renderMilkPresets(list);
      restartPreviewLoop();
    });
    milkPresetGrid.appendChild(card);
  });

  restartPreviewLoop();
}

function refreshMilkRandom() {
  const shuffled = shuffleArray(milkPresets).slice(0, 6);
  visibleMilkPresets = shuffled;
  if (!shuffled.find((x) => x.key === milkPresetInput.value)) {
    milkPresetInput.value = shuffled[0]?.key || "ring_neon";
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

  renderMilkPresets(filtered);
}

function updateEngineUi() {
  const isMilk = engineSelect.value === "milk";
  styleField.style.display = isMilk ? "none" : "block";
  milkPanel.classList.toggle("show", isMilk);

  if (isMilk && !visibleMilkPresets.length) {
    refreshMilkRandom();
  }

  restartPreviewLoop();
}

function drawPreviewScene(ctx, family, width, height, tSec, primary, accent, active) {
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#071018");
  bg.addColorStop(1, "#0e1823");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = active ? 1 : 0.72;

  const cx = width / 2;
  const cy = height / 2;
  const amp = active ? 1 : 0.8;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.35);
  glow.addColorStop(0, `${accent}33`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = active ? 3 : 2;
  ctx.shadowBlur = active ? 14 : 8;
  ctx.shadowColor = primary;
  ctx.strokeStyle = primary;
  ctx.fillStyle = primary;

  if (family === "ring") {
    const r = 48 + Math.sin(tSec * 2.2) * 8 * amp;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (family === "double_ring") {
    const r1 = 36 + Math.sin(tSec * 2.1) * 6 * amp;
    const r2 = 62 + Math.cos(tSec * 1.4) * 5 * amp;
    ctx.beginPath();
    ctx.arc(cx, cy, r1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.beginPath();
    ctx.arc(cx, cy, r2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (family === "radial_bars") {
    for (let i = 0; i < 48; i += 1) {
      const a = (Math.PI * 2 * i) / 48;
      const base = 34;
      const extra = (10 + 20 * (0.5 + 0.5 * Math.sin(tSec * 3 + i * 0.5))) * amp;
      const x1 = cx + Math.cos(a) * base;
      const y1 = cy + Math.sin(a) * base;
      const x2 = cx + Math.cos(a) * (base + extra);
      const y2 = cy + Math.sin(a) * (base + extra);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  } else if (family === "scope") {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = cy + Math.sin(x * 0.03 + tSec * 4) * 22 * amp + Math.sin(x * 0.013 - tSec * 2) * 8;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (family === "mirror_wave") {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 5) {
      const d = Math.sin(x * 0.035 + tSec * 3.5) * 26 * amp;
      const y = cy - d;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 5) {
      const d = Math.sin(x * 0.035 + tSec * 3.5) * 26 * amp;
      const y = cy + d;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (family === "center_bars") {
    const bars = 44;
    const barW = width / bars;
    for (let i = 0; i < bars; i += 1) {
      const x = i * barW + 1;
      const h = (16 + 48 * (0.5 + 0.5 * Math.sin(tSec * 4 + i * 0.45))) * amp;
      ctx.fillRect(x, cy - h / 2, Math.max(barW - 2, 2), h);
    }
  } else if (family === "tunnel") {
    for (let i = 0; i < 6; i += 1) {
      const r = 24 + i * 18 + Math.sin(tSec * 2.2 + i) * 4 * amp;
      ctx.strokeStyle = i % 2 ? accent : primary;
      ctx.shadowColor = i % 2 ? accent : primary;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (family === "pulse_core") {
    const r = 18 + Math.sin(tSec * 5) * 6 * amp;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 26, 0, Math.PI * 2);
    ctx.stroke();
  } else if (family === "horizon_wave") {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = cy + Math.sin(x * 0.02 + tSec * 2) * 18 * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = primary;
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  } else if (family === "spectrogram_plus") {
    const cols = 40;
    const colW = width / cols;
    for (let i = 0; i < cols; i += 1) {
      const h = (18 + 70 * (0.5 + 0.5 * Math.sin(tSec * 3 + i * 0.4))) * amp;
      const grad = ctx.createLinearGradient(0, cy + h / 2, 0, cy - h / 2);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, primary);
      ctx.fillStyle = grad;
      ctx.fillRect(i * colW + 1, cy - h / 2, Math.max(colW - 2, 3), h);
    }
  } else if (family === "orbital_scope") {
    const r = 42 + Math.sin(tSec * 2.4) * 6 * amp;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      const a = tSec * (1.4 + i * 0.3) + i * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      ctx.beginPath();
      ctx.arc(x, y, 4 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (family === "spiral_beam") {
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.beginPath();
    for (let i = 0; i < 120; i += 1) {
      const a = i * 0.22 + tSec * 1.8;
      const r = 2 + i * 0.45;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.55;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
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
  if (!canvases.length || engineSelect.value !== "milk") return;

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

function updateCustomTextVisibility() {
  customTextField.style.display = modeSelect.value === "full" ? "block" : "none";
}

async function checkHealth() {
  const response = await fetch(`${API_BASE}/`, { method: "GET" });
  if (!response.ok) throw new Error(t("healthFailed"));

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error(t("badResponse"));

  return response.json();
}

async function uploadAndRender() {
  const file = audioFileInput.files[0];
  const backgroundFile = backgroundFileInput?.files?.[0] || null;

  if (!file) {
    setStatus(t("noFile"), "error");
    return;
  }

  initTelegramContext();

  const debug = collectTelegramDebug();
  lastTelegramDebug = debug;

  if (!debug.hasTelegram || !debug.hasWebApp || !debug.hasInitData) {
    setStatusHtml(
      `<p>${escapeHtml(t("telegramRequired"))}</p>${renderTelegramDebug(debug)}`,
      "error"
    );
    return;
  }

  const visualizerColor = syncColorInputs(visualizerColorInput, visualizerColorText, "#28c7e0");
  const accentColor = syncColorInputs(accentColorInput, accentColorText, "#7c4dff");

  if (!/^#[0-9a-f]{6}$/i.test(visualizerColor) || !/^#[0-9a-f]{6}$/i.test(accentColor)) {
    setStatus(t("invalidColor"), "error");
    return;
  }

  const engine = engineSelect.value;
  const style = engine === "milk" ? milkPresetInput.value : styleSelect.value;
  const mode = modeSelect.value;
  const orientation = orientationSelect.value || "portrait";
  const customText = customTextInput.value.trim();
  const backgroundDim = Number(backgroundDimInput.value || 35);
  const milkPreset = engine === "milk" ? milkPresetInput.value : "";

  try {
    renderButton.disabled = true;

    setStatusWithDebug(t("checkingApi"), "info");
    await checkHealth();

    setStatusWithDebug(t("uploading"), "info");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("engine", engine);
    formData.append("style", style);
    formData.append("mode", mode);
    formData.append("orientation", orientation);
    formData.append("background_dim", String(backgroundDim));
    formData.append("visualizer_color", visualizerColor);
    formData.append("accent_color", accentColor);
    formData.append("user_id", String(userId || ""));
    formData.append("init_data", telegramInitData || "");

    if (milkPreset) formData.append("milk_preset", milkPreset);
    if (backgroundFile) formData.append("background_file", backgroundFile);
    if (customText) formData.append("custom_text", customText);

    const uploadResponse = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData
    });

    const uploadContentType = uploadResponse.headers.get("content-type") || "";
    let uploadData;

    if (uploadContentType.includes("application/json")) {
      uploadData = await uploadResponse.json();
    } else {
      const text = await uploadResponse.text();
      throw new Error(text || t("badResponse"));
    }

    if (!uploadResponse.ok) {
      setStatusHtml(
        `<p>${escapeHtml(uploadData.detail || t("badResponse"))}</p>${renderTelegramDebug(debug)}`,
        "error"
      );
      return;
    }

    const taskId = uploadData.task_id;
    setStatusWithDebug(t("queued"), "info");

    let attempts = 0;
    const maxAttempts = 180;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await fetch(`${API_BASE}/status/${taskId}`);
      const statusContentType = statusResponse.headers.get("content-type") || "";
      let statusData;

      if (statusContentType.includes("application/json")) {
        statusData = await statusResponse.json();
      } else {
        const text = await statusResponse.text();
        throw new Error(text || t("badResponse"));
      }

      if (!statusResponse.ok) throw new Error(statusData.detail || t("badResponse"));

      if (statusData.status === "queued") {
        setStatusWithDebug(t("queued"), "info");
      } else if (statusData.status === "processing") {
        const percent = statusData.percent || 0;
        setStatusWithDebug(`${t("processing")}: ${percent}%`, "info");
      } else if (statusData.status === "failed") {
        const errorText = statusData.error || t("failed");
        setStatusHtml(
          `<p>${escapeHtml(`${t("failed")}: ${errorText}`)}</p>${renderTelegramDebug(debug)}`,
          "error"
        );
        return;
      } else if (statusData.status === "done") {
        setStatusHtml(
          `<p>${escapeHtml(t("doneChat"))}</p>${renderTelegramDebug(debug)}`,
          "success"
        );
        return;
      }

      attempts += 1;
    }

    setStatusWithDebug(t("failed"), "error");
  } catch (error) {
    console.error(error);
    setStatusHtml(
      `<p>${escapeHtml(error.message || t("networkError"))}</p>${renderTelegramDebug(collectTelegramDebug())}`,
      "error"
    );
  } finally {
    renderButton.disabled = false;
  }
}

function resetForm() {
  audioFileInput.value = "";
  backgroundFileInput.value = "";
  backgroundDimInput.value = "35";
  isDimPanelOpen = false;
  engineSelect.value = "classic";
  styleSelect.value = "wave_line";
  milkPresetInput.value = "ring_neon";
  modeSelect.value = "demo";
  orientationSelect.value = "portrait";
  customTextInput.value = "";
  milkSearchInput.value = "";
  visualizerColorInput.value = "#28c7e0";
  visualizerColorText.value = "#28c7e0";
  accentColorInput.value = "#7c4dff";
  accentColorText.value = "#7c4dff";
  refreshMilkRandom();
  updateEngineUi();
  updateCustomTextVisibility();
  updateBackgroundDimUi();
  hideStatus();
  setStatusWithDebug(t("resetDone"), "info");
  setTimeout(hideStatus, 2500);
}

langToggle.addEventListener("click", () => {
  currentLang = currentLang === "en" ? "ru" : "en";
  applyTranslations();
  if (statusBox.classList.contains("show") && lastTelegramDebug) {
    const currentText = statusBox.querySelector("p")?.textContent || "";
    setStatusHtml(`<p>${escapeHtml(currentText)}</p>${renderTelegramDebug(lastTelegramDebug)}`, statusBox.classList.contains("error") ? "error" : statusBox.classList.contains("success") ? "success" : "info");
  }
  restartPreviewLoop();
});

engineSelect.addEventListener("change", updateEngineUi);
modeSelect.addEventListener("change", updateCustomTextVisibility);

backgroundFileInput.addEventListener("change", () => {
  if (!backgroundFileInput.files?.[0]) {
    isDimPanelOpen = false;
    backgroundDimInput.value = "35";
  }
  updateBackgroundDimUi();
});

toggleDimButton.addEventListener("click", () => {
  isDimPanelOpen = !isDimPanelOpen;
  updateBackgroundDimUi();
});

backgroundDimInput.addEventListener("input", updateBackgroundDimUi);
milkShuffleButton.addEventListener("click", refreshMilkRandom);
milkSearchInput.addEventListener("input", filterMilkPresets);

bindColorPair(visualizerColorInput, visualizerColorText, "#28c7e0");
bindColorPair(accentColorInput, accentColorText, "#7c4dff");

renderButton.addEventListener("click", uploadAndRender);
resetButton.addEventListener("click", resetForm);

orientationSelect.value = "portrait";

initTelegramContext();
applyTranslations();
refreshMilkRandom();
updateEngineUi();
updateCustomTextVisibility();
updateBackgroundDimUi();
setStatusHtml(renderTelegramDebug(collectTelegramDebug()), "info");