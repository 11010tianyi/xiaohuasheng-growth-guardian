/* 小花生成长护航计划 - 记录点滴 日记模块（家人共享版） */

(function() {
  'use strict';

  // ==================== State ====================

  var _entries = [];
  var _currentEntry = null;
  var _currentPage = 0;
  var PAGE_SIZE = 20;

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

  // ==================== CRUD ====================

  async function saveEntry(entryData) {
    var supabase = getSupabaseClient();
    if (!supabase) { console.error('[Diary] saveEntry: supabase 为空'); return { success: false, message: 'Supabase 未配置' }; }
    var session = getLocalSession();
    if (!session) { console.error('[Diary] saveEntry: session 为空'); return { success: false, message: '请先登录' }; }

    var rpcName = entryData.id ? 'update_diary_entry' : 'create_diary_entry';
    var params = entryData.id ? {
      p_entry_id: entryData.id,
      p_phone: session.phone,
      p_pin_hash: session.pinHash,
      p_content: entryData.content || '',
      p_photo_paths: entryData.photoPaths || [],
      p_mood: entryData.mood || '',
      p_tags: entryData.tags || []
    } : {
      p_phone: session.phone,
      p_pin_hash: session.pinHash,
      p_content: entryData.content || '',
      p_photo_paths: entryData.photoPaths || [],
      p_entry_date: entryData.entryDate,
      p_mood: entryData.mood || '',
      p_tags: entryData.tags || []
    };

    console.log('[Diary] saveEntry RPC:', rpcName, 'params:', JSON.stringify(params));
    var result = await supabase.rpc(rpcName, params);
    console.log('[Diary] saveEntry result:', JSON.stringify(result));

    if (result.error) {
      console.error('[Diary] saveEntry error:', result.error);
      return { success: false, message: result.error.message || 'RPC 调用失败' };
    }
    return result.data || { success: false, message: '保存失败' };
  }

  async function loadEntries(offset, limit) {
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

      return result.data.entries.map(function(row) {
        var tags = row.tags || [];
        var milestoneId = '';
        for (var t = 0; t < tags.length; t++) {
          if (tags[t].indexOf('📌 ') === 0) {
            var name = tags[t].replace(/^📌\s*/, '');
            var found = typeof findMilestoneByName === 'function' ? findMilestoneByName(name) : null;
            if (found) milestoneId = found.id;
          }
        }
        return {
          id: row.id,
          phone: row.phone,
          content: row.content || '',
          photoPaths: row.photo_paths || [],
          entryDate: row.entry_date,
          mood: row.mood,
          tags: tags,
          _milestoneId: milestoneId,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      });
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
  var CUSTOM_TAGS_KEY = 'diary-custom-tags';
  var _customTags = [];

  function loadCustomTags() {
    try { var s = localStorage.getItem(CUSTOM_TAGS_KEY); _customTags = s ? JSON.parse(s) : []; }
    catch(e) { _customTags = []; }
  }
  function saveCustomTags() {
    localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(_customTags));
  }

  function buildMilestoneItems() {
    if (typeof MILESTONES_DATA === 'undefined') return [];
    var items = [];
    var keys = ['0-1','1-2','2-3','3-4','4-5','5-6','6-7','7-8','8-9','9-10','vaccine','health','ceremony'];
    for (var i = 0; i < keys.length; i++) {
      var stage = MILESTONES_DATA[keys[i]];
      if (!stage || !stage.items) continue;
      for (var j = 0; j < stage.items.length; j++) {
        var it = stage.items[j];
        items.push({ id: it.id, name: it.title || it.name || it.id, category: stage.sheetName || keys[i] });
      }
    }
    return items;
  }

  window.initDiary = function(container) {
    if (!container) return;
    loadCustomTags();
    if (typeof window.injectDetailOverlayCSS === 'function') {
      window.injectDetailOverlayCSS();
    }

    if (!document.getElementById('gg-diary-ms-styles')) {
      var s = document.createElement('style');
      s.id = 'gg-diary-ms-styles';
      s.textContent = '.ms-chip{display:inline-flex;align-items:center;padding:4px 10px;background:#E8F0E5;color:#5A7A5A;border-radius:20px;font-size:0.8rem;font-weight:600;font-family:Nunito,sans-serif;gap:2px;}.ms-chip:hover{background:#D8E8D5;}.gg-milestone-tag{cursor:pointer;}';
      document.head.appendChild(s);
    }

    _milestoneItems = buildMilestoneItems();
    container.innerHTML = '';
    renderEditor(container);
    renderList(container);
    loadAndDisplay(container);
  };

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
          _customTags.map(function(t) {
            return '<span class="tag-option" data-tag="' + t.replace(/"/g,'&quot;') + '">' + t + '<span class="tag-remove" data-tag="' + t.replace(/"/g,'&quot;') + '">×</span></span>';
          }).join('') +
          '<span class="custom-tag-wrap"><input type="text" id="diary-custom-tag-input" class="custom-tag-input" placeholder="+自定义" maxlength="12"></span>' +
        '</div>' +
        '<div class="diary-milestone-selector" id="diary-milestone-area" style="margin-bottom:10px;">' +
          '<div id="diary-ms-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;"></div>' +
          '<button id="diary-add-ms-btn" type="button" style="padding:6px 14px;border:2px dashed #C5D5C0;border-radius:20px;background:transparent;color:#7A9A7A;font-size:0.85rem;cursor:pointer;width:100%;">📌 添加里程碑</button>' +
        '</div>' +
        '<textarea id="diary-content" class="diary-textarea" placeholder="写下今天的点滴…（支持 Markdown 格式）"></textarea>' +
        '<div id="diary-preview" class="diary-preview diary-detail-content" style="display:none"></div>' +
        '<div class="diary-editor-actions">' +
          '<button class="diary-preview-toggle" id="diary-preview-btn">👁 预览</button>' +
          '<div style="flex:1"></div>' +
          '<button class="diary-save-btn" id="diary-save-btn">保存</button>' +
          '<button class="diary-cancel-btn" id="diary-cancel-btn" style="display:none">取消</button>' +
        '</div>' +
        '<div class="diary-photo-area" id="diary-photos">' +
          '<label class="diary-photo-add" for="diary-photo-input">' +
            '<span>📷</span><small>添加照片</small>' +
          '</label>' +
          '<input type="file" id="diary-photo-input" accept="image/*" multiple style="display:none">' +
        '</div>' +
      '</div>';
    container.appendChild(editor);

    setupEditorEvents();
  }

  var _selectedMood = '';
  var _selectedTags = [];
  var _pendingPhotos = [];
  var _uploadedPhotoPaths = [];
  var _selectedMilestoneId = '';
  var _milestoneItems = [];

  function setupEditorEvents() {
    updateMsChips();

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

    var tagsContainer = document.getElementById('diary-tags');
    if (tagsContainer) {
      tagsContainer.addEventListener('click', function(e) {
        var rb = e.target.closest('.tag-remove');
        if (rb) {
          var tag = rb.getAttribute('data-tag');
          var ci = _customTags.indexOf(tag);
          if (ci >= 0) { _customTags.splice(ci, 1); saveCustomTags(); }
          var si = _selectedTags.indexOf(tag);
          if (si >= 0) _selectedTags.splice(si, 1);
          var opt = rb.closest('.tag-option');
          if (opt) opt.remove();
          return;
        }
        var tagEl = e.target.closest('.tag-option');
        if (!tagEl) return;
        var tag = tagEl.getAttribute('data-tag');
        var idx = _selectedTags.indexOf(tag);
        if (idx >= 0) {
          _selectedTags.splice(idx, 1);
          tagEl.classList.remove('selected');
        } else {
          _selectedTags.push(tag);
          tagEl.classList.add('selected');
        }
      });
    }

    var ci = document.getElementById('diary-custom-tag-input');
    if (ci) {
      ci.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } });
      ci.addEventListener('blur', addCustomTag);
    }

    var addMsBtn = document.getElementById('diary-add-ms-btn');
    if (addMsBtn) {
      addMsBtn.addEventListener('click', function() {
        openMilestonePicker();
      });
    }

    document.getElementById('diary-photo-input').addEventListener('change', function(e) {
      handlePhotoSelect(e.target.files);
    });

    document.getElementById('diary-save-btn').addEventListener('click', function() {
      handleSave();
    });

    document.getElementById('diary-cancel-btn').addEventListener('click', function() {
      resetEditor();
    });

    document.getElementById('diary-preview-btn').addEventListener('click', function() {
      togglePreview();
    });

    document.getElementById('diary-content').addEventListener('input', function() {
      var preview = document.getElementById('diary-preview');
      if (preview && preview.style.display !== 'none') {
        preview.innerHTML = renderMarkdown(this.value);
      }
    });
  }

  function updateMsChips() {
    var chipsEl = document.getElementById('diary-ms-chips');
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    var seen = {};
    _selectedTags.forEach(function(tag) {
      if (tag.indexOf('📌 ') !== 0) return;
      var name = tag.replace(/^📌\s*/, '');
      if (seen[name]) return;
      seen[name] = true;
      var chip = document.createElement('span');
      chip.className = 'ms-chip';
      chip.textContent = name;
      var x = document.createElement('span');
      x.textContent = ' ×';
      x.style.cssText = 'cursor:pointer;font-weight:700;margin-left:3px;color:#B84A4A;';
      x.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx2 = _selectedTags.indexOf(tag);
        if (idx2 >= 0) _selectedTags.splice(idx2, 1);
        var hasMs = _selectedTags.some(function(t) { return t.indexOf('📌 ') === 0; });
        if (!hasMs) _selectedMilestoneId = '';
        updateMsChips();
      });
      chip.appendChild(x);
      chipsEl.appendChild(chip);
    });
  }

  function openMilestonePicker() {
    var overlay = document.getElementById('diary-ms-picker-overlay');
    if (overlay) { overlay.style.display = 'flex'; return; }

    var overlay2 = document.createElement('div');
    overlay2.id = 'diary-ms-picker-overlay';
    overlay2.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2000;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:16px;padding:20px;max-width:480px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.18);';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '🔍 搜索里程碑...';
    input.style.cssText = 'width:100%;padding:10px 14px;border:2px solid #E8E8E8;border-radius:10px;font-size:0.95rem;margin-bottom:12px;box-sizing:border-box;outline:none;';
    panel.appendChild(input);

    var list = document.createElement('div');
    list.id = 'diary-ms-picker-list';
    panel.appendChild(list);

    overlay2.appendChild(panel);

    function renderPickerList(query) {
      list.innerHTML = '';
      var q = (query || '').toLowerCase();
      var currentCat = '';
      var items = _milestoneItems;
      items.forEach(function(item) {
        if (q && item.name.toLowerCase().indexOf(q) === -1) return;
        if (item.category !== currentCat) {
          currentCat = item.category;
          var catLabel = document.createElement('div');
          catLabel.textContent = currentCat;
          catLabel.style.cssText = 'font-size:0.8rem;font-weight:700;color:#7A9A7A;margin:10px 0 4px 4px;text-transform:uppercase;letter-spacing:1px;';
          list.appendChild(catLabel);
        }
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background 0.15s;';
        row.addEventListener('mouseenter', function() { this.style.background = '#F5F5F5'; });
        row.addEventListener('mouseleave', function() { this.style.background = ''; });

        var check = document.createElement('span');
        check.style.cssText = 'width:20px;height:20px;border:2px solid #C5D5C0;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;margin-right:10px;font-size:0.75rem;flex-shrink:0;';
        var selected = _selectedTags.indexOf('📌 ' + item.name) >= 0;
        if (selected) {
          check.style.cssText = 'width:20px;height:20px;background:#7AB87A;border:2px solid #7AB87A;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;margin-right:10px;color:#fff;font-size:0.75rem;flex-shrink:0;';
          check.textContent = '✓';
        }
        row.appendChild(check);

        var label = document.createElement('span');
        label.textContent = item.name;
        label.style.cssText = 'font-size:0.9rem;color:#4A4A4A;';
        row.appendChild(label);

        row.addEventListener('click', function() {
          var tag = '📌 ' + item.name;
          var idx = _selectedTags.indexOf(tag);
          if (idx >= 0) {
            _selectedTags.splice(idx, 1);
            var hasMs = _selectedTags.some(function(t) { return t.indexOf('📌 ') === 0; });
            if (!hasMs) _selectedMilestoneId = '';
          } else {
            _selectedTags.push(tag);
            _selectedMilestoneId = item.id || '';
          }
          updateMsChips();
          renderPickerList(input.value);
        });
        list.appendChild(row);
      });
    }

    input.addEventListener('input', function() { renderPickerList(this.value); });

    overlay2.addEventListener('click', function(e) {
      if (e.target === overlay2) overlay2.remove();
    });

    document.body.appendChild(overlay2);
    renderPickerList('');
    input.focus();
  }

  function togglePreview() {
    var textarea = document.getElementById('diary-content');
    var preview = document.getElementById('diary-preview');
    var btn = document.getElementById('diary-preview-btn');
    if (!textarea || !preview || !btn) return;

    if (preview.style.display === 'none') {
      preview.innerHTML = renderMarkdown(textarea.value);
      textarea.style.display = 'none';
      preview.style.display = 'block';
      btn.textContent = '✏️ 编辑';
    } else {
      textarea.style.display = 'block';
      preview.style.display = 'none';
      btn.textContent = '👁 预览';
    }
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

    try {
      var allPhotoPaths = _uploadedPhotoPaths.slice();
      var failedPhotos = 0;
      for (var i = 0; i < _pendingPhotos.length; i++) {
        var path = await uploadPhoto(_pendingPhotos[i]);
        if (path) allPhotoPaths.push(path);
        else failedPhotos++;
      }

      var finalTags = _selectedTags.slice();
      if (_selectedMilestoneId) {
        var msItem = typeof findMilestoneItem === 'function' ? findMilestoneItem(_selectedMilestoneId) : null;
        if (msItem) {
          var msTag = '📌 ' + (msItem.title || msItem.name || _selectedMilestoneId);
          if (finalTags.indexOf(msTag) < 0) {
            finalTags.push(msTag);
          }
        }
      }

      var entryData = {
        content: content,
        entryDate: entryDate,
        mood: _selectedMood,
        tags: finalTags,
        photoPaths: allPhotoPaths,
        _milestoneId: _selectedMilestoneId || ''
      };

      if (_currentEntry && _currentEntry.id) {
        entryData.id = _currentEntry.id;
      }

      console.log('[Diary] handleSave: calling saveEntry...');
      var result = await saveEntry(entryData);
      console.log('[Diary] handleSave: saveEntry returned', JSON.stringify(result));

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
    } catch(e) {
      console.error('[Diary] handleSave 异常:', e);
      showToastMsg('保存失败：' + (e.message || '请检查网络'));
    } finally {
      saveBtn.textContent = '保存';
      saveBtn.disabled = false;
    }
  }

  function addCustomTag() {
    var input = document.getElementById('diary-custom-tag-input');
    if (!input) return;
    var tag = input.value.trim();
    if (!tag) return;
    if (TAGS.indexOf(tag) >= 0 || _customTags.indexOf(tag) >= 0) {
      input.value = '';
      var existing = document.querySelector('.tag-option[data-tag="' + tag.replace(/"/g,'\\"') + '"]');
      if (existing && !existing.classList.contains('selected')) {
        _selectedTags.push(tag);
        existing.classList.add('selected');
      }
      return;
    }
    _customTags.push(tag);
    saveCustomTags();
    var span = document.createElement('span');
    span.className = 'tag-option';
    span.setAttribute('data-tag', tag);
    span.innerHTML = tag + '<span class="tag-remove" data-tag="' + tag.replace(/"/g,'&quot;') + '">×</span>';
    var wrap = document.querySelector('.custom-tag-wrap');
    if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(span, wrap);
    _selectedTags.push(tag);
    span.classList.add('selected');
    input.value = '';
  }

  function ensureTagOption(tag) {
    if (!tag || tag.indexOf('📌 ') === 0) return;
    if (TAGS.indexOf(tag) >= 0) return;
    var all = document.querySelectorAll('.tag-option');
    var found = false;
    all.forEach(function(el) { if (el.getAttribute('data-tag') === tag) found = true; });
    if (found) return;
    if (_customTags.indexOf(tag) < 0) { _customTags.push(tag); saveCustomTags(); }
    var span = document.createElement('span');
    span.className = 'tag-option';
    span.setAttribute('data-tag', tag);
    span.innerHTML = tag + '<span class="tag-remove" data-tag="' + tag.replace(/"/g,'&quot;') + '">×</span>';
    var wrap = document.querySelector('.custom-tag-wrap');
    if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(span, wrap);
  }

  function resetEditor() {
    _currentEntry = null;
    _selectedMood = '';
    _selectedTags = [];
    _pendingPhotos = [];
    _uploadedPhotoPaths = [];
    _selectedMilestoneId = '';

    var contentEl = document.getElementById('diary-content');
    if (contentEl) contentEl.value = '';

    var preview = document.getElementById('diary-preview');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    var previewBtn = document.getElementById('diary-preview-btn');
    if (previewBtn) previewBtn.textContent = '👁 预览';
    if (contentEl) contentEl.style.display = 'block';

    var moodOptions = document.querySelectorAll('.mood-option');
    moodOptions.forEach(function(m) { m.classList.remove('selected'); });

    var tagOptions = document.querySelectorAll('.tag-option');
    tagOptions.forEach(function(t) { t.classList.remove('selected'); });

    updateMsChips();

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
      renderPhotoWall(_entries);
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
    renderPhotoWall(_entries);
  }

  async function renderPhotoWall(entries) {
    var leftWall = document.getElementById('photo-wall-left');
    var rightWall = document.getElementById('photo-wall-right');
    var leftTrack = document.getElementById('photo-wall-track-left');
    var rightTrack = document.getElementById('photo-wall-track-right');
    if (!leftWall || !rightWall || !leftTrack || !rightTrack) return;

    var photos = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!entry.photoPaths || entry.photoPaths.length === 0) continue;
      for (var j = 0; j < entry.photoPaths.length; j++) {
        photos.push({ path: entry.photoPaths[j], phone: entry.phone, updatedAt: entry.updatedAt, createdAt: entry.createdAt });
      }
    }

    if (photos.length === 0) {
      leftWall.style.display = 'none';
      rightWall.style.display = 'none';
      return;
    }

    var leftHtml = '';
    var rightHtml = '';

    for (var k = 0; k < photos.length; k++) {
      var p = photos[k];
      var url = await getPhotoUrl(p.path);
      if (!url) continue;
      var author = typeof getFamilyIdentity === 'function' ? getFamilyIdentity(p.phone) : '';
      var timeSource = p.updatedAt || p.createdAt;
      var timeStr = (timeSource && typeof formatEditorTime === 'function') ? formatEditorTime(timeSource) : '';
      var item = '<div class="photo-wall-item" onclick="zoomPhoto(\'' + url.replace(/'/g, "\\'") + '\',\'' + escapeHtml(author).replace(/'/g, "\\'") + '\',\'' + timeStr + '\')">' +
        '<img class="photo-wall-thumb" src="' + url + '" loading="lazy" alt="日记照片">' +
        '<div class="photo-wall-meta"><span class="photo-wall-author">' + escapeHtml(author) + '</span> ' + timeStr + '</div>' +
      '</div>';
      if (k % 2 === 0) { leftHtml += item; } else { rightHtml += item; }
    }

    if (!leftHtml && !rightHtml) {
      leftWall.style.display = 'none';
      rightWall.style.display = 'none';
      return;
    }

    // Duplicate for seamless loop
    if (leftHtml) { leftTrack.innerHTML = leftHtml + leftHtml; leftWall.style.display = ''; }
    if (rightHtml) { rightTrack.innerHTML = rightHtml + rightHtml; rightWall.style.display = ''; }
  }

  function createEntryCard(entry) {
    var card = document.createElement('div');
    card.className = 'diary-entry-card';
    card.setAttribute('data-id', entry.id);

    var dateDisplay = formatDateDisplay(entry.entryDate);
    var preview = entry.content.length > 100 ? entry.content.substring(0, 100) + '...' : entry.content;
    var author = typeof getFamilyIdentity === 'function' ? getFamilyIdentity(entry.phone) : (entry.phone || '');
    var isOwner = typeof isCurrentUser === 'function' ? isCurrentUser(entry.phone) : false;

    var detailTime = '';
    var timeSource = entry.updatedAt || entry.createdAt;
    if (timeSource && typeof formatEditorTime === 'function') {
      detailTime = formatEditorTime(timeSource);
    }

    var moodHtml = entry.mood ? '<span class="diary-entry-mood">' + entry.mood + '</span>' : '';
    var tagsHtml = entry.tags && entry.tags.length > 0
      ? '<div class="diary-entry-tags">' + entry.tags.map(function(t) {
          if (t.indexOf('📌') === 0) {
            var mn = t.replace(/^📌\s*/, '');
            return '<span class="diary-tag gg-milestone-tag" data-milestone-name="' + escapeHtml(mn) + '">' + t + '</span>';
          }
          return '<span class="diary-tag">' + t + '</span>';
        }).join('') + '</div>'
      : '';
    var photoCount = entry.photoPaths && entry.photoPaths.length > 0
      ? '<span class="diary-photo-count">📷 ' + entry.photoPaths.length + '</span>'
      : '';

    var actionsHtml = isOwner
      ? '<div class="diary-entry-actions">' +
          '<button class="diary-edit-btn" data-id="' + entry.id + '">编辑</button>' +
          '<button class="diary-delete-btn" data-id="' + entry.id + '">删除</button>' +
        '</div>'
      : '';

    var authorLine = escapeHtml(author) + (detailTime ? ' ' + detailTime : '');
    card.innerHTML =
      '<div class="diary-entry-date">' + moodHtml + dateDisplay + '<span class="diary-entry-author"> · ' + authorLine + '</span></div>' +
      '<div class="diary-entry-preview">' + escapeHtml(preview) + '</div>' +
      tagsHtml +
      '<div class="diary-entry-footer">' +
        photoCount +
        actionsHtml +
      '</div>';

    if (isOwner) {
      card.querySelector('.diary-edit-btn').addEventListener('click', function() {
        editEntry(entry);
      });

      card.querySelector('.diary-delete-btn').addEventListener('click', function() {
        confirmDelete(entry);
      });
    }

    card.addEventListener('click', function(e) {
      var el = e.target;
      if (el.classList.contains('gg-milestone-tag')) {
        if (typeof showMilestoneDetailByName === 'function') {
          showMilestoneDetailByName(el.getAttribute('data-milestone-name'), e);
        }
        return;
      }
      if (el.tagName !== 'BUTTON') {
        showEntryDetail(entry);
      }
    });

    return card;
  }

  async function editEntry(entry) {
    _currentEntry = entry;
    _selectedMood = entry.mood || '';
    _selectedTags = entry.tags ? entry.tags.slice() : [];
    _selectedTags.forEach(ensureTagOption);
    _uploadedPhotoPaths = entry.photoPaths ? entry.photoPaths.slice() : [];
    _pendingPhotos = [];
    _selectedMilestoneId = entry._milestoneId || '';

    var contentEl = document.getElementById('diary-content');
    if (contentEl) { contentEl.value = entry.content; contentEl.style.display = 'block'; }

    var preview = document.getElementById('diary-preview');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    var previewBtn = document.getElementById('diary-preview-btn');
    if (previewBtn) previewBtn.textContent = '👁 预览';

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

    updateMsChips();

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

    var author = typeof getFamilyIdentity === 'function' ? getFamilyIdentity(entry.phone) : (entry.phone || '');
    var detailTime = '';
    var timeSource = entry.updatedAt || entry.createdAt;
    if (timeSource && typeof formatEditorTime === 'function') {
      detailTime = formatEditorTime(timeSource);
    }

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
      ? '<div class="diary-entry-tags">' + entry.tags.map(function(t) {
          if (t.indexOf('📌') === 0) {
            var mn = t.replace(/^📌\s*/, '');
            return '<span class="diary-tag gg-milestone-tag" data-milestone-name="' + escapeHtml(mn) + '">' + t + '</span>';
          }
          return '<span class="diary-tag">' + t + '</span>';
        }).join('') + '</div>'
      : '';

    var scienceHtml = '';
    var milestoneId = entry._milestoneId || '';
    if (milestoneId && typeof findMilestoneItem === 'function') {
      var msItem = findMilestoneItem(milestoneId);
      if (msItem && (msItem.scientificDetail || (msItem.sources && msItem.sources.length > 0))) {
        var msTitle = msItem.title || msItem.name || '';
        scienceHtml += '<div class="diary-detail-divider" style="height:1px;background:rgba(0,0,0,0.08);margin:16px 0;"></div>';
        scienceHtml += '<div class="diary-detail-heading" style="font-family:\'Noto Serif SC\',serif;font-size:1.1rem;font-weight:700;color:#2d2d2d;margin-bottom:8px;">📖 关联里程碑: ' + msTitle + '</div>';
        if (msItem.scientificDetail) {
          var renderFn = typeof renderMilestoneDetailMarkdown === 'function' ? renderMilestoneDetailMarkdown : function(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');};
          var detailPreview = renderFn(msItem.scientificDetail.length > 300 ? msItem.scientificDetail.substring(0, 300) + '…' : msItem.scientificDetail);
          var detailFull = renderFn(msItem.scientificDetail);
          scienceHtml += '<div class="diary-detail-science" style="font-size:0.9rem;line-height:1.7;color:#4A4A4A;">';
          scienceHtml += '<span class="gg-detail-preview">' + detailPreview + '</span>';
          if (msItem.scientificDetail.length > 300) {
            scienceHtml += '<span class="gg-detail-full" style="display:none;">' + detailFull + '</span>';
            scienceHtml += '<br><a href="javascript:void(0)" class="gg-detail-expand" style="color:#9CB89C;font-weight:600;">展开全部</a>';
          }
          scienceHtml += '</div>';
        }
        if (msItem.sources && msItem.sources.length > 0) {
          var srcList = '';
          for (var si = 0; si < msItem.sources.length; si++) {
            var s = msItem.sources[si];
            var srcUrl = s.url || '';
            var srcName = s.name || s;
            if (srcUrl) {
              srcList += '<div style="font-size:0.82rem;color:#7A7A7A;padding:2px 0;">· <a href="' + srcUrl + '" target="_blank" rel="noopener" style="color:#9CB89C;text-decoration:none;">' + srcName + '</a></div>';
            } else {
              srcList += '<div style="font-size:0.82rem;color:#7A7A7A;padding:2px 0;">· ' + srcName + '</div>';
            }
          }
          scienceHtml += '<div style="margin-top:10px;padding:10px 14px;background:rgba(244,168,150,0.08);border-radius:12px;"><div style="font-size:0.85rem;font-weight:700;color:#C08060;margin-bottom:6px;">📚 参考来源</div>' + srcList + '</div>';
        }
      }
    }

    overlay.innerHTML =
      '<div class="diary-detail-card">' +
        '<button class="diary-detail-close">&times;</button>' +
        '<div class="diary-detail-date">' + (entry.mood || '') + ' ' + formatDateDisplay(entry.entryDate) + '<span style="color:#9CB89C;font-size:0.85rem;margin-left:8px">' + escapeHtml(author) + (detailTime ? ' ' + detailTime : '') + '</span></div>' +
        '<div class="diary-detail-content">' + renderMarkdown(entry.content) + '</div>' +
        photosHtml +
        tagsHtml +
        scienceHtml +
      '</div>';

    document.body.appendChild(overlay);

    var expandBtn = overlay.querySelector('.gg-detail-expand');
    if (expandBtn) {
      expandBtn.addEventListener('click', function() {
        var preview = overlay.querySelector('.gg-detail-preview');
        var full = overlay.querySelector('.gg-detail-full');
        if (preview) preview.style.display = 'none';
        if (full) full.style.display = 'inline';
        this.style.display = 'none';
      });
    }

    overlay.querySelector('.diary-detail-close').addEventListener('click', function() {
      overlay.remove();
    });

    overlay.addEventListener('click', function(e) {
      if (e.target.classList.contains('gg-milestone-tag')) {
        if (typeof showMilestoneDetailByName === 'function') {
          showMilestoneDetailByName(e.target.getAttribute('data-milestone-name'), e);
        }
        return;
      }
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

  function renderMarkdown(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      marked.setOptions({ breaks: true, gfm: true });
      return DOMPurify.sanitize(marked.parse(text));
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  window.zoomPhoto = function(url, author, time) {
    var overlay = document.createElement('div');
    overlay.className = 'photo-zoom-overlay';
    overlay.innerHTML =
      '<button class="photo-zoom-close">&times;</button>' +
      '<img src="' + url + '">' +
      '<div class="photo-zoom-meta">' + author + (time ? ' ' + time : '') + '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.photo-zoom-close').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  };

})();
