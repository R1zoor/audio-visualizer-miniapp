const API_BASE = "https://authentic-size-anywhere-patches.trycloudflare.com";

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
}

const audioFileInput = document.getElementById("audioFile");
const styleSelect = document.getElementById("style");
const modeSelect = document.getElementById("mode");
const paletteSelect = document.getElementById("palette");
const renderButton = document.getElementById("renderButton");
const resetButton = document.getElementById("resetButton");
const statusBox = document.getElementById("statusBox");
const langToggle = document.getElementById("langToggle");

let currentLang = "en";

const i18n = {
  en: {
    title: "Audio Visualizer Bot",
    subtitle: "Upload MP3/WAV and get an MP4 audio visualization.",
    fileLabel: "Audio file",
    styleLabel: "Style",
    modeLabel: "Mode",
    paletteLabel: "Palette",
    styleWaveLine: "Wave Line",
    styleWaveFilled: "Wave Filled",
    styleBars: "Bars",
    styleSpectrogram: "Spectrogram",
    modeDemo: "Demo",
    modeFull: "Full",
    paletteDefault: "Default",
    paletteNeon: "Neon",
    paletteSunset: "Sunset",
    palettePastel: "Pastel",
    renderButton: "Render",
    resetButton: "Reset",
    noFile: "Please select an audio file.",
    checkingApi: "Checking API availability...",
    uploading: "Uploading file...",
    queued: "Task queued. Waiting for processing...",
    processing: "Processing audio...",
    done: "Done! Your video is ready:",
    failed: "Render failed",
    networkError: "Network error. Please check API_BASE, tunnel, and CORS.",
    badResponse: "Server returned an unexpected response.",
    healthFailed: "API health check failed.",
    resetDone: "Form reset.",
    download: "Download video"
  },
  ru: {
    title: "Audio Visualizer Bot",
    subtitle: "Загрузите MP3/WAV и получите MP4-визуализацию аудио.",
    fileLabel: "Аудиофайл",
    styleLabel: "Стиль",
    modeLabel: "Режим",
    paletteLabel: "Палитра",
    styleWaveLine: "Линия волны",
    styleWaveFilled: "Заполненная волна",
    styleBars: "Столбцы",
    styleSpectrogram: "Спектрограмма",
    modeDemo: "Демо",
    modeFull: "Полный",
    paletteDefault: "Стандартная",
    paletteNeon: "Неон",
    paletteSunset: "Закат",
    palettePastel: "Пастель",
    renderButton: "Рендер",
    resetButton: "Сброс",
    noFile: "Пожалуйста, выберите аудиофайл.",
    checkingApi: "Проверка доступности API...",
    uploading: "Загрузка файла...",
    queued: "Задача поставлена в очередь. Ожидание обработки...",
    processing: "Обработка аудио...",
    done: "Готово! Ваше видео:",
    failed: "Ошибка рендера",
    networkError: "Сетевая ошибка. Проверьте API_BASE, tunnel и CORS.",
    badResponse: "Сервер вернул неожиданный ответ.",
    healthFailed: "Проверка API не пройдена.",
    resetDone: "Форма сброшена.",
    download: "Скачать видео"
  }
};

function t(key) {
  return i18n[currentLang][key] || key;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (i18n[currentLang][key]) {
      el.textContent = i18n[currentLang][key];
    }
  });

  langToggle.textContent = currentLang === "en" ? "RU" : "EN";
}

function setStatus(message, type = "info") {
  statusBox.className = type;
  statusBox.innerHTML = `<p>${message}</p>`;
}

function setStatusHtml(html, type = "info") {
  statusBox.className = type;
  statusBox.innerHTML = html;
}

async function checkHealth() {
  const response = await fetch(`${API_BASE}/`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(t("healthFailed"));
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(t("badResponse"));
  }

  return response.json();
}

async function uploadAndRender() {
  const file = audioFileInput.files[0];
  if (!file) {
    setStatus(t("noFile"), "error");
    return;
  }

  const style = styleSelect.value;
  const mode = modeSelect.value;
  const palette = paletteSelect.value;

  try {
    renderButton.disabled = true;

    setStatus(t("checkingApi"), "info");
    await checkHealth();

    setStatus(t("uploading"), "info");

    const formData = new FormData();
    formData.append("file", file);

    const uploadUrl = `${API_BASE}/upload?style=${encodeURIComponent(style)}&mode=${encodeURIComponent(mode)}&palette=${encodeURIComponent(palette)}`;

    const uploadResponse = await fetch(uploadUrl, {
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
      throw new Error(uploadData.detail || t("badResponse"));
    }

    const taskId = uploadData.task_id;
    setStatus(t("queued"), "info");

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

      if (!statusResponse.ok) {
        throw new Error(statusData.detail || t("badResponse"));
      }

      if (statusData.status === "queued") {
        setStatus(t("queued"), "info");
      } else if (statusData.status === "processing") {
        setStatus(t("processing"), "info");
      } else if (statusData.status === "failed") {
        const errorText = statusData.error || t("failed");
        setStatus(`${t("failed")}: ${errorText}`, "error");
        return;
      } else if (statusData.status === "done") {
        const downloadUrl = statusData.download_url
          ? `${API_BASE}${statusData.download_url}`
          : null;

        if (!downloadUrl) {
          throw new Error(t("badResponse"));
        }

        setStatusHtml(
          `<p>${t("done")}</p><p><a href="${downloadUrl}" target="_blank" rel="noopener noreferrer">${t("download")}</a></p>`,
          "success"
        );
        return;
      }

      attempts += 1;
    }

    setStatus(t("failed"), "error");
  } catch (error) {
    console.error(error);
    setStatus(error.message || t("networkError"), "error");
  } finally {
    renderButton.disabled = false;
  }
}

function resetForm() {
  audioFileInput.value = "";
  styleSelect.value = "wave_line";
  modeSelect.value = "demo";
  paletteSelect.value = "default";
  setStatus(t("resetDone"), "info");
}

langToggle.addEventListener("click", () => {
  currentLang = currentLang === "en" ? "ru" : "en";
  applyTranslations();
});

renderButton.addEventListener("click", uploadAndRender);
resetButton.addEventListener("click", resetForm);

applyTranslations();