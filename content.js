// content.js — robust duration detection & filtering

function getVideos() {
  const items = Array.from(document.querySelectorAll('ytd-playlist-video-renderer'));
  return items.map(item => {
    const title = item.querySelector('#video-title')?.textContent.trim() || '';
    const channel = (item.querySelector('.ytd-channel-name a') || item.querySelector('#byline a'))?.textContent.trim() || '';
    const durationText = findDurationText(item) || '';
    const duration = timeToSeconds(durationText);
    return { item, title, channel, duration, durationText };
  });
}

// Find first text in the item that matches duration pattern like MM:SS or HH:MM:SS
function findDurationText(item) {
  const candidates = item.querySelectorAll(
    'ytd-thumbnail-overlay-time-status-renderer, .ytd-thumbnail-overlay-time-status-renderer, span.ytd-thumbnail-overlay-time-status-renderer, #overlays span'
  );
  const durRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;
  for (const c of candidates) {
    if (!c) continue;
    const t = (c.textContent || '').trim();
    if (durRegex.test(t)) return durRegex.exec(t)[0];
  }

  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null, false);
  while (walker.nextNode()) {
    const txt = walker.currentNode.nodeValue.trim();
    const m = durRegex.exec(txt);
    if (m) return m[0];
  }
  return '';
}

function timeToSeconds(str) {
  if (!str) return 0;
  const clean = ('' + str).replace(/[^\d:]/g, '').trim();
  if (!clean) return 0;
  const parts = clean.split(':').map(p => Number(p));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return parts[0] || 0;
}

function createFilterBar(channelsList) {
  const bar = document.createElement('div');
  bar.id = 'yt-filter-bar';
  bar.style.margin = '16px 0';
  bar.style.display = 'flex';
  bar.style.gap = '12px';

  const channelFilter = document.createElement('select');
  channelFilter.id = 'yt-channel-filter';
  const allOption = document.createElement('option');
  allOption.value = ''; allOption.textContent = 'All Channels';
  channelFilter.appendChild(allOption);
  channelsList.forEach(channel => {
    const opt = document.createElement('option');
    opt.value = channel; opt.textContent = channel;
    channelFilter.appendChild(opt);
  });

  const lengthInput = document.createElement('input');
  lengthInput.id = 'yt-length-filter';
  lengthInput.type = 'number';
  lengthInput.placeholder = 'Max length (min)';
  lengthInput.min = 0;
  lengthInput.style.width = '120px';

  const filterBtn = document.createElement('button');
  filterBtn.id = 'yt-filter-btn';
  filterBtn.textContent = 'Apply Filter';

  const resetBtn = document.createElement('button');
  resetBtn.id = 'yt-reset-btn';
  resetBtn.textContent = 'Reset';

  bar.append(channelFilter, lengthInput, filterBtn, resetBtn);
  return bar;
}

function insertFilterBar(bar) {
  const container = document.querySelector('ytd-playlist-header-renderer');
  if (container && !document.getElementById('yt-filter-bar')) {
    container.parentNode.insertBefore(bar, container.nextSibling);
  }
}

// ===== Fixed filterVideos function =====
function filterVideos(videos, channelVal, maxLen) {
  const maxSeconds = (!isNaN(maxLen) && maxLen > 0) ? maxLen * 60 : null;

  videos.forEach(v => {
    const freshDurationText = findDurationText(v.item) || v.durationText || '';
    const duration = timeToSeconds(freshDurationText);

    const show =
      (!channelVal || v.channel === channelVal) &&
      (maxSeconds === null || duration <= maxSeconds);

    v.item.style.display = show ? '' : 'none';
  });
}
// =======================================

function main() {
  let videos = getVideos();
  const channels = [...new Set(videos.map(v => v.channel).filter(c => c.length > 0))].sort();
  const bar = createFilterBar(channels);
  insertFilterBar(bar);

  bar.querySelector('#yt-filter-btn').onclick = () => {
    videos = getVideos(); // re-fetch to include lazy-loaded items
    const channelVal = bar.querySelector('#yt-channel-filter').value;
    const val = bar.querySelector('#yt-length-filter').value;
    const maxLen = val === '' ? 0 : Number(val);
    filterVideos(videos, channelVal, maxLen);
  };

  bar.querySelector('#yt-reset-btn').onclick = () => {
    videos = getVideos();
    filterVideos(videos, '', 0);
    bar.querySelector('#yt-channel-filter').value = '';
    bar.querySelector('#yt-length-filter').value = '';
  };
}

window.addEventListener('yt-navigate-finish', () => setTimeout(main, 1000));
window.addEventListener('DOMContentLoaded', () => setTimeout(main, 1500));

const playlistNode = () => document.querySelector('ytd-playlist-video-list-renderer');
const observer = new MutationObserver(() => {
  if (!playlistNode()) return;
  if (document.getElementById('yt-filter-bar')) {
    // no-op; user can hit Apply again
  }
});
observer.observe(document.body, { childList: true, subtree: true });
