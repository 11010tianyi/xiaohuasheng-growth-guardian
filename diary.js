/* 小花生成长护航计划 - 记录点滴 日记模块 */

(function() {
  'use strict';

  // ==================== State ====================

  var _entries = [];
  var _currentEntry = null;
  var _currentPage = 0;
  var PAGE_SIZE = 20;

  // ==================== Encryption Helpers ====================

  async function encryptContent(plaintext, key) {
    if (!key) throw new Error('加密密钥未初始化');
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var encoded = new TextEncoder().encode(plaintext);
    var ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv }, key, encoded
    );
    return JSON.stringify({
      iv: arrayToBase64(iv),
      data: arrayToBase64(ciphertext)
    });
  }

  async function decryptContent(encryptedJson, key) {
    if (!key) throw new Error('加密密钥未初始化');
    var encrypted = JSON.parse(encryptedJson);
    var iv = base64ToArray(encrypted.iv);
    var data = base64ToArray(encrypted.data);
    var decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv }, key, data
    );
    return new TextDecoder().decode(decrypted);
  }

  // ==================== Photo Handling ====================

  function compressPhoto(file, maxDim) {
    maxDim = maxDim || 1200;
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var w = img.width;
          var h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round(h * maxDim / w);
              w = maxDim;
            } else {
              w = Math.round(w * maxDim / h);
              h = maxDim;
            }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function(blob) {
            resolve(blob);
          }, 'image/jpeg', 0.8);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadPhoto(file) {
    var supabase = getSupabaseClient();
    if (!supabase) return null;
    var session = getLocalSession();
    if (!session) return null;

    var compressed = await compressPhoto(file);
    var ext = file.name.split('.').pop() || 'jpg';
    var filename = Date.now() + '-' + Math.random().toString(36).substring(2, 8) + '.' + ext;
    var path = session.phone + '/' + filename;

    var result = await supabase.storage
      .from('diary-photos')
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });

    if (result.error) {
      console.error('[Diary] 照片上传失败:', result.error);
      return null;
    }
    return path;
  }

  async function getPhotoUrl(path) {
    var supabase = getSupabaseClient();
    if (!supabase) return '';
    var result = await supabase.storage
      .from('diary-photos')
      .createSignedUrl(path, 3600);
    return result.data && result.data.signedUrl ? result.data.signedUrl : '';
  }

  async function deletePhoto(path) {
    var supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.storage.from('diary-photos').remove([path]);
  }

  // ==================== Helpers ====================

  function getLocalSession() {
    var raw = localStorage.getItem('gg_session');
    if (!raw) return null;
    try {
      var session = JSON.parse(raw);
      if (Date.now() - session.ts > 30 * 24 * 60 * 60 * 1000) return null;
      return session;
    } catch(e) { return null; }
  }

  function getEncryptionKey() {
    return typeof window.getEncryptionKey === 'function' ? window.getEncryptionKey() : null;
  }

  function getSupabaseClient() {
    return typeof window._getSupabaseInstance === 'function' ? window._getSupabaseInstance() : null;
  }

  function showToastMsg(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      alert(msg);
    }
  }

  function arrayToBase64(arr) {
    if (typeof window.arrayToBase64 === 'function') return window.arrayToBase64(arr);
    var binary = '';
    var bytes = new Uint8Array(arr);
    for (var i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToArray(base64) {
    if (typeof window.base64ToArray === 'function') return window.base64ToArray(base64);
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // ==================== CRUD ====================

  async function saveEntry(entryData) {
    var key = getEncryptionKey();
    if (!key) {
      showToastMsg('加密密钥未初始化，请重新登录');
      return { success: false, message: '加密密钥未初始化' };
    }

    var supabase = getSupabaseClient();
    if (!supabase) return { success: false, message: 'Supabase 未配置' };
    var session = getLocalSession();
    if (!session) return { success: false, message: '请先登录' };

    var encryptedContent = '';
    var contentIv = '';
    if (entryData.content && entryData.content.trim()) {
      var encrypted = await encryptContent(entryData.content, key);
      var parsed = JSON.parse(encrypted);
      encryptedContent = parsed.data;
      contentIv = parsed.iv;
    }

    if (entryData.id) {
      var result = await supabase.rpc('update_diary_entry', {
        p_entry_id: entryData.id,
        p_phone: session.phone,
        p_pin_hash: session.pinHash,
        p_content_encrypted: encryptedContent,
        p_content_iv: contentIv,
        p_photo_paths: entryData.photoPaths || [],
        p_mood: entryData.mood || '',
        p_tags: entryData.tags || []
      });
      return result.data || { success: false, message: '更新失败' };
    } else {
      var result = await supabase.rpc('create_diary_entry', {
        p_phone: session.phone,
        p_pin_hash: session.pinHash,
        p_content_encrypted: encryptedContent,
        p_content_iv: contentIv,
        p_photo_paths: entryData.photoPaths || [],
        p_entry_date: entryData.entryDate,
        p_mood: entryData.mood || '',
        p_tags: entryData.tags || []
      });
      return result.data || { success: false, message: '保存失败' };
    }
  }

  async function loadEntries(offset, limit) {
    var key = getEncryptionKey();
    if (!key) return [];

    var supabase = getSupabaseClient();
    if (!supabase) return [];
    var session = getLocalSession();
    if (!session) return [];

    try {
      var result = await supabase.rpc('get_diary_entries', {
        p_phone: session.phone,
        p_pin_hash: session.pinHash,
        p_limit: limit || PAGE_SIZE,
        p_offset: offset || 0
      });

      if (!result.data || !result.data.success || !result.data.entries) return [];

      var decrypted = [];
      for (var i = 0; i < result.data.entries.length; i++) {
        var row = result.data.entries[i];
        var content = '';
        if (row.content_encrypted && row.content_iv) {
          try {
            content = await decryptContent(
              JSON.stringify({ iv: row.content_iv, data: row.content_encrypted }),
              key
            );
          } catch(e) {
            content = '[解密失败]';
            console.error('[Diary] 解密失败:', e);
          }
        }
        decrypted.push({
          id: row.id,
          content: content,
          photoPaths: row.photo_paths || [],
          entryDate: row.entry_date,
          mood: row.mood,
          tags: row.tags || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      }
      return decrypted;
    } catch(e) {
      console.error('[Diary] 加载失败:', e);
      return [];
    }
  }

  async function removeEntry(entryId) {
    var supabase = getSupabaseClient();
    if (!supabase) return { success: false };
    var session = getLocalSession();
    if (!session) return { success: false };

    var result = await supabase.rpc('delete_diary_entry', {
      p_entry_id: entryId,
      p_phone: session.phone,
      p_pin_hash: session.pinHash
    });
    return result.data || { success: false };
  }

  // ==================== Rendering ====================

  var MOODS = [
    { emoji: '😊', label: '开心' },
    { emoji: '🥰', label: '幸福' },
    { emoji: '😍', label: '喜爱' },
    { emoji: '😅', label: '无奈' },
    { emoji: '😢', label: '难过' },
    { emoji: '🤒', label: '生病' },
    { emoji: '😴', label: '困倦' },
    { emoji: '😤', label: '生气' }
  ];

  var TAGS = ['第一次', '重要时刻', '趣事', '成长', '健康', '学校', '家庭', '旅行'];

  window.initDiary = function(container) {
    if (!container) return;

    container.innerHTML = '';

    var key = getEncryptionKey();
    if (!key) {
      renderKeyPrompt(container);
      return;
    }

    renderEditor(container);
    renderList(container);
    loadAndDisplay(container);
  };

  function renderKeyPrompt(container) {
    var prompt = document.createElement('div');
    prompt.className = 'diary-key-prompt';
    prompt.innerHTML =
      '<div class="diary-key-card">' +
        '<h3>🔐 需要验证身份以解密日记</h3>' +
        '<p>日记内容经过端到端加密，需要输入 PIN 码才能解密阅读</p>' +
        '<div class="diary-key-form">' +
          '<input type="password" id="diary-pin-input" placeholder="请输入 PIN 码" autocomplete="off">' +
          '<button class="diary-key-btn" id="diary-key-submit">解密</button>' +
        '</div>' +
        '<p class="diary-key-hint" id="diary-key-message"></p>' +
      '</div>';
    container.appendChild(prompt);

    document.getElementById('diary-key-submit').addEventListener('click', async function() {
      var pin = document.getElementById('diary-pin-input').value;
      if (!pin || pin.length < 6) {
        document.getElementById('diary-key-message').textContent = 'PIN码至少6位';
        document.getElementById('diary-key-message').style.color = '#D47373';
        return;
      }
      var success = await window.rederiveEncryptionKey(pin);
      if (success) {
        container.innerHTML = '';
        renderEditor(container);
        renderList(container);
        loadAndDisplay(container);
      } else {
        document.getElementById('diary-key-message').textContent = 'PIN码错误或验证失败';
        document.getElementById('diary-key-message').style.color = '#D47373';
      }
    });

    document.getElementById('diary-pin-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('diary-key-submit').click();
    });
  }

  function renderEditor(container) {
    var today = new Date();
    var dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    var editor = document.createElement('div');
    editor.className = 'diary-editor';
    editor.id = 'diary-editor';
    editor.innerHTML =
      '<div class="diary-editor-card">' +
        '<div class="diary-editor-header">' +
          '<input type="date" id="diary-date" value="' + dateStr + '" class="diary-date-input">' +
          '<div class="diary-mood-selector">' +
            MOODS.map(function(m) {
              return '<span class="mood-option" data-mood="' + m.emoji + '" title="' + m.label + '">' + m.emoji + '</span>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="diary-tag-selector" id="diary-tags">' +
          TAGS.map(function(t) {
            return '<span class="tag-option" data-tag="' + t + '">' + t + '</span>';
          }).join('') +
        '</div>' +
        '<textarea id="diary-content" class="diary-textarea" placeholder="写下今天的点滴..."></textarea>' +
        '<div class="diary-photo-area" id="diary-photos">' +
          '<label class="diary-photo-add" for="diary-photo-input">' +
            '<span>📷</span><small>添加照片</small>' +
          '</label>' +
          '<input type="file" id="diary-photo-input" accept="image/*" multiple style="display:none">' +
        '</div>' +
        '<div class="diary-editor-actions">' +
          '<button class="diary-save-btn" id="diary-save-btn">保存</button>' +
          '<button class="diary-cancel-btn" id="diary-cancel-btn" style="display:none">取消</button>' +
        '</div>' +
      '</div>';
    container.appendChild(editor);

    setupEditorEvents();
  }

  var _selectedMood = '';
  var _selectedTags = [];
  var _pendingPhotos = [];
  var _uploadedPhotoPaths = [];

  function setupEditorEvents() {
    var moodOptions = document.querySelectorAll('.mood-option');
    moodOptions.forEach(function(el) {
      el.addEventListener('click', function() {
        moodOptions.forEach(function(m) { m.classList.remove('selected'); });
        if (_selectedMood === el.getAttribute('data-mood')) {
          _selectedMood = '';
        } else {
          el.classList.add('selected');
          _selectedMood = el.getAttribute('data-mood');
        }
      });
    });

    var tagOptions = document.querySelectorAll('.tag-option');
    tagOptions.forEach(function(el) {
      el.addEventListener('click', function() {
        var tag = el.getAttribute('data-tag');
        var idx = _selectedTags.indexOf(tag);
        if (idx >= 0) {
          _selectedTags.splice(idx, 1);
          el.classList.remove('selected');
        } else {
          _selectedTags.push(tag);
          el.classList.add('selected');
        }
      });
    });

    document.getElementById('diary-photo-input').addEventListener('change', function(e) {
      handlePhotoSelect(e.target.files);
    });

    document.getElementById('diary-save-btn').addEventListener('click', function() {
      handleSave();
    });

    document.getElementById('diary-cancel-btn').addEventListener('click', function() {
      resetEditor();
    });
  }

  function handlePhotoSelect(files) {
    var photoArea = document.getElementById('diary-photos');
    for (var i = 0; i < files.length; i++) {
      _pendingPhotos.push(files[i]);
      var thumb = document.createElement('div');
      thumb.className = 'diary-photo-thumb';
      var img = document.createElement('img');
      img.src = URL.createObjectURL(files[i]);
      img.onload = function() { URL.revokeObjectURL(this.src); };
      var removeBtn = document.createElement('span');
      removeBtn.className = 'photo-remove';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('data-index', _pendingPhotos.length - 1);
      thumb.appendChild(img);
      thumb.appendChild(removeBtn);
      photoArea.insertBefore(thumb, photoArea.querySelector('.diary-photo-add'));
    }

    photoArea.addEventListener('click', function(e) {
      if (e.target.classList.contains('photo-remove')) {
        var idx = parseInt(e.target.getAttribute('data-index'));
        _pendingPhotos.splice(idx, 1);
        e.target.parentElement.remove();
      }
    });
  }

  async function handleSave() {
    var content = document.getElementById('diary-content').value;
    var entryDate = document.getElementById('diary-date').value;

    if (!content.trim() && _pendingPhotos.length === 0 && _uploadedPhotoPaths.length === 0) {
      showToastMsg('请输入内容或添加照片');
      return;
    }

    var saveBtn = document.getElementById('diary-save-btn');
    saveBtn.textContent = '保存中...';
    saveBtn.disabled = true;

    var allPhotoPaths = _uploadedPhotoPaths.slice();
    var failedPhotos = 0;
    for (var i = 0; i < _pendingPhotos.length; i++) {
      var path = await uploadPhoto(_pendingPhotos[i]);
      if (path) allPhotoPaths.push(path);
      else failedPhotos++;
    }

    var entryData = {
      content: content,
      entryDate: entryDate,
      mood: _selectedMood,
      tags: _selectedTags,
      photoPaths: allPhotoPaths
    };

    if (_currentEntry && _currentEntry.id) {
      entryData.id = _currentEntry.id;
    }

    var result = await saveEntry(entryData);
    if (result.success) {
      showToastMsg('保存成功');
      if (failedPhotos > 0) {
        showToastMsg(failedPhotos + '张照片上传失败');
      }
      resetEditor();
      var listContainer = document.getElementById('diary-list');
      if (listContainer) loadAndDisplay(listContainer.parentElement);
    } else {
      showToastMsg(result.message || '保存失败');
    }

    saveBtn.textContent = '保存';
    saveBtn.disabled = false;
  }

  function resetEditor() {
    _currentEntry = null;
    _selectedMood = '';
    _selectedTags = [];
    _pendingPhotos = [];
    _uploadedPhotoPaths = [];

    var contentEl = document.getElementById('diary-content');
    if (contentEl) contentEl.value = '';

    var moodOptions = document.querySelectorAll('.mood-option');
    moodOptions.forEach(function(m) { m.classList.remove('selected'); });

    var tagOptions = document.querySelectorAll('.tag-option');
    tagOptions.forEach(function(t) { t.classList.remove('selected'); });

    var cancelBtn = document.getElementById('diary-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    var photoArea = document.getElementById('diary-photos');
    if (photoArea) {
      var thumbs = photoArea.querySelectorAll('.diary-photo-thumb');
      thumbs.forEach(function(t) { t.remove(); });
    }

    var today = new Date();
    var dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var dateEl = document.getElementById('diary-date');
    if (dateEl) dateEl.value = dateStr;
  }

  function renderList(container) {
    var list = document.createElement('div');
    list.className = 'diary-list';
    list.id = 'diary-list';
    container.appendChild(list);
  }

  async function loadAndDisplay(container) {
    var listEl = document.getElementById('diary-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="diary-loading">加载中...</div>';

    _entries = await loadEntries(_currentPage * PAGE_SIZE, PAGE_SIZE);

    if (_entries.length === 0) {
      listEl.innerHTML = '<div class="diary-empty">还没有日记，写下第一条吧 ✨</div>';
      return;
    }

    listEl.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'diary-grid';

    for (var i = 0; i < _entries.length; i++) {
      var entry = _entries[i];
      var card = createEntryCard(entry);
      grid.appendChild(card);
    }

    listEl.appendChild(grid);
  }

  function createEntryCard(entry) {
    var card = document.createElement('div');
    card.className = 'diary-entry-card';
    card.setAttribute('data-id', entry.id);

    var dateDisplay = formatDateDisplay(entry.entryDate);
    var preview = entry.content.length > 100 ? entry.content.substring(0, 100) + '...' : entry.content;

    var moodHtml = entry.mood ? '<span class="diary-entry-mood">' + entry.mood + '</span>' : '';
    var tagsHtml = entry.tags && entry.tags.length > 0
      ? '<div class="diary-entry-tags">' + entry.tags.map(function(t) { return '<span class="diary-tag">' + t + '</span>'; }).join('') + '</div>'
      : '';
    var photoCount = entry.photoPaths && entry.photoPaths.length > 0
      ? '<span class="diary-photo-count">📷 ' + entry.photoPaths.length + '</span>'
      : '';

    card.innerHTML =
      '<div class="diary-entry-date">' + moodHtml + dateDisplay + '</div>' +
      '<div class="diary-entry-preview">' + escapeHtml(preview) + '</div>' +
      tagsHtml +
      '<div class="diary-entry-footer">' +
        photoCount +
        '<div class="diary-entry-actions">' +
          '<button class="diary-edit-btn" data-id="' + entry.id + '">编辑</button>' +
          '<button class="diary-delete-btn" data-id="' + entry.id + '">删除</button>' +
        '</div>' +
      '</div>';

    card.querySelector('.diary-edit-btn').addEventListener('click', function() {
      editEntry(entry);
    });

    card.querySelector('.diary-delete-btn').addEventListener('click', function() {
      confirmDelete(entry);
    });

    if (entry.photoPaths && entry.photoPaths.length > 0) {
      card.addEventListener('click', function(e) {
        if (e.target.tagName !== 'BUTTON') {
          showEntryDetail(entry);
        }
      });
    }

    return card;
  }

  async function editEntry(entry) {
    _currentEntry = entry;
    _selectedMood = entry.mood || '';
    _selectedTags = entry.tags ? entry.tags.slice() : [];
    _uploadedPhotoPaths = entry.photoPaths ? entry.photoPaths.slice() : [];
    _pendingPhotos = [];

    var contentEl = document.getElementById('diary-content');
    if (contentEl) contentEl.value = entry.content;

    var dateEl = document.getElementById('diary-date');
    if (dateEl) dateEl.value = entry.entryDate;

    var moodOptions = document.querySelectorAll('.mood-option');
    moodOptions.forEach(function(m) {
      m.classList.toggle('selected', m.getAttribute('data-mood') === _selectedMood);
    });

    var tagOptions = document.querySelectorAll('.tag-option');
    tagOptions.forEach(function(t) {
      t.classList.toggle('selected', _selectedTags.indexOf(t.getAttribute('data-tag')) >= 0);
    });

    var cancelBtn = document.getElementById('diary-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = '';

    var photoArea = document.getElementById('diary-photos');
    if (photoArea) {
      var existingThumbs = photoArea.querySelectorAll('.diary-photo-thumb');
      existingThumbs.forEach(function(t) { t.remove(); });

      if (entry.photoPaths && entry.photoPaths.length > 0) {
        for (var i = 0; i < entry.photoPaths.length; i++) {
          var thumb = document.createElement('div');
          thumb.className = 'diary-photo-thumb';
          var img = document.createElement('img');
          var url = await getPhotoUrl(entry.photoPaths[i]);
          img.src = url;
          thumb.appendChild(img);
          photoArea.insertBefore(thumb, photoArea.querySelector('.diary-photo-add'));
        }
      }
    }

    document.getElementById('diary-editor').scrollIntoView({ behavior: 'smooth' });
  }

  async function confirmDelete(entry) {
    if (!confirm('确定要删除这条日记吗？')) return;

    if (entry.photoPaths && entry.photoPaths.length > 0) {
      for (var i = 0; i < entry.photoPaths.length; i++) {
        try { await deletePhoto(entry.photoPaths[i]); } catch(e) { /* ignore */ }
      }
    }

    var result = await removeEntry(entry.id);
    if (result.success) {
      showToastMsg('已删除');
      loadAndDisplay(document.getElementById('diary-list').parentElement);
    } else {
      showToastMsg('删除失败');
    }
  }

  async function showEntryDetail(entry) {
    var overlay = document.createElement('div');
    overlay.className = 'diary-detail-overlay';

    var photosHtml = '';
    if (entry.photoPaths && entry.photoPaths.length > 0) {
      photosHtml = '<div class="diary-detail-photos">';
      for (var i = 0; i < entry.photoPaths.length; i++) {
        var url = await getPhotoUrl(entry.photoPaths[i]);
        photosHtml += '<img src="' + url + '" class="diary-detail-photo" loading="lazy">';
      }
      photosHtml += '</div>';
    }

    var tagsHtml = entry.tags && entry.tags.length > 0
      ? '<div class="diary-entry-tags">' + entry.tags.map(function(t) { return '<span class="diary-tag">' + t + '</span>'; }).join('') + '</div>'
      : '';

    overlay.innerHTML =
      '<div class="diary-detail-card">' +
        '<button class="diary-detail-close">&times;</button>' +
        '<div class="diary-detail-date">' + (entry.mood || '') + ' ' + formatDateDisplay(entry.entryDate) + '</div>' +
        '<div class="diary-detail-content">' + escapeHtml(entry.content).replace(/\n/g, '<br>') + '</div>' +
        photosHtml +
        tagsHtml +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('.diary-detail-close').addEventListener('click', function() {
      overlay.remove();
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ==================== Utility ====================

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

})();
