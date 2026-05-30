/* 小花生成长护航计划 - 家人身份配置 */

var FAMILY_CONFIG = {
  // 手机尾号4位 → 身份名称，可随时增减
  identities: {
    '5899': '花爸爸',
    '6090': '花妈妈',
    '0436': '花奶奶'
  }
};

window.getFamilyIdentity = function(phone) {
  if (!phone) return '';
  var last4 = phone.slice(-4);
  if (FAMILY_CONFIG.identities[last4]) {
    return FAMILY_CONFIG.identities[last4];
  }
  // 未配置身份则脱敏显示
  if (phone.length >= 11) {
    return phone.substring(0, 3) + '****' + phone.substring(7);
  }
  return phone;
};

window.isCurrentUser = function(phone) {
  if (!phone) return false;
  var raw = localStorage.getItem('gg_session');
  if (!raw) return false;
  try {
    var session = JSON.parse(raw);
    return session.phone === phone;
  } catch(e) { return false; }
};
