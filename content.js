// content.js — with channel counter feature

let videoCache = new Map();
let channelCache = new Set();
let isProcessing = false;
let currentChannelCount = 0;

function getVideos() {
  const items = Array.from(document.querySelectorAll('ytd-playlist-video-renderer'));
  return items.map(item => {
    const itemId = getItemId(item);
    if (videoCache.has(itemId)) {
      const cached = videoCache.get(itemId);
      if (cached.element === item) {
        return cached.data;
      }
    }

    const title = item.querySelector('#video-title')?.textContent.trim() || '';
    const channel = getChannelName(item) || '';
    const durationText = findDurationText(item) || '';
    const duration = timeToSeconds(durationText);
    
    const videoData = { item, title, channel, duration, durationText };
    
    videoCache.set(itemId, {
      element: item,
      data: videoData,
      timestamp: Date.now()
    });
    
    return videoData;
  });
}

function getItemId(item) {
  const title = item.querySelector('#video-title')?.textContent.trim() || '';
  const index = Array.from(item.parentNode?.children || []).indexOf(item);
  return `${title.substring(0, 20)}-${index}`;
}

function getChannelName(item) {
  const quickSelectors = [
    'ytd-channel-name #text',
    'ytd-channel-name a',
    '#channel-name a',
    '#byline a'
  ];
  
  for (const selector of quickSelectors) {
    const element = item.querySelector(selector);
    if (element?.textContent?.trim()) {
      const channelName = element.textContent.trim().replace(/\s+/g, ' ');
      if (channelName.length > 1) {
        channelCache.add(channelName);
        return channelName;
      }
    }
  }
  
  const channelLinks = item.querySelectorAll('a[href*="/channel/"], a[href*="/user/"], a[href*="/c/"]');
  for (const link of channelLinks) {
    if (link.textContent?.trim() && 
        !link.closest('ytd-menu-renderer') &&
        !link.closest('ytd-button-renderer') &&
        link.textContent.trim().length > 1) {
      const channelName = link.textContent.trim().replace(/\s+/g, ' ');
      channelCache.add(channelName);
      return channelName;
    }
  }
  
  return '';
}

function findDurationText(item) {
  const durationEl = item.querySelector('ytd-thumbnail-overlay-time-status-renderer span');
  if (durationEl?.textContent) {
    const durRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;
    const match = durRegex.exec(durationEl.textContent.trim());
    if (match) return match[0];
  }
  return '';
}

function timeToSeconds(str) {
  if (!str) return 0;
  const parts = str.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return parts[0] || 0;
}

function createFilterBar(channelsList) {
  const bar = document.createElement('div');
  bar.id = 'yt-filter-bar';
  
  // Create container for channel filter and counter
  const channelFilterContainer = document.createElement('div');
  channelFilterContainer.id = 'yt-channel-filter-container';
  
  const channelFilter = document.createElement('select');
  channelFilter.id = 'yt-channel-filter';
  
  const allOption = document.createElement('option');
  allOption.value = ''; 
  allOption.textContent = 'All Channels';
  channelFilter.appendChild(allOption);
  
  channelsList.forEach(channel => {
    const opt = document.createElement('option');
    opt.value = channel; 
    opt.textContent = channel;
    channelFilter.appendChild(opt);
  });

  // Create channel counter as a static button-like element
  const channelCounter = document.createElement('div');
  channelCounter.id = 'yt-channel-counter';
  channelCounter.textContent = `${channelsList.length} channels`;
  channelCounter.title = `${channelsList.length} channels found`;

  channelFilterContainer.appendChild(channelFilter);
  channelFilterContainer.appendChild(channelCounter);

  const lengthInput = document.createElement('input');
  lengthInput.id = 'yt-length-filter';
  lengthInput.type = 'number';
  lengthInput.placeholder = 'Max minutes';
  lengthInput.min = 0;

  const filterBtn = document.createElement('button');
  filterBtn.id = 'yt-filter-btn';
  filterBtn.textContent = 'Filter';

  const refreshBtn = document.createElement('button');
  refreshBtn.id = 'yt-refresh-btn';
  refreshBtn.textContent = 'Refresh';
  refreshBtn.title = 'Reload channel list';

  const resetBtn = document.createElement('button');
  resetBtn.id = 'yt-reset-btn';
  resetBtn.textContent = 'Reset';

  bar.append(channelFilterContainer, lengthInput, filterBtn, refreshBtn, resetBtn);
  return bar;
}

function updateChannelCounter(count) {
  const counter = document.getElementById('yt-channel-counter');
  if (counter) {
    // Add updating animation
    counter.classList.add('updating');
    
    // Update the text after a brief delay for smooth transition
    setTimeout(() => {
      counter.textContent = `${count} channels`;
      counter.title = `${count} channels found`;
      
      // Remove animation class after completion
      setTimeout(() => {
        counter.classList.remove('updating');
      }, 500);
    }, 150);
    
    currentChannelCount = count;
  }
}

function insertFilterBar(bar) {
  const container = document.querySelector('ytd-playlist-header-renderer');
  if (container && !document.getElementById('yt-filter-bar')) {
    container.parentNode.insertBefore(bar, container.nextSibling);
  }
}

function filterVideos(videos, channelVal, maxLen) {
  if (isProcessing) return;
  isProcessing = true;
  
  const maxSeconds = maxLen > 0 ? maxLen * 60 : null;
  
  requestAnimationFrame(() => {
    videos.forEach(v => {
      const show =
        (!channelVal || v.channel === channelVal) &&
        (maxSeconds === null || v.duration <= maxSeconds);
      
      v.item.style.display = show ? '' : 'none';
    });
    isProcessing = false;
  });
}

function refreshChannelList() {
  if (isProcessing) return;
  isProcessing = true;
  
  const bar = document.getElementById('yt-filter-bar');
  if (!bar) {
    isProcessing = false;
    return;
  }
  
  videoCache.clear();
  channelCache.clear();
  
  const videos = getVideos();
  const channels = [...new Set(videos.map(v => v.channel).filter(c => c && c.length > 0))].sort();
  
  const channelFilter = bar.querySelector('#yt-channel-filter');
  const currentValue = channelFilter.value;
  
  requestAnimationFrame(() => {
    while (channelFilter.children.length > 1) {
      channelFilter.removeChild(channelFilter.lastChild);
    }
    
    channels.forEach(channel => {
      const opt = document.createElement('option');
      opt.value = channel; 
      opt.textContent = channel;
      channelFilter.appendChild(opt);
    });
    
    if (currentValue && channels.includes(currentValue)) {
      channelFilter.value = currentValue;
    }
    
    // Update the channel counter
    updateChannelCounter(channels.length);
    
    isProcessing = false;
  });
  
  return videos;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedMain = debounce(() => {
  if (isProcessing) return;
  
  videoCache.clear();
  channelCache.clear();
  
  const videos = getVideos();
  const channels = [...new Set(videos.map(v => v.channel).filter(c => c && c.length > 0))].sort();
  
  if (!document.getElementById('yt-filter-bar')) {
    const bar = createFilterBar(channels);
    insertFilterBar(bar);

    bar.querySelector('#yt-filter-btn').onclick = () => {
      if (isProcessing) return;
      const videos = getVideos();
      const channelVal = bar.querySelector('#yt-channel-filter').value;
      const val = bar.querySelector('#yt-length-filter').value;
      const maxLen = val === '' ? 0 : Number(val);
      filterVideos(videos, channelVal, maxLen);
    };

    bar.querySelector('#yt-refresh-btn').onclick = () => {
      const oldCount = currentChannelCount;
      refreshChannelList();
      
      // Show notification about count change
      const newCount = currentChannelCount;
      if (newCount !== oldCount) {
        console.log(`Channel count updated: ${oldCount} → ${newCount}`);
      }
    };

    bar.querySelector('#yt-reset-btn').onclick = () => {
      if (isProcessing) return;
      const videos = getVideos();
      filterVideos(videos, '', 0);
      bar.querySelector('#yt-channel-filter').value = '';
      bar.querySelector('#yt-length-filter').value = '';
    };
  }
}, 500);

const observer = new MutationObserver(debounce((mutations) => {
  if (isProcessing) return;
  
  let shouldUpdate = false;
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && 
            (node.matches?.('ytd-playlist-video-renderer') || 
             node.querySelector?.('ytd-playlist-video-renderer'))) {
          shouldUpdate = true;
          break;
        }
      }
    }
    if (shouldUpdate) break;
  }
  
  if (shouldUpdate && document.getElementById('yt-filter-bar')) {
    setTimeout(refreshChannelList, 1000);
  }
}, 1000));

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of videoCache.entries()) {
    if (now - value.timestamp > 30000) {
      videoCache.delete(key);
    }
  }
}, 15000);

window.addEventListener('yt-navigate-finish', () => {
  setTimeout(debouncedMain, 1000);
});

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(debouncedMain, 1500);
});

if (document.body) {
  observer.observe(document.body, { 
    childList: true, 
    subtree: false 
  });
}

let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    if (currentUrl.includes('list=WL')) {
      setTimeout(debouncedMain, 500);
    }
  }
}, 1000);