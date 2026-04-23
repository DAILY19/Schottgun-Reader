(function () {
  'use strict';

  // ===== DOM refs =====
  const inputView    = document.getElementById('input-view');
  const readerView   = document.getElementById('reader-view');
  const textInput    = document.getElementById('text-input');
  const startBtn     = document.getElementById('start-btn');
  const wordEl       = document.getElementById('word');
  const progressBar  = document.getElementById('progress-bar');
  const wordCounter  = document.getElementById('word-counter');
  const timeRemain   = document.getElementById('time-remaining');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const playIcon     = document.getElementById('play-icon');
  const pauseIcon    = document.getElementById('pause-icon');
  const backBtn      = document.getElementById('back-btn');
  const forwardBtn   = document.getElementById('forward-btn');
  const speedSlider  = document.getElementById('speed-slider');
  const speedValue   = document.getElementById('speed-value');
  const newTextBtn   = document.getElementById('new-text-btn');
  const textPanel    = document.getElementById('text-panel');
  const fileInput    = document.getElementById('file-input');
  const uploadZone   = document.getElementById('upload-zone');
  const uploadLabel  = document.getElementById('upload-label');
  const fileStatus   = document.getElementById('file-status');
  const clearBtn     = document.getElementById('clear-btn');

  // ===== PDF.js worker =====
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // ===== State =====
  let words     = [];
  let index     = 0;
  let wpm       = 250;
  let playing   = false;
  let timer     = null;
  let dragging  = false;

  // ===== File loading =====
  function setFileStatus(msg, isError) {
    fileStatus.textContent = msg;
    fileStatus.className = 'file-status' + (isError ? ' error' : '');
    fileStatus.classList.remove('hidden');
  }

  function populateFromText(text, filename) {
    textInput.value = text.trim();
    textInput.dispatchEvent(new Event('input'));
    var wordCount = text.trim().split(/\s+/).filter(function(w){ return w.length > 0; }).length;
    uploadLabel.textContent = filename;
    uploadZone.classList.add('loaded');
    setFileStatus(wordCount.toLocaleString() + ' words loaded');
  }

  function extractTextFromTxt(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      populateFromText(e.target.result, file.name);
    };
    reader.onerror = function () {
      setFileStatus('Could not read file.', true);
    };
    reader.readAsText(file);
  }

  function extractTextFromPdf(file) {
    if (typeof pdfjsLib === 'undefined') {
      setFileStatus('PDF library not loaded. Check your internet connection.', true);
      return;
    }
    setFileStatus('Reading PDF…');
    var reader = new FileReader();
    reader.onload = function (e) {
      var typedArray = new Uint8Array(e.target.result);
      pdfjsLib.getDocument({ data: typedArray }).promise.then(function (pdf) {
        var pagePromises = [];
        for (var p = 1; p <= pdf.numPages; p++) {
          pagePromises.push(
            pdf.getPage(p).then(function (page) {
              return page.getTextContent();
            }).then(function (tc) {
              return tc.items.map(function (item) { return item.str; }).join(' ');
            })
          );
        }
        Promise.all(pagePromises).then(function (pages) {
          populateFromText(pages.join(' '), file.name);
        }).catch(function () {
          setFileStatus('Failed to extract text from PDF.', true);
        });
      }).catch(function () {
        setFileStatus('Could not open PDF. The file may be encrypted or corrupted.', true);
      });
    };
    reader.onerror = function () {
      setFileStatus('Could not read file.', true);
    };
    reader.readAsArrayBuffer(file);
  }

  fileInput.addEventListener('change', function () {
    var file = fileInput.files[0];
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf' || file.type === 'application/pdf') {
      extractTextFromPdf(file);
    } else {
      extractTextFromTxt(file);
    }
    // reset so selecting the same file again re-triggers
    fileInput.value = '';
  });

  // ===== Helpers =====
  function sanitize(text) {
    // Strip HTML tags to prevent XSS if pasted from web
    const div = document.createElement('div');
    div.textContent = text;
    return div.textContent;
  }

  function parseWords(text) {
    return sanitize(text)
      .split(/\s+/)
      .filter(function (w) { return w.length > 0; });
  }

  function msPerWord() {
    return Math.round(60000 / wpm);
  }

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ===== Display =====
  var VOWELS = 'aeiouAEIOU';

  function getPivotIndex(word) {
    // Center letter for the pivot position:
    // - Odd length: true center letter
    // - Even length: pick the vowel among the two middle letters;
    //   if neither is a vowel, use the left of the two
    var len = word.length;
    if (len <= 1) return 0;
    if (len % 2 === 1) {
      // Odd: exact center
      return Math.floor(len / 2);
    }
    // Even: two middle candidates
    var left  = len / 2 - 1;
    var right = len / 2;
    if (VOWELS.indexOf(word[right]) !== -1) return right;
    // left is vowel, or neither — default to left
    return left;
  }

  function renderWord(word) {
    wordEl.innerHTML = '';
    var pivot = getPivotIndex(word);
    // We position the word so the pivot letter sits at the center of the container.
    // We use a wrapper with flexbox and a negative margin offset.
    for (var i = 0; i < word.length; i++) {
      var span = document.createElement('span');
      span.className = i === pivot ? 'letter pivot' : 'letter';
      span.textContent = word[i];
      wordEl.appendChild(span);
    }
    // After rendering, shift the word so the pivot letter aligns with center
    requestAnimationFrame(function () {
      var pivotEl = wordEl.querySelector('.pivot');
      if (!pivotEl) return;
      var containerCenter = wordEl.parentElement.offsetWidth / 2;
      var pivotRect = pivotEl.getBoundingClientRect();
      var wordRect  = wordEl.getBoundingClientRect();
      var pivotCenter = pivotRect.left + pivotRect.width / 2;
      var wordLeft    = wordRect.left;
      var currentOffset = pivotCenter - wordLeft;
      var desiredOffset = containerCenter;
      wordEl.style.transform = 'translateX(' + (desiredOffset - currentOffset) + 'px)';
    });
  }

  function showWord() {
    if (index < 0) index = 0;
    if (index >= words.length) {
      index = words.length - 1;
      pause();
    }
    renderWord(words[index]);
    updateProgress();
  }

  // ===== Text panel (windowed for performance) =====
  var PANEL_WINDOW = 100; // words before/after current to render
  var panelStart = 0;
  var panelEnd   = 0;

  function buildTextPanel() {
    textPanel.innerHTML = '';
    panelStart = 0;
    panelEnd = 0;
    renderPanelWindow();
  }

  function renderPanelWindow() {
    var newStart = Math.max(0, index - PANEL_WINDOW);
    var newEnd   = Math.min(words.length, index + PANEL_WINDOW);
    // Only rebuild if the window shifted
    if (newStart === panelStart && newEnd === panelEnd && textPanel.childNodes.length > 0) return;
    panelStart = newStart;
    panelEnd   = newEnd;
    textPanel.innerHTML = '';
    if (panelStart > 0) {
      var ellip = document.createElement('span');
      ellip.className = 'tw-ellip';
      ellip.textContent = '… ';
      textPanel.appendChild(ellip);
    }
    for (var i = panelStart; i < panelEnd; i++) {
      var span = document.createElement('span');
      span.className = 'tw' + (i === index ? ' active' : '');
      span.textContent = words[i];
      span.dataset.i = i;
      textPanel.appendChild(span);
      textPanel.appendChild(document.createTextNode(' '));
    }
    if (panelEnd < words.length) {
      var ellip2 = document.createElement('span');
      ellip2.className = 'tw-ellip';
      ellip2.textContent = ' …';
      textPanel.appendChild(ellip2);
    }
  }

  function highlightPanel() {
    // Re-render window if index is near the edge
    if (index < panelStart + 20 || index >= panelEnd - 20 || textPanel.childNodes.length === 0) {
      renderPanelWindow();
      return;
    }
    var prev = textPanel.querySelector('.tw.active');
    if (prev) prev.classList.remove('active');
    var target = textPanel.querySelector('.tw[data-i="' + index + '"]');
    if (target) {
      target.classList.add('active');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function updateProgress() {
    var pct = words.length > 1 ? (index / (words.length - 1)) * 100 : 0;
    progressBar.value = pct;
    wordCounter.textContent = (index + 1) + ' / ' + words.length;
    var remaining = (words.length - 1 - index) * (msPerWord() / 1000);
    timeRemain.textContent = formatTime(remaining);
    highlightPanel();
  }

  // ===== Playback =====
  function play() {
    if (words.length === 0) return;
    playing = true;
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    scheduleNext();
  }

  function pause() {
    playing = false;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    clearTimeout(timer);
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(function () {
      if (index < words.length - 1) {
        index++;
        showWord();
        scheduleNext();
      } else {
        pause();
      }
    }, msPerWord());
  }

  function stepBack() {
    if (index > 0) {
      index--;
      showWord();
      if (playing) {
        // reset the current timer so the new word gets a full interval
        clearTimeout(timer);
        scheduleNext();
      }
    }
  }

  function stepForward() {
    if (index < words.length - 1) {
      index++;
      showWord();
      if (playing) {
        clearTimeout(timer);
        scheduleNext();
      }
    }
  }

  // ===== View switching =====
  function switchToReader() {
    words = parseWords(textInput.value);
    if (words.length === 0) return;
    index = 0;
    progressBar.max = 100;
    buildTextPanel();
    inputView.classList.remove('active');
    readerView.classList.add('active');
    showWord();
  }

  function switchToInput() {
    pause();
    readerView.classList.remove('active');
    inputView.classList.add('active');
    wordEl.innerHTML = '';
    wordEl.style.transform = '';
    textPanel.innerHTML = '';
  }

  // ===== Event listeners =====
  textInput.addEventListener('input', function () {
    var hasText = textInput.value.trim().length > 0;
    startBtn.disabled = !hasText;
    if (hasText) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  });

  startBtn.addEventListener('click', switchToReader);

  clearBtn.addEventListener('click', function () {
    textInput.value = '';
    textInput.dispatchEvent(new Event('input'));
    uploadZone.classList.remove('loaded');
    uploadLabel.textContent = 'Upload PDF or TXT file';
    fileStatus.classList.add('hidden');
    textInput.focus();
  });

  newTextBtn.addEventListener('click', switchToInput);

  // Text panel word click
  textPanel.addEventListener('click', function (e) {
    var target = e.target;
    if (!target.classList.contains('tw')) return;
    var newIndex = parseInt(target.dataset.i, 10);
    if (isNaN(newIndex)) return;
    index = newIndex;
    showWord();
    if (playing) {
      clearTimeout(timer);
      scheduleNext();
    }
  });

  playPauseBtn.addEventListener('click', function () {
    if (playing) {
      pause();
    } else {
      play();
    }
  });

  backBtn.addEventListener('click', stepBack);
  forwardBtn.addEventListener('click', stepForward);

  // Speed slider
  speedSlider.addEventListener('input', function () {
    wpm = parseInt(speedSlider.value, 10);
    speedValue.textContent = wpm;
    if (playing) {
      clearTimeout(timer);
      scheduleNext();
    }
    updateProgress();
  });

  // Progress bar interaction
  progressBar.addEventListener('mousedown', function () { dragging = true; });
  progressBar.addEventListener('touchstart', function () { dragging = true; }, { passive: true });

  progressBar.addEventListener('input', function () {
    var pct = parseFloat(progressBar.value);
    index = Math.round((pct / 100) * (words.length - 1));
    showWord();
    if (playing) {
      clearTimeout(timer);
      scheduleNext();
    }
  });

  document.addEventListener('mouseup', function () { dragging = false; });
  document.addEventListener('touchend', function () { dragging = false; });

  // Keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    if (!readerView.classList.contains('active')) return;
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        playing ? pause() : play();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        stepBack();
        break;
      case 'ArrowRight':
        e.preventDefault();
        stepForward();
        break;
      case 'ArrowUp':
        e.preventDefault();
        wpm = Math.min(1000, wpm + 10);
        speedSlider.value = wpm;
        speedValue.textContent = wpm;
        if (playing) { clearTimeout(timer); scheduleNext(); }
        updateProgress();
        break;
      case 'ArrowDown':
        e.preventDefault();
        wpm = Math.max(60, wpm - 10);
        speedSlider.value = wpm;
        speedValue.textContent = wpm;
        if (playing) { clearTimeout(timer); scheduleNext(); }
        updateProgress();
        break;
      case 'Escape':
        switchToInput();
        break;
    }
  });
})();
