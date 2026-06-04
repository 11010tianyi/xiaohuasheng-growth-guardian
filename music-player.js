(function() {
  var THEMES = {
    original: {
      name: '原始主题',
      color: '#F4A896',
      tracks: [
        { url: 'https://cdn.pixabay.com/audio/2024/11/04/audio_4956b4edd1.mp3', name: '星夜摇篮曲' },
        { url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', name: '微风轻语' },
        { url: 'https://cdn.pixabay.com/audio/2022/02/22/audio_d1718ab41b.mp3', name: '静谧时光' }
      ]
    },
    children: {
      name: '儿童主题',
      color: '#FFB5C2',
      tracks: [
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2025/07/lullaby-music.mp3', name: '摇篮曲' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2025/08/dreamy-kids-music.mp3', name: '梦幻童谣' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2025/06/dreaming-softly.mp3', name: '轻柔入梦' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2025/08/sleepy-dream-nights.mp3', name: '安眠夜曲' }
      ]
    },
    instrumental: {
      name: '轻音乐主题',
      color: '#A8D5BA',
      tracks: [
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/05/birds-wake-me-up-every-morning.mp3', name: '清晨鸟鸣' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2025/08/soft-piano-and-violin-music.mp3', name: '钢琴与小提琴' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/05/ukulele-music.mp3', name: '尤克里里' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/05/saxophone-instrument.mp3', name: '萨克斯风' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/05/clarinet-instrument.mp3', name: '单簧管' }
      ]
    },
    ambient: {
      name: '白噪音主题',
      color: '#A8C8E0',
      tracks: [
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/05/rain-shower-sounds.mp3', name: '细雨沙沙' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/05/sounds-of-light-rain.mp3', name: '轻雨滴答' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/04/waterfall-noises.mp3', name: '瀑布潺潺' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/03/stormy-waves-of-sea.mp3', name: '海浪拍岸' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/04/birds-chirping-and-singing-in-the-forest.mp3', name: '森林鸟鸣' },
        { url: 'https://www.freesoundslibrary.com/wp-content/uploads/2026/05/continuous-night-ambient-sound-effect.mp3', name: '夜色宁静' }
      ]
    }
  };

  var THEME_KEYS = Object.keys(THEMES);
  var currentTheme = localStorage.getItem('gg_music_theme') || 'original';

  function pickTrack() {
    var tracks = THEMES[currentTheme].tracks;
    return Math.floor(Math.random() * tracks.length);
  }

  function initMusicPlayer() {
    if (document.getElementById('music-player')) return;

    var style = document.createElement('style');
    style.textContent =
      '#music-player{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:8px;}' +
      '#music-btn{width:48px;height:48px;border-radius:50%;border:2px solid rgba(0,0,0,0.08);background:var(--white,#fff);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:0 4px 20px rgba(0,0,0,0.1);transition:all 0.3s;}' +
      '#music-btn:hover{transform:scale(1.1);box-shadow:0 6px 24px rgba(0,0,0,0.15);}' +
      '#music-btn.playing{border-color:#F4A896;background:linear-gradient(135deg,#FFF0F0,#FFE4E1);}' +
      '#music-btn.playing .music-icon{animation:musicSpin 3s linear infinite;}' +
      '@keyframes musicSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}' +
      '#music-label{font-size:0.72rem;color:#7A7A7A;background:var(--white,#fff);padding:4px 10px 4px 6px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);transition:opacity 0.3s;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px;}' +
      '#music-label .theme-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}' +
      '#music-theme{font-size:0.7rem;padding:3px 6px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:var(--white,#fff);color:#7A7A7A;cursor:pointer;outline:none;box-shadow:0 2px 8px rgba(0,0,0,0.06);}' +
      '#music-theme option{padding:2px 4px;}';
    document.head.appendChild(style);

    var player = document.createElement('div');
    player.id = 'music-player';

    var themeSelect = document.createElement('select');
    themeSelect.id = 'music-theme';
    THEME_KEYS.forEach(function(key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = THEMES[key].name;
      if (key === currentTheme) opt.selected = true;
      themeSelect.appendChild(opt);
    });

    var label = document.createElement('span');
    label.id = 'music-label';
    label.style.opacity = '0';

    var btn = document.createElement('button');
    btn.id = 'music-btn';
    btn.innerHTML = '<span class="music-icon">🎵</span>';

    player.appendChild(themeSelect);
    player.appendChild(label);
    player.appendChild(btn);

    var audio = document.createElement('audio');
    audio.id = 'music-audio';
    audio.loop = true;
    audio.volume = 0.4;
    audio.preload = 'auto';

    var playing = false;

    function showLabel(text) {
      label.innerHTML = text ? '<span class="theme-dot" style="background:' + THEMES[currentTheme].color + '"></span>' + text : '';
      label.style.opacity = text ? '1' : '0';
    }

    function playRandom() {
      var idx = pickTrack();
      var track = THEMES[currentTheme].tracks[idx];
      audio.src = track.url;
      showLabel(track.name);
      audio.play().then(function() {
        btn.classList.add('playing');
        playing = true;
        localStorage.setItem('gg_music', 'on');
      }).catch(function(e) {
        console.warn('[Music] 播放失败:', e);
      });
    }

    function stopMusic() {
      audio.pause();
      audio.currentTime = 0;
      btn.classList.remove('playing');
      playing = false;
      showLabel('');
      localStorage.setItem('gg_music', 'off');
    }

    document.body.appendChild(player);
    document.body.appendChild(audio);

    btn.addEventListener('click', function() {
      if (playing) {
        stopMusic();
      } else {
        playRandom();
      }
    });

    themeSelect.addEventListener('change', function() {
      currentTheme = themeSelect.value;
      localStorage.setItem('gg_music_theme', currentTheme);
      if (playing) {
        var idx = pickTrack();
        var track = THEMES[currentTheme].tracks[idx];
        audio.src = track.url;
        showLabel(track.name);
        audio.play().catch(function(e) {
          console.warn('[Music] 播放失败:', e);
        });
      }
    });

    if (localStorage.getItem('gg_music') === 'on') {
      playRandom();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMusicPlayer);
  } else {
    initMusicPlayer();
  }
})();
