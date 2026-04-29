const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// ВСТАВЬ сюда актуальный URL из ngrok
const API_BASE = "https://comma-ridden-darkish.ngrok-free.dev";

const audioFileInput = document.getElementById("audioFile");
const styleSelect = document.getElementById("style");
const modeSelect = document.getElementById("mode");
const renderButton = document.getElementById("renderButton");
const resetButton = document.getElementById("resetButton");
const statusBox = document.getElementById("statusBox");

function setStatus(message, type = "") {
  statusBox.className = "status show";
  if (type) statusBox.classList.add(type);
  statusBox.innerHTML = message;
}

function clearStatus() {
  statusBox.className = "status";
  statusBox.innerHTML = "";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeJson(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      "Сервер вернул не JSON. Возможно, ngrok недоступен, URL устарел или пришла HTML-страница ошибки."
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Не удалось разобрать JSON-ответ сервера.");
  }
}

function getErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.error === "string") return data.error;
  return fallback;
}

async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE}/`, {
      method: "GET",
    });

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`API вернул статус ${response.status}. Ответ: ${rawText.slice(0, 300)}`);
    }

    if (!contentType.includes("application/json")) {
      throw new Error(`API ответил не JSON-ом. Content-Type: ${contentType}. Ответ: ${rawText.slice(0, 300)}`);
    }

    try {
      JSON.parse(rawText);
    } catch {
      throw new Error(`Не удалось разобрать JSON. Ответ: ${rawText.slice(0, 300)}`);
    }

    return true;
  } catch (error) {
    throw new Error(
      `Сервер недоступен.\nТехническая причина: ${error.message}\nAPI_BASE: ${API_BASE}`
    );
  }
}

async function pollStatus(taskId) {
  while (true) {
    let response;
    let data;

    try {
      response = await fetch(`${API_BASE}/status/${taskId}`, {
        method: "GET",
      });
      data = await safeJson(response);
    } catch (error) {
      throw new Error(
        `Не удалось получить статус задачи.\n${error.message}`
      );
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Не удалось получить статус задачи."));
    }

    if (data.status === "done" && data.download_url) {
      const downloadUrl = `${API_BASE}${data.download_url}`;
      setStatus(
        `Рендер готов.<br><a class="download-link" href="${downloadUrl}" target="_blank" rel="noopener noreferrer">Скачать MP4</a>`,
        "success"
      );
      renderButton.disabled = false;
      return;
    }

    if (data.status === "failed") {
      throw new Error(getErrorMessage(data, "Рендер завершился с ошибкой."));
    }

    if (data.status === "queued") {
      setStatus("Задача создана и поставлена в очередь. Ждём начала обработки...");
    } else if (data.status === "processing") {
      setStatus("Идёт рендер видео. Это может занять до 1–2 минут...");
    } else {
      setStatus(`Статус задачи: ${data.status}. Ждём завершения...`);
    }

    await sleep(2500);
  }
}

async function uploadAndRender() {
  clearStatus();

  const file = audioFileInput.files[0];
  const style = styleSelect.value;
  const mode = modeSelect.value;

  if (!file) {
    setStatus("Сначала выбери MP3 или WAV файл.", "error");
    return;
  }

  renderButton.disabled = true;
  setStatus("Проверяем доступность API...");

  try {
    await checkApiHealth();

    setStatus("Загружаем файл и создаём задачу...");

    const formData = new FormData();
    formData.append("file", file);

    const uploadUrl = `${API_BASE}/upload?style=${encodeURIComponent(style)}&mode=${encodeURIComponent(mode)}`;

    let response;
    let data;

    try {
      response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      data = await safeJson(response);
    } catch (error) {
      throw new Error(
        `Не удалось загрузить файл.\n${error.message}`
      );
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Не удалось загрузить файл."));
    }

    setStatus(`Задача создана. ID: ${data.task_id}<br>Начинаем опрос статуса...`);
    await pollStatus(data.task_id);
  } catch (error) {
    setStatus(`Ошибка:\n${error.message}`, "error");
    renderButton.disabled = false;
  }
}

function resetForm() {
  audioFileInput.value = "";
  styleSelect.value = "wave_line";
  modeSelect.value = "demo";
  clearStatus();
  renderButton.disabled = false;
}

renderButton.addEventListener("click", uploadAndRender);
resetButton.addEventListener("click", resetForm);