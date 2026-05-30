(function() {
  var TRACKS = [
    'https://cdn.pixabay.com/audio/2024/11/04/audio_4956b4edd1.mp3',
    'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3',
    'https://cdn.pixabay.com/audio/2022/02/22/audio_d1718ab41b.mp3'
  ];

  var NAMES = ['星夜摇篮曲', '微风轻语', '静谧时光'];

  function pickTrack() {
    return Math.floor(Math.random() * TRACKS.length);
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
      '#music-label{font-size:0.72rem;color:#7A7A7A;background:var(--white,#fff);padding:4px 10px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);opacity:0;transition:opacity 0.3s;white-space:nowrap;pointer-events:none;max-width:100px;overflow:hidden;text-overflow:ellipsis;}';
    document.head.appendChild(style);

    var player = document.createElement('div');
    player.id = 'music-player';
    player.innerHTML =
      '<span id="music-label"></span>' +
      '<button id="music-btn"><span class="music-icon">🎵</span></button>';

    var audio = document.createElement('audio');
    audio.id = 'music-audio';
    audio.loop = true;
    audio.volume = 0.4;
    audio.preload = 'auto';

    var label = null;
    var btn = null;
    var playing = false;

    function playRandom() {
      var idx = pickTrack();
      audio.src = TRACKS[idx];
      label = document.getElementById('music-label');
      if (label) label.textContent = NAMES[idx] || '';
      audio.play().then(function() {
        btn = document.getElementById('music-btn');
        if (btn) btn.classList.add('playing');
        playing = true;
        localStorage.setItem('gg_music', 'on');
      }).catch(function(e) {
        console.warn('[Music] 播放失败:', e);
      });
    }

    function stopMusic() {
      audio.pause();
      audio.currentTime = 0;
      btn = document.getElementById('music-btn');
      if (btn) btn.classList.remove('playing');
      playing = false;
      localStorage.setItem('gg_music', 'off');
    }

    document.body.appendChild(player);
    document.body.appendChild(audio);

    document.getElementById('music-btn').addEventListener('click', function() {
      if (playing) {
        stopMusic();
      } else {
        playRandom();
      }
    });

    // Restore: if was playing, auto-resume with a new random track
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
