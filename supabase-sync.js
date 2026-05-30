/* 小花生成长护航计划 - Supabase 实时同步模块 */

(function() {
  'use strict';

  var _supabase = null;
  var _channel = null;

  // ==================== SHA-256 Hash ====================

  async function sha256(text) {
    var encoder = new TextEncoder();
    var data = encoder.encode(text);
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // ==================== Session Management ====================

  var SESSION_KEY = 'gg_session';

  function saveSession(phone, phoneMasked, pinHash) {
    var session = { phone: phone, phoneMasked: phoneMasked, pinHash: pinHash, ts: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function getSession() {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e) { return null; }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  // ==================== Init ====================

  window.initSupabase = function() {
    if (!SUPABASE_CONFIG || !SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
      console.log('[Supabase] 未配置，跳过初始化');
      return;
    }
    if (/^__.*__$/.test(SUPABASE_CONFIG.url) || /^__.*__$/.test(SUPABASE_CONFIG.anonKey)) {
      console.log('[Supabase] 占位符未替换，跳过初始化');
      return;
    }
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.error('[Supabase] supabase-js 未加载');
      return;
    }
    try {
      _supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      console.log('[Supabase] 初始化成功');
      subscribeRealtime();
      restoreAuthUI();
    } catch(e) {
      console.error('[Supabase] 初始化失败:', e);
    }
  };

  // ==================== Login / Register ====================

  window.supabaseLogin = async function(phone, pin) {
    if (!_supabase) {
      showToast('Supabase 未配置，请先完成配置');
      return { success: false, message: 'Supabase 未配置' };
    }

    if (!phone || !/^\d{11}$/.test(phone)) {
      return { success: false, message: '请输入11位手机号' };
    }
    if (!pin || pin.length < 6) {
      return { success: false, message: 'PIN码至少6位' };
    }

    var pinHash = await sha256(pin);

    try {
      var result = await _supabase.rpc('login_user', {
        p_phone: phone,
        p_pin_hash: pinHash
      });

      if (result.data && result.data.success) {
        var masked = result.data.phone_masked || maskPhone(phone);
        saveSession(phone, masked, pinHash);
        restoreAuthUI();
        syncFromSupabase();
        return { success: true, message: result.data.message, isNew: result.data.is_new };
      } else {
        return { success: false, message: (result.data && result.data.message) || '验证失败' };
      }
    } catch(e) {
      console.error('[Supabase] login error:', e);
      return { success: false, message: '网络错误，请重试' };
    }
  };

  // ==================== Logout ====================

  window.supabaseLogout = function() {
    clearSession();
    restoreAuthUI();
    showToast('已退出登录');
  };

  // ==================== Toggle ====================

  window.supabaseToggle = async function(milestoneId, checked) {
    if (!_supabase) return;
    var session = getSession();
    if (!session) return;

    try {
      await _supabase.rpc('toggle_milestone', {
        p_milestone_id: milestoneId,
        p_checked: checked,
        p_phone: session.phone,
        p_pin_hash: session.pinHash
      });
    } catch(e) {
      console.error('[Supabase] toggle error:', e);
    }
  };

  // ==================== Load State from Supabase ====================

  window.getSupabaseCheckedState = async function() {
    if (!_supabase) return null;
    try {
      var result = await _supabase
        .from('milestone_checks')
        .select('milestone_id, checked, phone, updated_at');
      if (result.data) {
        return result.data;
      }
    } catch(e) {
      console.error('[Supabase] load error:', e);
    }
    return null;
  };

  // ==================== Sync from Supabase ====================

  async function syncFromSupabase() {
    var rows = await getSupabaseCheckedState();
    if (!rows) return;

    var checkedItems = [];
    var editorInfo = {};
    rows.forEach(function(row) {
      if (row.checked) {
        checkedItems.push(row.milestone_id);
      }
      editorInfo[row.milestone_id] = {
        phone: row.phone,
        updated_at: row.updated_at,
        checked: row.checked
      };
    });

    localStorage.setItem('checkedItems', JSON.stringify(checkedItems));
    localStorage.setItem('gg_editor_info', JSON.stringify(editorInfo));
    restoreCheckedState();
  }

  // ==================== Realtime Subscription ====================

  function subscribeRealtime() {
    if (!_supabase) return;
    _channel = _supabase
      .channel('milestone-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'milestone_checks' },
        function(payload) {
          if (payload.new) {
            updateLocalFromRemote(payload.new);
          }
        }
      )
      .subscribe(function(status) {
        console.log('[Supabase] Realtime status:', status);
      });
  }

  function updateLocalFromRemote(row) {
    if (!row || !row.milestone_id) return;

    var checkedItems = JSON.parse(localStorage.getItem('checkedItems') || '[]');
    var editorInfo = JSON.parse(localStorage.getItem('gg_editor_info') || '{}');

    if (row.checked) {
      if (checkedItems.indexOf(row.milestone_id) === -1) {
        checkedItems.push(row.milestone_id);
      }
    } else {
      checkedItems = checkedItems.filter(function(id) { return id !== row.milestone_id; });
    }

    editorInfo[row.milestone_id] = {
      phone: row.phone,
      updated_at: row.updated_at,
      checked: row.checked
    };

    localStorage.setItem('checkedItems', JSON.stringify(checkedItems));
    localStorage.setItem('gg_editor_info', JSON.stringify(editorInfo));

    updateSingleCard(row.milestone_id, row.checked, row.phone, row.updated_at);
    updateProgress();
  }

  function updateSingleCard(milestoneId, checked, phone, updatedAt) {
    var el = document.querySelector('.milestone-check[data-id="' + milestoneId + '"]');
    if (!el) return;

    if (checked) {
      el.classList.add('checked');
    } else {
      el.classList.remove('checked');
    }

    var card = el.closest('.milestone-card');
    if (!card) return;

    var editorEl = card.querySelector('.milestone-editor');
    if (editorEl) {
      if (phone && updatedAt) {
        editorEl.textContent = maskPhone(phone) + ' ' + formatTime(updatedAt);
        editorEl.style.display = '';
      } else {
        editorEl.style.display = 'none';
      }
    }
  }

  // ==================== Auth Helpers ====================

  window.isSupabaseLoggedIn = function() {
    return !!getSession();
  };

  window.getCurrentPhone = function() {
    var session = getSession();
    return session ? session.phoneMasked : '';
  };

  window.getCurrentPhoneRaw = function() {
    var session = getSession();
    return session ? session.phone : '';
  };

  function maskPhone(phone) {
    if (!phone || phone.length < 11) return phone;
    return phone.substring(0, 3) + '****' + phone.substring(7);
  }

  function formatTime(ts) {
    if (!ts) return '';
    // Supabase TIMESTAMPTZ returns UTC; ensure timezone suffix so JS parses as UTC
    if (typeof ts === 'string' && ts.length > 0 && !ts.endsWith('Z') && !/[+\-]\d{2}:\d{2}$/.test(ts) && !/[+\-]\d{4}$/.test(ts)) {
      ts = ts + '+00:00';
    }
    var d = new Date(ts);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + h + ':' + min;
  }

  window.maskPhone = maskPhone;
  window.formatEditorTime = formatTime;

  // ==================== Get Editor Info ====================

  window.getEditorInfo = function(milestoneId) {
    var editorInfo = JSON.parse(localStorage.getItem('gg_editor_info') || '{}');
    return editorInfo[milestoneId] || null;
  };

  // ==================== Auth UI ====================

  window.restoreAuthUI = function() {
    var session = getSession();
    var statusEl = document.getElementById('auth-status');
    var modalEl = document.getElementById('auth-modal');

    if (statusEl) {
      if (session) {
        statusEl.innerHTML = '<span class="auth-phone">' + session.phoneMasked + '</span> 已登录 <a href="javascript:void(0)" onclick="supabaseLogout()" class="auth-logout">退出</a>';
        statusEl.classList.add('logged-in');
      } else {
        statusEl.innerHTML = '<a href="javascript:void(0)" onclick="showAuthModal()" class="auth-login-link">🔐 登录</a>';
        statusEl.classList.remove('logged-in');
      }
    }

    if (modalEl && session) {
      modalEl.style.display = 'none';
    }
  };

  window.showAuthModal = function(pendingAction) {
    var modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    if (pendingAction) {
      modal.setAttribute('data-pending', '1');
    }
    var phoneInput = document.getElementById('auth-phone');
    if (phoneInput) phoneInput.focus();
  };

  window.hideAuthModal = function() {
    var modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
  };

  window.handleAuthSubmit = async function() {
    var phone = document.getElementById('auth-phone').value.trim();
    var pin = document.getElementById('auth-pin').value;
    var msgEl = document.getElementById('auth-message');

    var result = await supabaseLogin(phone, pin);
    if (result.success) {
      if (msgEl) {
        msgEl.textContent = result.message;
        msgEl.style.color = '#5A9A5A';
      }
      hideAuthModal();
      if (typeof _pendingToggle !== 'undefined' && _pendingToggle) {
        _pendingToggle();
        _pendingToggle = null;
      }
    } else {
      if (msgEl) {
        msgEl.textContent = result.message;
        msgEl.style.color = '#D47373';
      }
    }
  };

  var _pendingToggle = null;
  window.setPendingToggle = function(fn) {
    _pendingToggle = fn;
  };

})();
