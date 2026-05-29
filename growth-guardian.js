/* 小花生成长护航计划 - 共享逻辑模块 */

(function() {
  'use strict';

  // ==================== ID Management ====================

  function getAllMilestoneIds() {
    var ids = [];
    var ageKeys = ['0-1','1-2','2-3','3-4','4-5','5-6','6-7','7-8','8-9','9-10'];
    ageKeys.forEach(function(key) {
      if (MILESTONES_DATA[key]) {
        MILESTONES_DATA[key].items.forEach(function(item) { ids.push(item.id); });
      }
    });
    ['vaccine','health','ceremony'].forEach(function(key) {
      if (MILESTONES_DATA[key]) {
        MILESTONES_DATA[key].items.forEach(function(item) { ids.push(item.id); });
      }
    });
    return ids;
  }

  function buildTitleToIdMap() {
    var map = {};
    var ageKeys = ['0-1','1-2','2-3','3-4','4-5','5-6','6-7','7-8','8-9','9-10'];
    ageKeys.forEach(function(key) {
      if (MILESTONES_DATA[key]) {
        MILESTONES_DATA[key].items.forEach(function(item) { map[item.title] = item.id; });
      }
    });
    return map;
  }

  // ==================== Legacy Migration ====================

  function migrateLegacyCheckedItems() {
    var raw = localStorage.getItem('checkedItems');
    if (!raw) return;
    var items = JSON.parse(raw);
    if (items.length === 0) return;
    var first = items[0];
    if (/^s\d{2}-\d{3}$/.test(first) || /^v-\d{3}$/.test(first) || /^h-\d{3}$/.test(first) || /^c-\d{3}$/.test(first)) {
      return;
    }
    var titleToId = buildTitleToIdMap();
    var newItems = [];
    items.forEach(function(title) {
      var id = titleToId[title];
      if (id) newItems.push(id);
    });
    localStorage.setItem('checkedItems', JSON.stringify(newItems));
  }

  // ==================== Check Toggle ====================

  window.toggleCheck = function(element) {
    var id = element.getAttribute('data-id');
    if (!id) return;

    if (typeof isSupabaseLoggedIn === 'function' && !isSupabaseLoggedIn()) {
      element.classList.remove('checked');
      if (typeof showAuthModal === 'function') {
        setPendingToggle(function() {
          element.classList.add('checked');
          doToggle(element, id, true);
        });
        showAuthModal(true);
      }
      return;
    }

    element.classList.toggle('checked');
    var isChecked = element.classList.contains('checked');
    doToggle(element, id, isChecked);
  };

  function doToggle(element, id, isChecked) {
    var checkedItems = JSON.parse(localStorage.getItem('checkedItems') || '[]');
    if (isChecked) {
      if (checkedItems.indexOf(id) === -1) checkedItems.push(id);
    } else {
      checkedItems = checkedItems.filter(function(item) { return item !== id; });
    }
    localStorage.setItem('checkedItems', JSON.stringify(checkedItems));

    var editorInfo = JSON.parse(localStorage.getItem('gg_editor_info') || '{}');
    var phone = (typeof getCurrentPhoneRaw === 'function') ? getCurrentPhoneRaw() : '';
    editorInfo[id] = { phone: phone, updated_at: new Date().toISOString(), checked: isChecked };
    localStorage.setItem('gg_editor_info', JSON.stringify(editorInfo));

    var editorEl = element.closest('.milestone-card');
    if (editorEl) {
      var eSpan = editorEl.querySelector('.milestone-editor');
      if (eSpan && phone) {
        eSpan.textContent = (typeof maskPhone === 'function' ? maskPhone(phone) : phone) + ' ' + (typeof formatEditorTime === 'function' ? formatEditorTime(editorInfo[id].updated_at) : '');
        eSpan.style.display = '';
      }
    }

    updateProgress();
    encodeCheckedToHash();
    if (typeof supabaseToggle === 'function') supabaseToggle(id, isChecked);
  }

  // ==================== Restore State ====================

  function restoreCheckedState() {
    var hashChecked = loadFromURLHash();
    if (hashChecked !== null) {
      localStorage.setItem('checkedItems', JSON.stringify(hashChecked));
    }
    var checkedItems = JSON.parse(localStorage.getItem('checkedItems') || '[]');
    var checkedSet = {};
    checkedItems.forEach(function(id) { checkedSet[id] = true; });
    var editorInfo = JSON.parse(localStorage.getItem('gg_editor_info') || '{}');
    document.querySelectorAll('.milestone-check[data-id]').forEach(function(el) {
      var mid = el.getAttribute('data-id');
      if (checkedSet[mid]) {
        el.classList.add('checked');
      }
      var card = el.closest('.milestone-card');
      if (card) {
        var eSpan = card.querySelector('.milestone-editor');
        if (eSpan) {
          var info = editorInfo[mid];
          if (info && info.phone && info.updated_at) {
            eSpan.textContent = (typeof maskPhone === 'function' ? maskPhone(info.phone) : info.phone) + ' ' + (typeof formatEditorTime === 'function' ? formatEditorTime(info.updated_at) : '');
            eSpan.style.display = '';
          } else {
            eSpan.style.display = 'none';
          }
        }
      }
    });
    updateProgress();
  }

  // ==================== URL Hash Encoding ====================

  function encodeCheckedToHash() {
    var checkedItems = JSON.parse(localStorage.getItem('checkedItems') || '[]');
    if (checkedItems.length === 0) {
      window.location.hash = '';
      return;
    }
    var shortIds = checkedItems.map(function(id) { return compressId(id); });
    if (typeof LZString !== 'undefined') {
      var compressed = LZString.compressToEncodedURIComponent(shortIds.join(','));
      window.location.hash = 's=' + compressed;
    } else {
      window.location.hash = 's=' + shortIds.join(',');
    }
  }

  function loadFromURLHash() {
    var hash = window.location.hash;
    if (!hash || hash.indexOf('s=') === -1) return null;
    var encoded = hash.substring(3);
    var data;
    if (typeof LZString !== 'undefined') {
      try {
        data = LZString.decompressFromEncodedURIComponent(encoded);
      } catch(e) {
        data = null;
      }
    }
    if (!data) {
      data = decodeURIComponent(encoded);
    }
    if (!data) return null;
    var shortIds = data.split(',');
    var allIds = getAllMilestoneIds();
    var idMap = {};
    allIds.forEach(function(id) { idMap[compressId(id)] = id; });
    var checked = [];
    shortIds.forEach(function(shortId) {
      var fullId = idMap[shortId];
      if (fullId) checked.push(fullId);
    });
    return checked.length > 0 ? checked : null;
  }

  function compressId(id) {
    var m = id.match(/^s(\d{2})-0*(\d+)$/);
    if (m) return 'a' + parseInt(m[1],10) + '-' + parseInt(m[2],10);
    m = id.match(/^v-0*(\d+)$/);
    if (m) return 'v' + parseInt(m[1],10);
    m = id.match(/^h-0*(\d+)$/);
    if (m) return 'h' + parseInt(m[1],10);
    m = id.match(/^c-0*(\d+)$/);
    if (m) return 'c' + parseInt(m[1],10);
    return id;
  }

  // ==================== Share ====================

  window.shareProgress = function() {
    encodeCheckedToHash();
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function() {
        showToast('链接已复制，可分享给家人！');
      });
    } else {
      var input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('链接已复制，可分享给家人！');
    }
  };

  // ==================== Progress ====================

  function updateProgress() {
    var checkedItems = JSON.parse(localStorage.getItem('checkedItems') || '[]');
    var total = document.querySelectorAll('.milestone-check[data-id]').length;
    var checked = 0;
    var checkedSet = {};
    checkedItems.forEach(function(id) { checkedSet[id] = true; });
    document.querySelectorAll('.milestone-check[data-id]').forEach(function(el) {
      if (checkedSet[el.getAttribute('data-id')]) checked++;
    });
    var progressBar = document.getElementById('progress-bar');
    var progressText = document.getElementById('progress-text');
    if (progressBar && total > 0) {
      progressBar.style.width = Math.round(checked / total * 100) + '%';
    }
    if (progressText) {
      progressText.textContent = checked + '/' + total + ' 已完成';
    }
  }

  // ==================== Toast ====================

  window.showToast = function(msg) {
    var existing = document.querySelector('.gg-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'gg-toast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#2d5016;color:#fff;padding:12px 28px;border-radius:30px;font-size:0.95rem;z-index:10000;opacity:0;transition:opacity 0.3s;box-shadow:0 4px 20px rgba(0,0,0,0.15);';
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.style.opacity = '1'; });
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 300);
    }, 2500);
  };

  // ==================== Excel Generation ====================

  window.generateExcel = function() {
    if (typeof XLSX === 'undefined') {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.onload = function() { doGenerateExcel(); };
      script.onerror = function() { showToast('Excel 库加载失败，请检查网络'); };
      document.head.appendChild(script);
      showToast('正在加载 Excel 组件...');
      return;
    }
    doGenerateExcel();
  };

  function doGenerateExcel() {
    var wb = XLSX.utils.book_new();
    var checkedItems = JSON.parse(localStorage.getItem('checkedItems') || '[]');
    var checkedSet = {};
    checkedItems.forEach(function(id) { checkedSet[id] = true; });
    var editorInfo = JSON.parse(localStorage.getItem('gg_editor_info') || '{}');

    // Overview sheet
    var overviewData = [
      ['\u{1F31F} 小花生成长护航计划 (0-10岁)'],
      ['在她每个需要我的节点都不错过，为她保驾护航'],
      [],
      ['阶段', '年龄段', '关键主题', '里程碑数量', '核心关注点', '状态']
    ];
    MILESTONES_DATA.overview.items.forEach(function(item) {
      overviewData.push([item.stage, item.age, item.theme, item.count, item.focus, item.status]);
    });
    var wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    wsOverview['!cols'] = [{wch:10},{wch:10},{wch:25},{wch:12},{wch:30},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsOverview, '总览时间轴');

    // Age stage sheets
    var ageKeys = ['0-1','1-2','2-3','3-4','4-5','5-6','6-7','7-8','8-9','9-10'];
    ageKeys.forEach(function(key) {
      var stage = MILESTONES_DATA[key];
      if (!stage) return;
      var headerCol = (key === '0-1' || key === '1-2' || key === '2-3') ? '月龄' : '时间';
      var sheetData = [[], [headerCol, '类别', '关键事项', '具体内容', '建议时间', '完成状态', '备注', '手机号', '最后编辑时间']];
      stage.items.forEach(function(item) {
        var status = checkedSet[item.id] ? '✅ 已完成' : '';
        var eInfo = editorInfo[item.id] || {};
        var ePhone = eInfo.phone ? (typeof maskPhone === 'function' ? maskPhone(eInfo.phone) : eInfo.phone) : '';
        var eTime = eInfo.updated_at ? (typeof formatEditorTime === 'function' ? formatEditorTime(eInfo.updated_at) : '') : '';
        sheetData.push([item.time, item.category, item.title, item.desc, item.suggestedTime, status, item.note, ePhone, eTime]);
      });
      var ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [{wch:10},{wch:14},{wch:22},{wch:40},{wch:14},{wch:10},{wch:14},{wch:14},{wch:18}];
      XLSX.utils.book_append_sheet(wb, ws, stage.sheetName.substring(0, 31));
    });

    // Vaccine sheet
    var vaccineData = [[], ['年龄', '疫苗名称', '剂次', '接种时间', '免费/自费', '重要性', '备注', '手机号', '最后编辑时间']];
    MILESTONES_DATA.vaccine.items.forEach(function(item) {
      var status = checkedSet[item.id] ? '✅ 已完成' : '';
      var eInfo = editorInfo[item.id] || {};
      var ePhone = eInfo.phone ? (typeof maskPhone === 'function' ? maskPhone(eInfo.phone) : eInfo.phone) : '';
      var eTime = eInfo.updated_at ? (typeof formatEditorTime === 'function' ? formatEditorTime(eInfo.updated_at) : '') : '';
      vaccineData.push([item.age, item.name, item.dose, item.time, item.cost, item.importance, item.note, ePhone, eTime]);
    });
    var wsVaccine = XLSX.utils.aoa_to_sheet(vaccineData);
    wsVaccine['!cols'] = [{wch:10},{wch:18},{wch:10},{wch:18},{wch:10},{wch:8},{wch:14},{wch:14},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsVaccine, '疫苗接种时间表');

    // Health checkup sheet
    var healthData = [[], ['年龄', '体检项目', '检查内容', '重要性', '完成状态', '备注', '手机号', '最后编辑时间']];
    MILESTONES_DATA.health.items.forEach(function(item) {
      var status = checkedSet[item.id] ? '✅ 已完成' : '';
      var eInfo = editorInfo[item.id] || {};
      var ePhone = eInfo.phone ? (typeof maskPhone === 'function' ? maskPhone(eInfo.phone) : eInfo.phone) : '';
      var eTime = eInfo.updated_at ? (typeof formatEditorTime === 'function' ? formatEditorTime(eInfo.updated_at) : '') : '';
      healthData.push([item.age, item.name, item.content, item.importance, status, item.note, ePhone, eTime]);
    });
    var wsHealth = XLSX.utils.aoa_to_sheet(healthData);
    wsHealth['!cols'] = [{wch:10},{wch:18},{wch:35},{wch:8},{wch:10},{wch:14},{wch:14},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsHealth, '体检时间表');

    // Ceremony sheet
    var ceremonyData = [[], ['年龄', '仪式名称', '仪式内容', '建议形式', '完成状态', '备注', '手机号', '最后编辑时间']];
    MILESTONES_DATA.ceremony.items.forEach(function(item) {
      var status = checkedSet[item.id] ? '✅ 已完成' : '';
      var eInfo = editorInfo[item.id] || {};
      var ePhone = eInfo.phone ? (typeof maskPhone === 'function' ? maskPhone(eInfo.phone) : eInfo.phone) : '';
      var eTime = eInfo.updated_at ? (typeof formatEditorTime === 'function' ? formatEditorTime(eInfo.updated_at) : '') : '';
      ceremonyData.push([item.age, item.name, item.content, item.form, status, item.note, ePhone, eTime]);
    });
    var wsCeremony = XLSX.utils.aoa_to_sheet(ceremonyData);
    wsCeremony['!cols'] = [{wch:10},{wch:16},{wch:30},{wch:18},{wch:10},{wch:14},{wch:14},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsCeremony, '重要仪式清单');

    // Instructions sheet
    var instrData = [
      ['使用说明'],
      [],
      ['项目简介', '这是为小花生量身定制的0-10岁成长护航计划，涵盖健康医疗、教育启蒙、情感陪伴三大维度。'],
      [],
      ['工作表说明', '1. 总览时间轴 - 0-10岁各阶段概览'],
      ['', '2-11. 各年龄段详细规划'],
      ['', '12. 疫苗接种时间表'],
      ['', '13. 体检时间表'],
      ['', '14. 重要仪式清单'],
      [],
      ['使用方法', '在"完成状态"列标记已完成来追踪进度'],
      [],
      ['在线版', 'https://11010tianyi.github.io/xiaohuasheng-growth-guardian/'],
      [],
      ['免责声明', '每个孩子的发育节奏不同，本计划仅供参考。如有疑问，请咨询专业儿科医生。']
    ];
    var wsInstr = XLSX.utils.aoa_to_sheet(instrData);
    wsInstr['!cols'] = [{wch:14},{wch:70}];
    XLSX.utils.book_append_sheet(wb, wsInstr, '使用说明');

    XLSX.writeFile(wb, '小花生成长护航计划.xlsx');
    showToast('Excel 已下载！');
  }

  // ==================== Category CSS class mapping ====================

  var categoryClassMap = {
    '🏥 健康医疗': 'category-health',
    '💉 疫苗接种': 'category-vaccine',
    '🧠 早教启蒙': 'category-earlyedu',
    '🧠 学习发展': 'category-earlyedu',
    '💝 情感陪伴': 'category-emotion',
    '📸 成长记录': 'category-record',
    '🍽️ 营养辅食': 'category-food',
    '🍽️ 营养饮食': 'category-food',
    '🏫 入园准备': 'category-earlyedu',
    '🏫 入园适应': 'category-earlyedu',
    '🏫 幼小衔接': 'category-earlyedu',
    '🏫 小学适应': 'category-earlyedu',
    '🏃 体能发展': 'category-record',
    '🎨 兴趣培养': 'category-emotion'
  };

  // ==================== Phase metadata ====================

  var phaseMeta = {
    '0-1': { icon: '👶', title: '0-1岁 生命初建', desc: '生命最初的12个月，建立安全感的关键时期', tip: '新生儿每天需要16-20小时睡眠，按需喂养，多进行肌肤接触建立安全感。6个月开始添加辅食，从高铁米粉开始。' },
    '1-2': { icon: '🚶', title: '1-2岁 探索世界', desc: '行走与语言爆发，探索欲望强烈', tip: '宝宝开始说"不"，这是自我意识发展的表现。提供安全探索环境，多进行户外活动和亲子阅读。' },
    '2-3': { icon: '🎨', title: '2-3岁 自我意识', desc: '第一叛逆期，入园准备开始', tip: '"可怕的两岁"是正常现象，给予选择而非命令。开始如厕训练，培养自理能力，为入园做准备。' },
    '3-4': { icon: '🏫', title: '3-4岁 幼儿园小班', desc: '社交拓展，适应集体生活', tip: '入园分离焦虑是正常的，温和告别、准时接送、建立信任。配合老师，关注孩子在园情况。' },
    '4-5': { icon: '🌟', title: '4-5岁 幼儿园中班', desc: '能力提升，兴趣培养', tip: '中班是逻辑思维发展关键期，多提供动手操作和思维训练的机会。开始前书写准备。' },
    '5-6': { icon: '🎓', title: '5-6岁 幼儿园大班', desc: '入学准备，习惯养成', tip: '大班最重要的是学习习惯培养：坐姿、握笔、听讲。建立任务意识，不拖延。' },
    '6-7': { icon: '📚', title: '6-7岁 小学一年级', desc: '适应期，建立学习习惯', tip: '入学适应期最需要陪伴，放学后倾听、关注情绪。与老师沟通，配合教育。建立作业习惯。' },
    '7-8': { icon: '✨', title: '7-8岁 小学二年级', desc: '巩固期，阅读关键', tip: '二年级是习惯定型期和阅读关键期。巩固预习、听课、复习、作业流程。培养章节书阅读。' },
    '8-9': { icon: '🚀', title: '8-9岁 小学三年级', desc: '转折期，学科分化', tip: '三年级是"分水岭"，关注学科分化。英语能力要全面提升。独立学习能力开始培养。' },
    '9-10': { icon: '🌈', title: '9-10岁 小学高年级', desc: '成长期，价值观形成', tip: '高年级关注学业规划和价值观引导。青春期前期，开始性教育启蒙。培养独立思考能力。' }
  };

  // ==================== Render Milestones ====================

  window.renderMilestones = function(container, config) {
    if (!container || !config) return;
    var phases = config.phases || [];
    var html = '';

    phases.forEach(function(key, idx) {
      var stage = MILESTONES_DATA[key];
      if (!stage) return;
      var meta = phaseMeta[key] || { icon: '📋', title: stage.sheetName, desc: '', tip: '' };

      html += '<div class="phase-section' + (idx === 0 ? ' active' : '') + '" id="phase-' + key + '">';

      html += '<div class="phase-header">';
      html += '<h2>' + meta.icon + ' ' + meta.title + '</h2>';
      html += '<p>' + meta.desc + '</p>';
      html += '</div>';

      if (meta.tip) {
        html += '<div class="tip-box">';
        html += '<h3>💡 育儿提示</h3>';
        html += '<p>' + meta.tip + '</p>';
        html += '</div>';
      }

      html += '<div class="milestones-grid">';
      stage.items.forEach(function(item) {
        var catClass = categoryClassMap[item.category] || 'category-health';
        html += '<div class="milestone-card">';
        html += '<div class="milestone-category ' + catClass + '">' + item.category + '</div>';
        html += '<h3 class="milestone-title">' + item.title + '</h3>';
        html += '<p class="milestone-desc">' + item.desc + '</p>';
        html += '<div class="milestone-meta">';
        html += '<span class="milestone-time">📅 ' + item.suggestedTime + '</span>';
        if (item.note) html += '<span class="milestone-note">' + item.note + '</span>';
        html += '<span class="milestone-editor" style="display:none;font-size:0.8rem;color:#9CB89C;"></span>';
        html += '<div class="milestone-check" data-id="' + item.id + '" onclick="toggleCheck(this)"></div>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    });

    container.innerHTML = html;
    restoreCheckedState();
  };

  // ==================== Render Vaccine & Health ====================

  window.renderHealth = function(container) {
    if (!container) return;
    var html = '';

    html += '<div class="phase-section active" id="phase-vaccine">';
    html += '<h2 style="text-align:center;margin-bottom:30px;font-family:\'Noto Serif SC\',serif;color:#2d5016;">💉 疫苗接种时间表</h2>';
    html += '<div class="milestone-grid">';
    MILESTONES_DATA.vaccine.items.forEach(function(item) {
      html += '<div class="milestone-card">';
      html += '<div class="milestone-category">' + item.importance + ' · ' + item.cost + '</div>';
      html += '<h3 class="milestone-title">' + item.name + ' ' + item.dose + '</h3>';
      html += '<p class="milestone-desc">' + item.age + ' | ' + item.time + '</p>';
      if (item.note) html += '<div class="milestone-meta"><span class="milestone-note">' + item.note + '</span></div>';
      html += '<span class="milestone-editor" style="display:none;font-size:0.8rem;color:#9CB89C;"></span>';
      html += '<div class="milestone-check" data-id="' + item.id + '" onclick="toggleCheck(this)"></div>';
      html += '</div>';
    });
    html += '</div></div>';

    html += '<div class="phase-section" id="phase-health">';
    html += '<h2 style="text-align:center;margin-bottom:30px;font-family:\'Noto Serif SC\',serif;color:#2d5016;">🏥 体检时间表</h2>';
    html += '<div class="milestone-grid">';
    MILESTONES_DATA.health.items.forEach(function(item) {
      html += '<div class="milestone-card">';
      html += '<div class="milestone-category">' + item.importance + '</div>';
      html += '<h3 class="milestone-title">' + item.name + '</h3>';
      html += '<p class="milestone-desc">' + item.content + '</p>';
      html += '<div class="milestone-meta"><span class="milestone-time">' + item.age + '</span>';
      html += '<span class="milestone-editor" style="display:none;font-size:0.8rem;color:#9CB89C;"></span></div>';
      html += '<div class="milestone-check" data-id="' + item.id + '" onclick="toggleCheck(this)"></div>';
      html += '</div>';
    });
    html += '</div></div>';

    container.innerHTML = html;
    restoreCheckedState();
  };

  // ==================== Render Ceremonies ====================

  window.renderCeremony = function(container) {
    if (!container) return;
    var html = '<div class="phase-section active">';
    html += '<h2 style="text-align:center;margin-bottom:30px;font-family:\'Noto Serif SC\',serif;color:#2d5016;">💝 成长重要仪式清单</h2>';
    html += '<div class="milestone-grid">';
    MILESTONES_DATA.ceremony.items.forEach(function(item) {
      html += '<div class="milestone-card">';
      html += '<div class="milestone-category">' + item.age + '</div>';
      html += '<h3 class="milestone-title">' + item.name + '</h3>';
      html += '<p class="milestone-desc">' + item.content + '</p>';
      html += '<div class="milestone-meta">';
      html += '<span class="milestone-time">' + item.form + '</span>';
      if (item.note) html += '<span class="milestone-note">' + item.note + '</span>';
      html += '<span class="milestone-editor" style="display:none;font-size:0.8rem;color:#9CB89C;"></span>';
      html += '</div>';
      html += '<div class="milestone-check" data-id="' + item.id + '" onclick="toggleCheck(this)"></div>';
      html += '</div>';
    });
    html += '</div></div>';
    container.innerHTML = html;
    restoreCheckedState();
  };

  // ==================== Timeline Switching ====================

  window.initTimeline = function() {
    var timelineBtns = document.querySelectorAll('.timeline-btn');
    var phaseSections = document.querySelectorAll('.phase-section');
    timelineBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        timelineBtns.forEach(function(b) { b.classList.remove('active'); });
        phaseSections.forEach(function(s) { s.classList.remove('active'); });
        btn.classList.add('active');
        var phaseId = btn.getAttribute('data-phase');
        var target = document.getElementById(phaseId);
        if (target) target.classList.add('active');
      });
    });
  };

  // ==================== Auth Modal & CSS ====================

  window.injectAuthUI = function() {
    var style = document.createElement('style');
    style.textContent = '\
.auth-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10001;align-items:center;justify-content:center;}\
.auth-card{background:#fff;border-radius:24px;padding:40px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.15);text-align:center;}\
.auth-card h2{font-family:"Noto Serif SC",serif;margin-bottom:10px;font-size:1.5rem;}\
.auth-card p{color:#7A7A7A;font-size:0.9rem;margin-bottom:20px;}\
.auth-card input{width:100%;padding:14px 18px;border:2px solid #E8E8E8;border-radius:14px;font-size:1rem;font-family:Nunito,sans-serif;margin-bottom:12px;outline:none;transition:border-color 0.3s;}\
.auth-card input:focus{border-color:#9CB89C;}\
.auth-card button{width:100%;padding:14px;background:linear-gradient(135deg,#9CB89C,#C5D5C0);color:#fff;border:none;border-radius:14px;font-size:1rem;font-weight:700;font-family:Nunito,sans-serif;cursor:pointer;transition:transform 0.2s;}\
.auth-card button:hover{transform:translateY(-2px);}\
#auth-message{font-size:0.85rem;min-height:20px;margin-top:8px;}\
.auth-hint{font-size:0.8rem;color:#7A7A7A;margin-top:12px;}\
#auth-status{position:fixed;top:72px;right:60px;z-index:999;font-size:0.85rem;font-weight:600;}\
#auth-status .auth-phone{color:#9CB89C;}\
#auth-status .auth-logout{color:#D47373;text-decoration:none;margin-left:8px;font-weight:600;}\
#auth-status .auth-login-link{color:#9CB89C;text-decoration:none;font-weight:700;cursor:pointer;}\
@media(max-width:768px){#auth-status{right:30px;top:65px;font-size:0.8rem;}}\
';
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-overlay';
    modal.innerHTML = '<div class="auth-card">\
<h2>🔐 身份验证</h2>\
<p>需要验证身份才能编辑打卡</p>\
<input type="tel" id="auth-phone" placeholder="手机号（11位数字）" maxlength="11">\
<input type="password" id="auth-pin" placeholder="PIN码（至少6位）" maxlength="20">\
<button onclick="handleAuthSubmit()">验证</button>\
<div id="auth-message"></div>\
<p class="auth-hint">首次输入自动注册</p>\
</div>';
    document.body.appendChild(modal);

    var statusDiv = document.createElement('div');
    statusDiv.id = 'auth-status';
    document.body.appendChild(statusDiv);

    modal.addEventListener('click', function(e) {
      if (e.target === modal) hideAuthModal();
    });

    var pinInput = document.getElementById('auth-pin');
    if (pinInput) {
      pinInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleAuthSubmit();
      });
    }
  };

  // ==================== Init ====================

  window.initGrowthGuardian = function() {
    migrateLegacyCheckedItems();
    injectAuthUI();
    if (typeof initSupabase === 'function') initSupabase();
  };

})();
