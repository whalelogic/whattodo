// Elements are resolved on init() because this script tag is emitted inside the
// chat window, which renders *before* the notebook/doodle canvas in the DOM.
let form, input, messages, notebook;

function init() {
  form = document.getElementById('chat-form');
  input = document.getElementById('message-input');
  messages = document.getElementById('messages');
  notebook = document.getElementById('notebook-entries');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) return;

      appendUserMessage(message);
      input.value = '';
      input.disabled = true;

      const bot = appendBotMessageShell();
      await streamBotReply(message, bot);
      input.disabled = false;
      input.focus();
    });
  }

  setupNotebookDropZone();
  setupDoodle();
}

function appendUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'flex justify-end items-end gap-2';

  const avatar = document.createElement('div');
  avatar.className = 'w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm shrink-0';
  avatar.textContent = '🙂';

  const bubble = document.createElement('div');
  bubble.className = 'bg-neon-pink text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm max-w-[70%]';
  bubble.textContent = text;

  row.appendChild(bubble);
  row.appendChild(avatar);

  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
}

function appendBotMessageShell() {
  const container = document.createElement('div');
  container.className = 'space-y-2';

  const row = document.createElement('div');
  row.className = 'flex justify-start items-end gap-2';

  const avatar = document.createElement('div');
  avatar.className = 'w-8 h-8 rounded-full bg-neon-cyan/20 border border-neon-cyan flex items-center justify-center text-sm shrink-0';
  avatar.textContent = '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'bg-slate-100 dark:bg-[#1A2033] text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-sm px-4 py-2 text-sm max-w-[70%] border border-transparent dark:border-slate-700 whitespace-pre-wrap';

  const pin = document.createElement('button');
  pin.textContent = '📌';
  pin.title = 'Pin message to notebook';
  pin.className = 'text-sm opacity-60 hover:opacity-100 self-center cursor-pointer';
  pin.addEventListener('click', () => pinTextToNotebook(bubble.textContent));

  row.appendChild(avatar);
  row.appendChild(bubble);
  row.appendChild(pin);

  const locations = document.createElement('div');
  locations.className = 'ml-10 flex flex-col gap-2';

  container.appendChild(row);
  container.appendChild(locations);
  messages.appendChild(container);
  messages.scrollTop = messages.scrollHeight;

  return { bubble, locations };
}

async function streamBotReply(message, bot) {
  try {
    const res = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!res.ok || !res.body) {
      const fallback = await res.text();
      throw new Error(fallback || `Streaming request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = consumeSSEBuffer(buffer, (event, payload) => {
        if (event === 'chunk' && payload?.delta) {
          bot.bubble.textContent += payload.delta;
          messages.scrollTop = messages.scrollHeight;
          return;
        }

        if (event === 'done') {
          const text = typeof payload?.text === 'string' ? payload.text : bot.bubble.textContent;
          bot.bubble.textContent = text;
          renderLocationCards(bot.locations, payload?.locations || []);
          messages.scrollTop = messages.scrollHeight;
          return;
        }

        if (event === 'error') {
          throw new Error(payload?.error || 'Unknown stream error');
        }
      });
    }

    if (bot.bubble.textContent.trim() === '') {
      bot.bubble.textContent = 'No response was generated.';
    }
  } catch (err) {
    bot.bubble.textContent = `Sorry, something went wrong: ${err.message}`;
  }
}

function consumeSSEBuffer(buffer, onEvent) {
  const events = buffer.replaceAll('\r\n', '\n').split('\n\n');
  const remainder = events.pop();
  for (const rawEvent of events) {
    const lines = rawEvent.split('\n');
    let eventName = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data += line.slice(5).trim();
      }
    }
    if (!data) continue;
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (err) {
      console.error('Failed to parse SSE payload', err);
      continue;
    }
    onEvent(eventName, parsed);
  }
  return remainder || '';
}

function renderLocationCards(container, locations) {
  container.innerHTML = '';
  if (!Array.isArray(locations) || locations.length === 0) {
    return;
  }

  for (const location of locations) {
    const card = document.createElement('div');
    card.className = 'rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1420] p-3 text-sm cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md';
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/json', JSON.stringify(location));
      e.dataTransfer.setData('text/plain', location.name || 'Location');
      card.classList.add('opacity-50', 'ring-2', 'ring-neon-pink');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('opacity-50', 'ring-2', 'ring-neon-pink');
    });

    const header = document.createElement('div');
    header.className = 'flex items-start justify-between gap-2';

    const name = document.createElement('p');
    name.className = 'font-medium text-slate-800 dark:text-slate-100';
    name.textContent = location.name || 'Location';

    const grip = document.createElement('span');
    grip.className = 'text-slate-400 dark:text-slate-500 text-xs shrink-0 select-none';
    grip.title = 'Drag me into My Trip Notes';
    grip.textContent = '⠿';

    header.appendChild(name);
    header.appendChild(grip);

    const address = document.createElement('p');
    address.className = 'text-slate-600 dark:text-slate-300';
    address.textContent = location.address || '';

    const actions = document.createElement('div');
    actions.className = 'mt-2 flex items-center gap-3';

    const maps = document.createElement('a');
    maps.href = location.maps_url || '#';
    maps.target = '_blank';
    maps.rel = 'noopener noreferrer';
    maps.className = 'text-neon-pink hover:underline';
    maps.textContent = 'Open in Google Maps';

    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'text-neon-pink hover:underline cursor-pointer';
    pin.textContent = '📌 Pin location';
    pin.addEventListener('click', () => pinLocationToNotebook(location));

    actions.appendChild(maps);
    actions.appendChild(pin);
    card.appendChild(header);
    if (address.textContent) {
      card.appendChild(address);
    }
    card.appendChild(actions);
    container.appendChild(card);
  }
}

function pinTextToNotebook(text) {
  const trimmed = (text || '').trim();
  if (!trimmed || !notebook) return;

  const placeholder = notebook.querySelector('p.italic');
  if (placeholder) placeholder.remove();

  const entry = document.createElement('p');
  entry.textContent = `• ${trimmed}`;
  notebook.appendChild(entry);
}

const pinnedLocations = new Set();

function locationKey(location) {
  return `${(location.name || '').toLowerCase()}|${(location.address || '').toLowerCase()}`;
}

function pinLocationToNotebook(location) {
  if (!notebook) return;

  const key = locationKey(location);
  if (pinnedLocations.has(key)) return;
  pinnedLocations.add(key);

  const placeholder = notebook.querySelector('p.italic');
  if (placeholder) placeholder.remove();

  const entry = document.createElement('div');
  entry.className = 'group relative space-y-1 pr-6';

  const title = document.createElement('p');
  title.textContent = `• ${location.name || 'Location'}`;
  entry.appendChild(title);

  if (location.address) {
    const address = document.createElement('p');
    address.className = 'text-base pl-4';
    address.textContent = location.address;
    entry.appendChild(address);
  }

  if (location.maps_url) {
    const link = document.createElement('a');
    link.href = location.maps_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'text-neon-pink hover:underline text-base pl-4 inline-block';
    link.textContent = '📍 Open in Google Maps';
    entry.appendChild(link);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.title = 'Remove from notes';
  remove.className = 'absolute top-0 right-0 text-slate-400 hover:text-neon-pink opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer';
  remove.textContent = '✕';
  remove.addEventListener('click', () => {
    pinnedLocations.delete(key);
    entry.remove();
    if (!notebook.querySelector('div.group')) {
      notebook.appendChild(emptyNotebookPlaceholder());
    }
  });
  entry.appendChild(remove);

  notebook.appendChild(entry);
}

function emptyNotebookPlaceholder() {
  const p = document.createElement('p');
  p.className = 'italic text-slate-400 dark:text-slate-500 text-base';
  p.textContent = "Pin spots from the chat and they'll show up here 📌";
  return p;
}

// --- Drag & drop from chat cards into the notebook ---
function setupNotebookDropZone() {
  if (!notebook) return;

  const highlight = () =>
    notebook.classList.add('ring-2', 'ring-neon-pink', 'ring-inset', 'rounded-lg');
  const unhighlight = () =>
    notebook.classList.remove('ring-2', 'ring-neon-pink', 'ring-inset', 'rounded-lg');

  notebook.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    highlight();
  });
  notebook.addEventListener('dragleave', (e) => {
    if (!notebook.contains(e.relatedTarget)) unhighlight();
  });
  notebook.addEventListener('drop', (e) => {
    e.preventDefault();
    unhighlight();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      pinLocationToNotebook(JSON.parse(raw));
    } catch (err) {
      console.error('Failed to parse dropped location', err);
    }
  });
}

// --- Doodle canvas ---
function setupDoodle() {
  const canvas = document.getElementById('doodle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  let drawing = false;
  canvas.addEventListener('mousedown', () => (drawing = true));
  canvas.addEventListener('mouseup', () => (drawing = false));
  canvas.addEventListener('mouseleave', () => (drawing = false));
  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#FFD23F' : '#FF3EA5';
    ctx.beginPath();
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  const clear = document.getElementById('clear-doodle');
  if (clear) {
    clear.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
