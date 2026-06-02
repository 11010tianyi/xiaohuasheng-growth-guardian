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

  // ==================== Cross-Section Link Map ====================
  // Maps IDs across different sections (milestone ↔ health/vaccine/ceremony)
  // that represent the same real-world task.

  var ITEM_LINKS = (function() {
    var groups = [
      ['s01-002', 'h-001'],
      ['s01-005', 'v-001'],
      ['s01-006', 'v-002'],
      ['s01-011', 'h-002'],
      ['s01-012', 'v-003'],
      ['s01-013', 'v-005'],
      ['s01-014', 'v-006'],
      ['s01-015', 'v-007'],
      ['s01-021', 'v-010'],
      ['s01-022', 'v-011'],
      ['s01-023', 'v-016'],
      ['s01-031', 'v-018'],
      ['s01-032', 'v-019', 'v-024'],
      ['s01-033', 'v-020'],
      ['s01-034', 's07-011', 'v-021'],
      ['s01-040', 'h-006'],
      ['s01-041', 'v-022'],
      ['s01-042', 'v-023'],
      ['s02-002', 'v-025'],
      ['s02-003', 'v-028'],
      ['s02-011', 'h-007'],
      ['s02-012', 'v-027'],
      ['s02-013', 's03-002', 'v-031'],
      ['s02-014', 'v-029'],
      ['s02-022', 's07-010', 'h-016'],
      ['s02-030', 'h-008'],
      ['s02-031', 'v-030'],
      ['s01-007', 'c-001'],
      ['s01-008', 'c-002'],
      ['s01-019', 'c-003'],
      ['s01-029', 'c-004'],
      ['s01-049', 'c-005'],
      ['s06-019', 'c-008'],
      ['s02-038', 'c-006'],
      ['s03-001', 'h-009'],
      ['s03-016', 'h-010'],
      ['s03-017', 'v-032'],
      ['s03-018', 'v-033'],
      ['s03-025', 'c-007'],
      ['s04-005', 'h-011'],
      ['s04-006', 'v-037'],
      ['s04-007', 'v-034'],
      ['s04-018', 'h-012'],
      ['s04-019', 'v-035'],
      ['s04-024', 'c-009'],
      ['s05-011', 'h-013'],
      ['s05-017', 'c-010'],
      ['s06-012', 'h-014'],
      ['s06-013', 'v-036'],
      ['s06-020', 'c-011'],
      ['s07-017', 'c-012'],
      ['s08-008', 'c-013'],
      ['s08-010', 's10-009', 'h-015'],
      ['s09-007', 'c-014'],
      ['s10-006', 'c-015']
    ];
    var map = {};
    groups.forEach(function(group) {
      group.forEach(function(id) {
        map[id] = group.filter(function(x) { return x !== id; });
      });
    });
    return map;
  })();

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

  function toggleLinkedItems(linkedIds, isChecked) {
    if (!linkedIds || linkedIds.length === 0) return;
    var checkedItems = JSON.parse(localStorage.getItem('checkedItems') || '[]');
    var editorInfo = JSON.parse(localStorage.getItem('gg_editor_info') || '{}');
    var phone = (typeof getCurrentPhoneRaw === 'function') ? getCurrentPhoneRaw() : '';
    var now = new Date().toISOString();

    linkedIds.forEach(function(lid) {
      if (isChecked) {
        if (checkedItems.indexOf(lid) === -1) checkedItems.push(lid);
      } else {
        checkedItems = checkedItems.filter(function(item) { return item !== lid; });
      }
      editorInfo[lid] = { phone: phone, updated_at: now, checked: isChecked };
      var el = document.querySelector('.milestone-check[data-id="' + lid + '"]');
      if (el) {
        if (isChecked) el.classList.add('checked');
        else el.classList.remove('checked');
      }
      if (typeof supabaseToggle === 'function') supabaseToggle(lid, isChecked);
    });

    localStorage.setItem('checkedItems', JSON.stringify(checkedItems));
    localStorage.setItem('gg_editor_info', JSON.stringify(editorInfo));
  }

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
        eSpan.textContent = (typeof getFamilyIdentity === 'function' ? getFamilyIdentity(phone) : phone) + ' ' + (typeof formatEditorTime === 'function' ? formatEditorTime(editorInfo[id].updated_at) : '');
        eSpan.style.display = '';
      }
    }

    toggleLinkedItems(ITEM_LINKS[id], isChecked);
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
            eSpan.textContent = (typeof getFamilyIdentity === 'function' ? getFamilyIdentity(info.phone) : info.phone) + ' ' + (typeof formatEditorTime === 'function' ? formatEditorTime(info.updated_at) : '');
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
        var ePhone = eInfo.phone ? (typeof getFamilyIdentity === 'function' ? getFamilyIdentity(eInfo.phone) : eInfo.phone) : '';
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
      var ePhone = eInfo.phone ? (typeof getFamilyIdentity === 'function' ? getFamilyIdentity(eInfo.phone) : eInfo.phone) : '';
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
      var ePhone = eInfo.phone ? (typeof getFamilyIdentity === 'function' ? getFamilyIdentity(eInfo.phone) : eInfo.phone) : '';
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
      var ePhone = eInfo.phone ? (typeof getFamilyIdentity === 'function' ? getFamilyIdentity(eInfo.phone) : eInfo.phone) : '';
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
        html += '<div class="milestone-card" data-milestone-id="' + item.id + '" onclick="showMilestoneDetail(this, event)">';
        html += '<div class="milestone-category ' + catClass + '">' + item.category + '</div>';
        html += '<h3 class="milestone-title">' + item.title + '</h3>';
        html += '<p class="milestone-desc">' + item.desc + '</p>';
        html += '<div class="milestone-meta">';
        html += '<span class="milestone-time">📅 ' + item.suggestedTime + '　　⏰ ' + item.time + '</span>';
        if (item.note) html += '<span class="milestone-note">' + item.note + '</span>';
        html += '<span class="milestone-editor" style="display:none;font-size:0.8rem;color:#9CB89C;"></span>';
        html += '<div class="milestone-check" data-id="' + item.id + '" onclick="event.stopPropagation();toggleCheck(this)"></div>';
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
      html += '<div class="milestone-card" data-milestone-id="' + item.id + '" onclick="showMilestoneDetail(this, event)">';
      html += '<div class="milestone-category">' + item.importance + ' · ' + item.cost + '</div>';
      html += '<h3 class="milestone-title">' + item.name + ' ' + item.dose + '</h3>';
      html += '<p class="milestone-desc">' + item.age + ' | ' + item.time + '</p>';
      if (item.note) html += '<div class="milestone-meta"><span class="milestone-note">' + item.note + '</span></div>';
      html += '<span class="milestone-editor" style="display:none;font-size:0.8rem;color:#9CB89C;"></span>';
      html += '<div class="milestone-check" data-id="' + item.id + '" onclick="event.stopPropagation();toggleCheck(this)"></div>';
      html += '</div>';
    });
    html += '</div></div>';

    html += '<div class="phase-section" id="phase-health">';
    html += '<h2 style="text-align:center;margin-bottom:30px;font-family:\'Noto Serif SC\',serif;color:#2d5016;">🏥 体检时间表</h2>';
    html += '<div class="milestone-grid">';
    MILESTONES_DATA.health.items.forEach(function(item) {
      html += '<div class="milestone-card" data-milestone-id="' + item.id + '" onclick="showMilestoneDetail(this, event)">';
      html += '<div class="milestone-category">' + item.importance + '</div>';
      html += '<h3 class="milestone-title">' + item.name + '</h3>';
      html += '<p class="milestone-desc">' + item.content + '</p>';
      html += '<div class="milestone-meta"><span class="milestone-time">' + item.age + '</span>';
      html += '<span class="milestone-editor" style="display:none;font-size:0.8rem;color:#9CB89C;"></span></div>';
      html += '<div class="milestone-check" data-id="' + item.id + '" onclick="event.stopPropagation();toggleCheck(this)"></div>';
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
      html += '<div class="milestone-card" data-milestone-id="' + item.id + '" onclick="showMilestoneDetail(this, event)">';
      html += '<div class="milestone-category">' + item.age + '</div>';
      html += '<h3 class="milestone-title">' + item.name + '</h3>';
      html += '<p class="milestone-desc">' + item.content + '</p>';
      html += '<div class="milestone-meta">';
      html += '<span class="milestone-time">' + item.form + '</span>';
      if (item.note) html += '<span class="milestone-note">' + item.note + '</span>';
      html += '<span class="milestone-editor" style="display:none;font-size:0.8rem;color:#9CB89C;"></span>';
      html += '</div>';
      html += '<div class="milestone-check" data-id="' + item.id + '" onclick="event.stopPropagation();toggleCheck(this)"></div>';
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
        var target = document.getElementById('phase-' + phaseId) || document.getElementById(phaseId);
        if (target) target.classList.add('active');
      });
    });
  };

  // ==================== Auth Modal & CSS ====================

  window.injectAuthUI = function() {
    if (document.getElementById('auth-modal')) return; // 已存在，不重复创建
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
<p class="auth-hint">请使用已注册的手机号和PIN码</p>\
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

  // ==================== Detail Overlay ====================

  window.injectDetailOverlayCSS = function() {
    if (document.getElementById('gg-overlay-style')) return;
    var style = document.createElement('style');
    style.id = 'gg-overlay-style';
    style.textContent = '\
.milestone-card{cursor:pointer;}\
.gg-detail-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);backdrop-filter:blur(5px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;}\
.gg-detail-card{background:#fff;border-radius:24px;padding:32px;max-width:620px;width:100%;max-height:80vh;overflow-y:auto;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.15);}\
.gg-detail-close{position:absolute;top:14px;right:14px;width:32px;height:32px;border:none;background:rgba(0,0,0,0.06);border-radius:50%;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#7A7A7A;transition:background 0.2s;}\
.gg-detail-close:hover{background:rgba(0,0,0,0.1);}\
.gg-detail-category{display:inline-block;padding:4px 12px;border-radius:10px;font-size:0.8rem;font-weight:600;margin-bottom:10px;}\
.gg-detail-title{font-family:"Noto Serif SC",serif;font-size:1.5rem;font-weight:700;margin-bottom:8px;color:#2d2d2d;}\
.gg-detail-meta{font-size:0.9rem;color:#7A7A7A;margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap;}\
.gg-detail-desc{font-size:1rem;color:#4A4A4A;line-height:1.7;margin-bottom:16px;padding:14px 16px;background:rgba(156,184,156,0.08);border-radius:14px;}\
.gg-detail-divider{height:1px;background:rgba(0,0,0,0.08);margin:20px 0;}\
.gg-detail-heading{font-family:"Noto Serif SC",serif;font-size:1.1rem;font-weight:700;color:#2d2d2d;margin-bottom:12px;}\
.gg-detail-science{font-size:0.95rem;line-height:1.8;color:#4A4A4A;}\
.gg-detail-science h1,.gg-detail-science h2,.gg-detail-science h3{font-family:"Noto Serif SC",serif;margin:16px 0 8px;color:#2d2d2d;}\
.gg-detail-science h1{font-size:1.4rem;}\
.gg-detail-science h2{font-size:1.2rem;}\
.gg-detail-science h3{font-size:1.05rem;}\
.gg-detail-science p{margin:0 0 10px;}\
.gg-detail-science ul,.gg-detail-science ol{padding-left:22px;margin:0 0 10px;}\
.gg-detail-science li{margin-bottom:4px;}\
.gg-detail-science blockquote{border-left:4px solid #9CB89C;padding:8px 16px;margin:10px 0;background:rgba(156,184,156,0.08);border-radius:0 12px 12px 0;color:#7A7A7A;}\
.gg-detail-science strong{font-weight:700;}\
.gg-detail-science em{font-style:italic;}\
.gg-detail-science img{max-width:100%;border-radius:12px;margin:10px 0;}\
.gg-detail-science hr{border:none;border-top:1px solid rgba(0,0,0,0.1);margin:16px 0;}\
.gg-detail-sources{margin-top:16px;padding:14px 16px;background:rgba(244,168,150,0.08);border-radius:14px;}\
.gg-detail-sources-title{font-size:0.85rem;font-weight:700;color:#C08060;margin-bottom:8px;}\
.gg-detail-source{font-size:0.82rem;color:#7A7A7A;line-height:1.6;padding:2px 0;}\
.gg-detail-source a{color:#9CB89C;text-decoration:none;}\
.gg-detail-source a:hover{text-decoration:underline;}\
@media(max-width:768px){.gg-detail-card{padding:24px;}.gg-detail-title{font-size:1.3rem;}}\
';
    document.head.appendChild(style);
  }

  window.findMilestoneItem = function(id) {
    var keys = ['0-1','1-2','2-3','3-4','4-5','5-6','6-7','7-8','8-9','9-10','vaccine','health','ceremony'];
    for (var i = 0; i < keys.length; i++) {
      var stage = MILESTONES_DATA[keys[i]];
      if (!stage) continue;
      for (var j = 0; j < stage.items.length; j++) {
        if (stage.items[j].id === id) return stage.items[j];
      }
    }
    return null;
  };

  window.findMilestoneByName = function(name) {
    var keys = ['0-1','1-2','2-3','3-4','4-5','5-6','6-7','7-8','8-9','9-10','vaccine','health','ceremony'];
    for (var i = 0; i < keys.length; i++) {
      var stage = MILESTONES_DATA[keys[i]];
      if (!stage) continue;
      for (var j = 0; j < stage.items.length; j++) {
        var it = stage.items[j];
        var displayName = it.title || it.name;
        if (displayName && displayName.indexOf(name) >= 0) return it;
      }
    }
    return null;
  };

  function renderMilestoneDetailMarkdown(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      if (typeof marked.setOptions === 'function') marked.setOptions({ breaks: true, gfm: true });
      return DOMPurify.sanitize(typeof marked.parse === 'function' ? marked.parse(text) : marked(text));
    }
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  window.showMilestoneDetail = function(cardEl, event) {
    if (event) {
      var t = event.target;
      if (t.classList.contains('milestone-check') || t.closest('.milestone-check') || t.classList.contains('milestone-editor')) return;
    }
    var id = cardEl.getAttribute('data-milestone-id');
    if (!id) return;
    var item = findMilestoneItem(id);
    if (!item) return;

    var overlay = document.createElement('div');
    overlay.className = 'gg-detail-overlay';

    var catHtml = item.category ? '<div class="gg-detail-category ' + (categoryClassMap[item.category] || 'category-health') + '">' + item.category + '</div>' : '';
    var title = item.title || item.name || '';
    var desc = item.desc || item.content || '';
    var timeInfo = [];
    if (item.suggestedTime) timeInfo.push('<span>📅 ' + item.suggestedTime + '</span>');
    if (item.time) timeInfo.push('<span>⏰ ' + item.time + '</span>');
    if (item.age) timeInfo.push('<span>👶 ' + item.age + '</span>');
    if (item.form) timeInfo.push('<span>🎯 ' + item.form + '</span>');
    if (item.cost && item.importance) timeInfo.push('<span>💰 ' + item.cost + ' · ' + item.importance + '</span>');
    else if (item.importance) timeInfo.push('<span>' + item.importance + '</span>');
    if (item.dose) timeInfo.push('<span>💉 ' + item.dose + '</span>');
    var metaHtml = timeInfo.length > 0 ? '<div class="gg-detail-meta">' + timeInfo.join('') + '</div>' : '';
    var descHtml = desc ? '<div class="gg-detail-desc">' + desc + '</div>' : '';
    var noteHtml = item.note ? '<div class="gg-detail-desc" style="background:rgba(244,168,150,0.08);">💡 ' + item.note + '</div>' : '';

    var scienceHtml = '';
    if (item.scientificDetail) {
      scienceHtml = '<div class="gg-detail-divider"></div>' +
        '<div class="gg-detail-heading">📖 科学小知识</div>' +
        '<div class="gg-detail-science">' + renderMilestoneDetailMarkdown(item.scientificDetail) + '</div>';
    }

    var sourcesHtml = '';
    if (item.sources && item.sources.length > 0) {
      var srcList = '';
      for (var i = 0; i < item.sources.length; i++) {
        var s = item.sources[i];
        var srcUrl = s.url || '';
        var srcName = s.name || s;
        if (srcUrl) {
          srcList += '<div class="gg-detail-source">· <a href="' + srcUrl + '" target="_blank" rel="noopener">' + srcName + '</a></div>';
        } else {
          srcList += '<div class="gg-detail-source">· ' + srcName + '</div>';
        }
      }
      sourcesHtml = '<div class="gg-detail-sources"><div class="gg-detail-sources-title">📚 参考来源</div>' + srcList + '</div>';
    }

    var linkedHtml = '';
    if (typeof ITEM_LINKS !== 'undefined' && ITEM_LINKS[id]) {
      var linkedIds = ITEM_LINKS[id];
      var linkedItems = [];
      for (var li = 0; li < linkedIds.length; li++) {
        if (linkedIds[li] === id) continue;
        var liItem = findMilestoneItem(linkedIds[li]);
        if (liItem && (liItem.scientificDetail || (liItem.sources && liItem.sources.length > 0))) {
          linkedItems.push(liItem);
        }
      }
      if (linkedItems.length > 0) {
        linkedHtml = '<div class="gg-detail-divider"></div><div class="gg-detail-heading">🔗 关联信息</div>';
        for (var ei = 0; ei < linkedItems.length; ei++) {
          var el = linkedItems[ei];
          var elTitle = el.title || el.name || '';
          if (elTitle) {
            linkedHtml += '<div style="font-size:0.9rem;font-weight:600;color:#4A4A4A;margin-top:10px;">📎 ' + elTitle + '</div>';
          }
          if (el.scientificDetail) {
            linkedHtml += '<div class="gg-detail-science" style="margin-top:6px;">' + renderMilestoneDetailMarkdown(el.scientificDetail) + '</div>';
          }
          if (el.sources && el.sources.length > 0) {
            var esrcList = '';
            for (var si = 0; si < el.sources.length; si++) {
              var es = el.sources[si];
              var esUrl = es.url || '';
              var esName = es.name || es;
              if (esUrl) {
                esrcList += '<div class="gg-detail-source">· <a href="' + esUrl + '" target="_blank" rel="noopener">' + esName + '</a></div>';
              } else {
                esrcList += '<div class="gg-detail-source">· ' + esName + '</div>';
              }
            }
            linkedHtml += '<div class="gg-detail-sources" style="margin-top:8px;"><div class="gg-detail-sources-title">📚 参考来源</div>' + esrcList + '</div>';
          }
        }
      }
    }

    overlay.innerHTML =
      '<div class="gg-detail-card">' +
        '<button class="gg-detail-close">&times;</button>' +
        catHtml +
        '<div class="gg-detail-title">' + title + '</div>' +
        metaHtml +
        descHtml +
        noteHtml +
        scienceHtml +
        sourcesHtml +
        linkedHtml +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('.gg-detail-close').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  };

  window.showMilestoneDetailByName = function(milestoneName, event) {
    if (event) {
      var t = event.target;
      if (t.classList.contains('milestone-check') || t.closest('.milestone-check') || t.classList.contains('milestone-editor')) return;
    }
    var item = findMilestoneByName(milestoneName);
    if (!item) return;
    var mockEl = document.createElement('div');
    mockEl.setAttribute('data-milestone-id', item.id);
    showMilestoneDetail(mockEl, null);
  };

  // ==================== Sub-page Auth Redirect ====================

  window.requireAuth = function() {
    if (typeof isSupabaseLoggedIn === 'function' && isSupabaseLoggedIn()) {
      return; // logged in, ok
    }
    window.location.href = 'index.html';
  };

  // ==================== Index Page Auth Gate ====================

  window.initIndexAuthGate = function() {
    if (typeof isSupabaseLoggedIn === 'function' && isSupabaseLoggedIn()) {
      return; // logged in, show everything
    }

    // Hide all main content (everything after nav, before footer)
    var nav = document.querySelector('nav');
    var footer = document.querySelector('footer');
    var el = nav ? nav.nextElementSibling : null;
    while (el && el !== footer) {
      var next = el.nextElementSibling;
      if (el.tagName !== 'SCRIPT' && el.id !== 'auth-status') {
        el.style.display = 'none';
      }
      el = next;
    }

    // Show centered login prompt
    var gateDiv = document.createElement('div');
    gateDiv.className = 'auth-gate-section';
    gateDiv.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:120px 30px 60px;text-align:center;';
    gateDiv.innerHTML = '<div style="max-width:400px;width:100%;">' +
      '<div style="font-size:4rem;margin-bottom:20px;">🌱</div>' +
      '<h2 style="font-family:\'Noto Serif SC\',serif;font-size:2rem;margin-bottom:15px;">小花生成长护航</h2>' +
      '<p style="color:#7A7A7A;margin-bottom:30px;">请登录后查看</p>' +
      '<input type="tel" id="gate-phone" placeholder="手机号（11位数字）" maxlength="11" style="width:100%;padding:14px 18px;border:2px solid #E8E8E8;border-radius:14px;font-size:1rem;font-family:Nunito,sans-serif;margin-bottom:12px;outline:none;">' +
      '<input type="password" id="gate-pin" placeholder="PIN码（至少6位）" maxlength="20" style="width:100%;padding:14px 18px;border:2px solid #E8E8E8;border-radius:14px;font-size:1rem;font-family:Nunito,sans-serif;margin-bottom:12px;outline:none;">' +
      '<button id="gate-submit" style="width:100%;padding:14px;background:linear-gradient(135deg,#9CB89C,#C5D5C0);color:#fff;border:none;border-radius:14px;font-size:1rem;font-weight:700;font-family:Nunito,sans-serif;cursor:pointer;">验证</button>' +
      '<div id="gate-message" style="font-size:0.85rem;min-height:20px;margin-top:10px;"></div>' +
      '<p style="font-size:0.8rem;color:#7A7A7A;margin-top:12px;">请使用已注册的手机号和PIN码</p>' +
      '</div>';
    document.body.insertBefore(gateDiv, footer);

    document.getElementById('gate-submit').addEventListener('click', handleGateSubmit);
    document.getElementById('gate-pin').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') handleGateSubmit();
    });
    document.getElementById('gate-phone').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('gate-pin').focus();
    });
  };

  async function handleGateSubmit() {
    var phone = document.getElementById('gate-phone').value.trim();
    var pin = document.getElementById('gate-pin').value;
    var msgEl = document.getElementById('gate-message');

    var result = await supabaseLogin(phone, pin);
    if (result.success) {
      if (msgEl) { msgEl.textContent = result.message; msgEl.style.color = '#5A9A5A'; }
      // Remove gate and show content
      var gate = document.querySelector('.auth-gate-section');
      if (gate) gate.remove();
      var nav = document.querySelector('nav');
      var footer = document.querySelector('footer');
      var el = nav ? nav.nextElementSibling : null;
      while (el && el !== footer) {
        var next = el.nextElementSibling;
        if (el.tagName !== 'SCRIPT' && el.id !== 'auth-status') {
          el.style.display = '';
        }
        el = next;
      }
    } else {
      if (msgEl) { msgEl.textContent = result.message; msgEl.style.color = '#D47373'; }
    }
  }

  // ==================== Voice Check-in ====================

  function getMilestoneIndex() {
    var index = [];
    var keys = ['0-1','1-2','2-3','3-4','4-5','5-6','6-7','7-8','8-9','9-10','vaccine','health','ceremony'];
    for (var k = 0; k < keys.length; k++) {
      var stage = MILESTONES_DATA[keys[k]];
      if (!stage) continue;
      for (var i = 0; i < stage.items.length; i++) {
        var item = stage.items[i];
        index.push({ id: item.id, title: item.title || item.name || '' });
      }
    }
    return index;
  }

  function injectVoiceCSS() {
    if (document.getElementById('gg-voice-style')) return;
    var style = document.createElement('style');
    style.id = 'gg-voice-style';
    style.textContent =
      '.gg-voice-fab{position:fixed;bottom:100px;right:20px;z-index:3000;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#7CB87C,#5A9A5A);color:#fff;border:none;font-size:24px;cursor:pointer;box-shadow:0 4px 16px rgba(90,154,90,0.4);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;touch-action:manipulation;}'
      + '.gg-voice-fab:active{transform:scale(0.92);}'
      + '.gg-voice-fab.recording{background:linear-gradient(135deg,#D47373,#B85C5C);box-shadow:0 4px 20px rgba(212,115,115,0.5);animation:gg-voice-pulse 1s ease-in-out infinite;}'
      + '@keyframes gg-voice-pulse{0%,100%{box-shadow:0 4px 16px rgba(212,115,115,0.4);}50%{box-shadow:0 4px 28px rgba(212,115,115,0.7);}}'
      + '.gg-voice-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);backdrop-filter:blur(5px);z-index:4000;display:flex;align-items:center;justify-content:center;padding:20px;}'
      + '.gg-voice-panel{background:#fff;border-radius:20px;max-width:460px;width:100%;max-height:80vh;overflow-y:auto;padding:28px 24px 20px;box-shadow:0 8px 40px rgba(0,0,0,0.15);}'
      + '.gg-voice-panel h3{margin:0 0 16px;font-size:1.2rem;font-weight:700;color:#2C2C2C;text-align:center;}'
      + '.gg-voice-transcript{background:#F5F5F5;border-radius:12px;padding:14px 16px;margin-bottom:16px;font-size:0.95rem;color:#555;line-height:1.5;word-break:break-word;}'
      + '.gg-voice-transcript strong{color:#2C2C2C;}'
      + '.gg-voice-summary{font-size:0.9rem;color:#7A7A7A;margin-bottom:16px;text-align:center;font-style:italic;}'
      + '.gg-voice-match-list{list-style:none;padding:0;margin:0 0 20px;}'
      + '.gg-voice-match-list li{padding:10px 14px;margin-bottom:6px;background:#F0F8F0;border-radius:10px;font-size:0.95rem;color:#2C2C2C;display:flex;align-items:center;gap:8px;}'
      + '.gg-voice-match-list li::before{content:"✅";font-size:0.85rem;}'
      + '.gg-voice-match-list li .gg-voice-badge{font-size:0.7rem;background:#D4E8D4;color:#4A8A4A;padding:2px 8px;border-radius:6px;white-space:nowrap;}'
      + '.gg-voice-actions{display:flex;gap:10px;}'
      + '.gg-voice-actions button{flex:1;padding:12px;border:none;border-radius:12px;font-size:0.95rem;font-weight:600;cursor:pointer;font-family:Nunito,sans-serif;transition:opacity .2s;touch-action:manipulation;}'
      + '.gg-voice-btn-primary{background:linear-gradient(135deg,#9CB89C,#C5D5C0);color:#fff;}'
      + '.gg-voice-btn-secondary{background:#E8E8E8;color:#555;}'
      + '.gg-voice-btn-danger{background:linear-gradient(135deg,#D47373,#E8A0A0);color:#fff;}'
      + '.gg-voice-btn-save{background:linear-gradient(135deg,#7CB8D4,#A0D0E8);color:#fff;}'
      + '.gg-voice-btn-done{background:#D0D0D0;color:#888;cursor:default;}'
      + '.gg-voice-fallback-hint{font-size:0.85rem;color:#999;text-align:center;margin-bottom:16px;padding:12px;background:#FFF8E1;border-radius:10px;}'
      + '.gg-voice-loading{text-align:center;padding:30px 0;color:#7A7A7A;font-size:0.95rem;}'
      + '.gg-voice-loading .gg-spinner{display:inline-block;width:24px;height:24px;border:3px solid #E8E8E8;border-top-color:#9CB89C;border-radius:50%;animation:gg-spin .8s linear infinite;margin-bottom:8px;}'
      + '@keyframes gg-spin{to{transform:rotate(360deg);}}'
      + '.gg-voice-diary-preview{background:#F5F0FF;border-radius:12px;padding:14px 16px;margin-bottom:16px;border-left:3px solid #A080D0;}'
      + '.gg-voice-diary-section{margin-bottom:10px;font-size:0.9rem;color:#444;line-height:1.5;}'
      + '.gg-voice-diary-section:last-child{margin-bottom:0;}'
      + '.gg-voice-diary-section strong{color:#3A2A5A;}'
      + '.gg-voice-tag{display:inline-block;padding:2px 8px;background:#E0D4F0;color:#5A3A8A;border-radius:10px;font-size:0.75rem;margin:2px 3px;}'
      + '.gg-voice-status{position:fixed;bottom:170px;left:50%;transform:translateX(-50%);background:#2d5016;color:#fff;padding:10px 24px;border-radius:30px;font-size:0.9rem;z-index:3999;opacity:0;transition:opacity .3s;box-shadow:0 4px 20px rgba(0,0,0,0.15);pointer-events:none;white-space:nowrap;}'
      + '.gg-voice-status.show{opacity:1;}';
    document.head.appendChild(style);
  }

  function getTranscriptFromResult(result) {
    var text = '';
    if (typeof result === 'string') text = result;
    else if (result && result.results) {
      for (var i = 0; i < result.results.length; i++) {
        if (result.results[i].isFinal) {
          text += result.results[i][0].transcript;
        }
      }
    }
    return text.trim();
  }

  function formatNowForDiary() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + dd + ' ' + h + ':' + min;
  }

  function formatTodayForDiary() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  window.saveVoiceDiaryEntry = async function(content, tags) {
    var supabase = typeof window._getSupabaseInstance === 'function' ? window._getSupabaseInstance() : null;
    if (!supabase) { showToast('Supabase 未初始化'); return false; }

    var session = null;
    try {
      var raw = localStorage.getItem('gg_session');
      if (raw) session = JSON.parse(raw);
    } catch(e) {}

    if (!session || !session.phone || !session.pinHash) {
      showToast('请先登录');
      if (typeof showAuthModal === 'function') showAuthModal();
      return false;
    }

    var entryDate = formatTodayForDiary();
    var mood = '';
    var photoPaths = [];
    if (!tags) tags = ['语音记录'];

    var result = await supabase.rpc('create_diary_entry', {
      p_phone: session.phone,
      p_pin_hash: session.pinHash,
      p_content: content,
      p_photo_paths: photoPaths,
      p_entry_date: entryDate,
      p_mood: mood,
      p_tags: tags
    });

    if (result.error) {
      console.error('[Voice] Diary save error:', result.error);
      showToast('日记保存失败');
      return false;
    }

    if (result.data && result.data.success) {
      showToast('已保存到日记');
      return true;
    } else {
      showToast(result.data?.message || '日记保存失败');
      return false;
    }
  };

  window.batchToggleMilestones = async function(ids) {
    var checkedItems = JSON.parse(localStorage.getItem('checkedItems') || '[]');
    var editorInfo = JSON.parse(localStorage.getItem('gg_editor_info') || '{}');
    var phone = typeof getCurrentPhoneRaw === 'function' ? getCurrentPhoneRaw() : '';
    var now = new Date().toISOString();
    var changed = 0;

    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var isAlready = checkedItems.indexOf(id) !== -1;
      if (isAlready) continue;

      checkedItems.push(id);
      editorInfo[id] = { phone: phone, updated_at: now, checked: true };
      toggleLinkedItems(ITEM_LINKS[id], true);

      var el = document.querySelector('.milestone-check[data-id="' + id + '"]');
      if (el) {
        el.classList.add('checked');
        var card = el.closest('.milestone-card');
        if (card) {
          var eSpan = card.querySelector('.milestone-editor');
          if (eSpan && phone) {
            eSpan.textContent = (typeof getFamilyIdentity === 'function' ? getFamilyIdentity(phone) : phone) + ' ' + (typeof formatEditorTime === 'function' ? formatEditorTime(now) : '');
            eSpan.style.display = '';
          }
        }
      }

      if (typeof supabaseToggle === 'function') {
        try { await supabaseToggle(id, true); } catch(e) { console.error('[Voice] toggle fail:', id, e); }
      }
      changed++;
    }

    localStorage.setItem('checkedItems', JSON.stringify(checkedItems));
    localStorage.setItem('gg_editor_info', JSON.stringify(editorInfo));
    updateProgress();

    if (changed > 0) {
      showToast('已打卡 ' + changed + ' 项');
    }
    return changed;
  };

  function buildVoiceOverlay(html) {
    var overlay = document.createElement('div');
    overlay.className = 'gg-voice-overlay';
    overlay.innerHTML = '<div class="gg-voice-panel">' + html + '</div>';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
    return overlay;
  }

  function showVoiceConfirm(transcript, result) {
    var matched = result.matched || [];
    var summary = result.summary || '';
    var diary = result.diary || {};

    var matchedHtml = '';
    if (matched.length > 0) {
      matchedHtml = '<ul class="gg-voice-match-list">';
      for (var i = 0; i < matched.length; i++) {
        matchedHtml += '<li>' + matched[i].title + ' <span class="gg-voice-badge">' + matched[i].id + '</span></li>';
      }
      matchedHtml += '</ul>';
    }

    var diaryPreviewHtml = '';
    if (diary.summary) {
      diaryPreviewHtml = '<div class="gg-voice-diary-preview">'
        + '<div class="gg-voice-diary-section"><strong>📝 提炼：</strong>' + escapeHtml(diary.summary) + '</div>'
        + (diary.creative_response ? '<div class="gg-voice-diary-section"><strong>✨ 创作：</strong><br>' + escapeHtml(diary.creative_response).replace(/\n/g, '<br>') + '</div>' : '')
        + '<div class="gg-voice-diary-section"><strong>🤔 亲子思考：</strong>' + escapeHtml(diary.aristotle_question) + '</div>'
        + (diary.tags && diary.tags.length > 0 ? '<div class="gg-voice-diary-section"><strong>🏷️ 标签：</strong>' + diary.tags.map(function(t) { return '<span class="gg-voice-tag">' + escapeHtml(t) + '</span>'; }).join(' ') + '</div>' : '')
        + '</div>';
    }

    function buildTags(baseTags, matchedItems) {
      var tags = baseTags && baseTags.length > 0 ? baseTags.slice() : [];
      if (tags.indexOf('语音记录') === -1) tags.unshift('语音记录');
      for (var i = 0; i < matchedItems.length; i++) {
        var msTag = '📌 ' + matchedItems[i].title;
        if (tags.indexOf(msTag) === -1) tags.push(msTag);
      }
      return tags;
    }

    function buildDiaryContent(matchedItems) {
      var now = formatNowForDiary();
      var lines = ['## 🎤 语音记录', '', '**语音原文**：' + transcript, '', '**记录时间**：' + now, ''];
      if (matchedItems.length > 0) {
        lines.push('**✅ 打卡**：' + matchedItems.map(function(m) { return m.title; }).join('、'));
        lines.push('');
      }
      if (diary.summary) {
        lines.push('**📝 提炼**：' + diary.summary);
        lines.push('');
      }
      if (diary.creative_response) {
        lines.push('**✨ 创作**：');
        lines.push('');
        lines.push(diary.creative_response);
        lines.push('');
      }
      if (diary.aristotle_question) {
        lines.push('**🤔 亲子思考**：' + diary.aristotle_question);
        lines.push('');
      }
      return lines.join('\n');
    }

    var ids = matched.map(function(m) { return m.id; });

    var buttonsHtml = '';
    if (matched.length > 0) {
      buttonsHtml = '<button class="gg-voice-btn-secondary" onclick="this.closest(\'.gg-voice-overlay\').remove()">取消</button>'
        + '<button class="gg-voice-btn-save" id="gg-voice-diary-btn">📝 保存到日记</button>'
        + '<button class="gg-voice-btn-primary" id="gg-voice-milestone-btn">确认打卡 ' + matched.length + ' 项</button>';
    } else {
      buttonsHtml = '<button class="gg-voice-btn-secondary" onclick="this.closest(\'.gg-voice-overlay\').remove()">取消</button>'
        + '<button class="gg-voice-btn-primary" id="gg-voice-milestone-btn">保存到日记</button>';
    }

    var overlay = buildVoiceOverlay(
      '<h3>🎤 语音记录</h3>'
      + '<div class="gg-voice-transcript"><strong>你说：</strong>' + escapeHtml(transcript) + '</div>'
      + (summary ? '<div class="gg-voice-summary">' + escapeHtml(summary) + '</div>' : '')
      + matchedHtml
      + diaryPreviewHtml
      + '<div class="gg-voice-actions" style="flex-wrap:wrap;">'
      + buttonsHtml
      + '</div>'
    );

    document.body.appendChild(overlay);

    var done = { milestone: false, diary: false };

    function tryCloseOverlay() {
      if (done.milestone && done.diary) {
        overlay.remove();
      }
    }

    document.getElementById('gg-voice-milestone-btn').addEventListener('click', async function() {
      var btn = this;
      btn.textContent = '保存中...';
      btn.disabled = true;
      if (matched.length > 0) {
        await window.batchToggleMilestones(ids);
        btn.className = 'gg-voice-btn-done';
        btn.textContent = '✅ 已打卡';
        done.milestone = true;
        tryCloseOverlay();
      } else {
        var tags = buildTags(diary.tags, []);
        var mdContent = buildDiaryContent([]);
        await window.saveVoiceDiaryEntry(mdContent, tags);
        overlay.remove();
      }
    });

    var diaryBtn = document.getElementById('gg-voice-diary-btn');
    if (diaryBtn) {
      diaryBtn.addEventListener('click', async function() {
        var btn = this;
        btn.textContent = '保存中...';
        btn.disabled = true;
        var tags = buildTags(diary.tags, matched);
        var mdContent = buildDiaryContent(matched);
        await window.saveVoiceDiaryEntry(mdContent, tags);
        btn.className = 'gg-voice-btn-done';
        btn.textContent = '✅ 已保存';
        done.diary = true;
        tryCloseOverlay();
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function handleVoiceTranscript(text) {
    console.log('[Voice] handleVoiceTranscript called, text:', JSON.stringify(text));
    if (!text) {
      showToast('未识别到语音，请重试');
      return;
    }

    var overlay = buildVoiceOverlay(
      '<div class="gg-voice-loading"><div class="gg-spinner"></div>正在解析...</div>'
    );
    document.body.appendChild(overlay);

    var index = getMilestoneIndex();
    var funcUrl = SUPABASE_CONFIG.url.replace(/\/+$/, '') + '/functions/v1/parse-milestones';

    fetch(funcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.anonKey
      },
      body: JSON.stringify({
        transcript: text,
        milestones: index
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(result) {
      overlay.remove();
      if (result.error) {
        showToast('解析失败，请稍后重试');
        console.error('[Voice] Parse error:', result);
        return;
      }
      showVoiceConfirm(text, result);
    })
    .catch(function(err) {
      overlay.remove();
      showToast('网络请求失败，请检查网络');
      console.error('[Voice] Fetch error:', err);
    });
  }

  function initVoiceCheckin() {
    injectVoiceCSS();

    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      console.log('[Voice] SpeechRecognition not supported');
      return;
    }

    var fab = document.createElement('button');
    fab.className = 'gg-voice-fab';
    fab.id = 'gg-voice-fab';
    fab.innerHTML = '🎤';
    fab.title = '语音打卡';
    document.body.appendChild(fab);

    var statusEl = document.createElement('div');
    statusEl.className = 'gg-voice-status';
    statusEl.textContent = '🎤 聆听中...';
    document.body.appendChild(statusEl);

    var recognizer = null;
    var isListening = false;
    var finalTranscript = '';
    var interimTranscript = '';
    var silenceTimer = null;

    function showVoiceStatus() {
      statusEl.classList.add('show');
    }

    function hideVoiceStatus() {
      statusEl.classList.remove('show');
    }

    function clearSilenceTimer() {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    }

    function resetSilenceTimer() {
      clearSilenceTimer();
      silenceTimer = setTimeout(function() {
        console.log('[Voice] Auto-stop: silence timeout');
        hideVoiceStatus();
        stopListening();
        showToast('已自动停止（5秒无语音）');
      }, 5000);
    }

    function startListening() {
      if (isListening) return;
      finalTranscript = '';
      interimTranscript = '';
      try {
        recognizer = new Recognition();
        recognizer.lang = 'zh-CN';
        recognizer.continuous = true;
        recognizer.interimResults = true;

        recognizer.onstart = function() {
          isListening = true;
          fab.classList.add('recording');
          fab.innerHTML = '⏹';
          showVoiceStatus();
          resetSilenceTimer();
        };

        recognizer.onerror = function(event) {
          console.error('[Voice] Recognition error:', event.error);
          isListening = false;
          fab.classList.remove('recording');
          fab.innerHTML = '🎤';
          hideVoiceStatus();
          clearSilenceTimer();
          if (event.error === 'not-allowed') {
            showToast('请允许麦克风权限');
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            showToast('语音识别出错，请重试');
          }
        };

        recognizer.onend = function() {
          console.log('[Voice] onend fired');
          isListening = false;
          fab.classList.remove('recording');
          fab.innerHTML = '🎤';
          hideVoiceStatus();
          clearSilenceTimer();
        };

        recognizer.onresult = function(event) {
          console.log('[Voice] onresult fired, count:', event.results.length, 'isFinal:', event.results[event.results.length-1].isFinal, 'text:', event.results[event.results.length-1][0].transcript);
          var hasSpeech = false;
          for (var i = event.resultIndex; i < event.results.length; i++) {
            var result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            } else {
              interimTranscript = result[0].transcript;
            }
            if (result[0].transcript.trim()) {
              hasSpeech = true;
            }
          }
          if (hasSpeech) {
            resetSilenceTimer();
          }
        };

        recognizer.start();
      } catch(e) {
        console.error('[Voice] Start error:', e);
        showToast('启动语音识别失败');
      }
    }

    function stopListening() {
      console.log('[Voice] stopListening called');
      isListening = false;
      fab.classList.remove('recording');
      fab.innerHTML = '🎤';
      hideVoiceStatus();
      clearSilenceTimer();
      if (recognizer) {
        var r = recognizer;
        recognizer = null;
        try {
          console.log('[Voice] calling recognizer.stop()');
          r.stop();
        } catch(e) {
          console.error('[Voice] stop() threw:', e);
          try { r.abort(); } catch(e2) { console.error('[Voice] abort() also threw:', e2); }
        }
      }
      setTimeout(function() {
        handleVoiceTranscript(finalTranscript || interimTranscript);
      }, 400);
    }

    fab.addEventListener('click', function() {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    });
  }

  // ==================== Init ====================

  window.initGrowthGuardian = function() {
    migrateLegacyCheckedItems();
    injectAuthUI();
    injectDetailOverlayCSS();
    if (typeof initSupabase === 'function') initSupabase();
    initVoiceCheckin();
  };

})();
