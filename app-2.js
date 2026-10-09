/* ---------- single post ---------- */
function renderPost(){
  var p=S.post;
  document.title=p.title+' | Allarbaa.cloud';
  var mins = readingTime(p.content || (p.pages ? p.pages.join(' ') : ''));
  var badgeClass='badge'+(p.type==='book'?(p.price?' paid':' free'):'');
  var badgeText=p.type==='book'?(p.price?esc(p.price):esc(T('free'))):esc(T('bt'));
  var head='<a class="back" href="/">'+esc(T('back'))+'</a>'+
    '<div><span class="'+badgeClass+'">'+badgeText+'</span></div>'+
    '<h1>'+esc(p.title)+'</h1><div class="meta">'+
    '<span>'+fmt(p.date)+'</span> &middot; '+
    '<span>'+(p.views||0)+' '+esc(T('views'))+'</span> &middot; '+
    '<span>⏱️ '+mins+' '+esc(T('min_read'))+'</span>'+
    (p.type==='book'?' &middot; '+(p.price?esc(p.price):esc(T('free'))):'')+
    '</div>';
  var cover=p.imgCount?'<div class="gallery"><img src="'+imgUrl(p,0)+'" alt="'+esc(p.title)+'" loading="lazy"></div>':'';
  if(p.type==='book'){
    if(p.locked && !S.unlocked){renderGate(head,cover);return}
    renderReader(head,cover);
    renderRelated(p);
    return;
  }
  var imgs='';
  for(var n=1;n<(p.imgCount||0);n++) imgs+='<img src="'+imgUrl(p,n)+'" alt="'+esc(p.title)+'" loading="lazy">';
  
  var extraLink = p.link ? '<p><a class="aff-btn" href="'+esc(p.link)+'" target="_blank" rel="noopener nofollow">🔗 '+esc(p.linkTitle||'Visit Link / Resource')+'</a></p>' : '';
  var codeBtn = p.codeLink ? '<p><a class="code-btn" href="'+esc(p.codeLink)+'" target="_blank" rel="noopener">💻 '+esc(T('get_code'))+'</a></p>' : '';
  
  $('#postBody').innerHTML=head+cover+
    (imgs?'<div class="gallery">'+imgs+'</div>':'')+
    readerToolsBar()+
    audioPlayerBar()+
    '<div class="prose" id="listenText">'+p.html+'</div>'+
    codeBtn+
    extraLink+
    reactionsBar(p.id)+
    authorBox()+waCommunityBox()+
    shareBar(p)+saveBtn(p);

  setupCodeBlocks();
  renderRelated(p);
  $('#commentsWrap').hidden=false; loadComments(p.id);
  setupAudioListeners();
}

function readerToolsBar(){
  return '<div class="reader-tools">'+
    '<div class="font-ctrls">'+
      '<span class="mut" style="font-size:.82rem">'+esc(T('font_ctrl'))+':</span> '+
      '<button class="btn sm ghost" type="button" id="fontDec" title="A-">A-</button> '+
      '<button class="btn sm ghost" type="button" id="fontInc" title="A+">A+</button> '+
      '<button class="btn sm ghost" type="button" id="fontFamilyToggle" title="Serif / Sans">Serif / Sans</button>'+
    '</div>'+
    '<button class="btn sm ghost" type="button" id="printDocBtn" title="PDF / Print">'+esc(T('print_pdf'))+'</button>'+
  '</div>';
}

function audioPlayerBar(){
  return '<div class="audio-player-box" id="audioPlayerBox">'+
    '<div class="audio-ctrls">'+
      '<button class="btn sm" type="button" id="audioPlayBtn">▶ '+esc(T('listen'))+'</button>'+
      '<button class="btn sm ghost" type="button" id="audioStopBtn" style="display:none">⏹ '+esc(T('stop'))+'</button>'+
      '<div class="audio-speed-wrap">'+
        '<button class="btn sm ghost speed-btn on" type="button" data-spd="1">1x</button>'+
        '<button class="btn sm ghost speed-btn" type="button" data-spd="1.25">1.25x</button>'+
        '<button class="btn sm ghost speed-btn" type="button" data-spd="1.5">1.5x</button>'+
      '</div>'+
      '<div class="audio-wave" id="audioWave" style="display:none">'+
        '<span></span><span></span><span></span><span></span>'+
      '</div>'+
    '</div>'+
  '</div>';
}

function reactionsBar(postId){
  var rx = getReactions(postId);
  var voted = LS.get('rx_voted_'+postId) || '';
  return '<div class="reactions-box" data-pid="'+postId+'">'+
    '<span class="mut" style="font-size:.85rem;margin-inline-end:6px">'+esc(T('reactions_t'))+'</span>'+
    '<button class="rx-btn'+(voted==='helpful'?' active':'')+'" type="button" data-rx="helpful">💡 <span>'+(rx.helpful||0)+'</span></button>'+
    '<button class="rx-btn'+(voted==='fire'?' active':'')+'" type="button" data-rx="fire">🔥 <span>'+(rx.fire||0)+'</span></button>'+
    '<button class="rx-btn'+(voted==='applause'?' active':'')+'" type="button" data-rx="applause">👏 <span>'+(rx.applause||0)+'</span></button>'+
    '<button class="rx-btn'+(voted==='heart'?' active':'')+'" type="button" data-rx="heart">❤️ <span>'+(rx.heart||0)+'</span></button>'+
  '</div>';
}

function getReactions(postId){
  var r=(S.post&&S.post.id===postId&&S.post.reactions)||{};
  return {helpful:r.helpful||0,fire:r.fire||0,applause:r.applause||0,heart:r.heart||0};
}

function handleReaction(postId, type){
  var votedKey='rx_voted_'+postId;
  var prev=LS.get(votedKey)||'';
  var next=(prev===type)?'':type;
  var rx=getReactions(postId);
  if(prev&&rx[prev]>0) rx[prev]--;
  if(next) rx[next]=(rx[next]||0)+1;
  if(S.post&&S.post.id===postId) S.post.reactions=rx;
  LS.set(votedKey,next);
  if(next) toast(T('rx_voted'));
  var box=document.querySelector('.reactions-box[data-pid="'+postId+'"]');
  if(box){
    Array.prototype.slice.call(box.querySelectorAll('.rx-btn')).forEach(function(bt){
      var t=bt.getAttribute('data-rx');
      bt.classList.toggle('active',next===t);
      var sp=bt.querySelector('span');
      if(sp) sp.textContent=rx[t]||0;
    });
  }
  api('react/'+postId,{method:'POST',body:JSON.stringify({type:next,prev:prev})}).then(function(j){
    if(j&&j.reactions&&S.post&&S.post.id===postId) S.post.reactions=j.reactions;
  }).catch(function(){});
}

function authorBox(){
  var b=S.settings&&S.settings.authorBio;
  return b?'<div class="author-box">'+esc(b)+'</div>':'';
}

function waCommunityBox(){
  var s=S.settings||{};
  var waLink = s.waChannel || (s.social&&s.social.wa) || 'https://wa.me/2347069444260';
  return '<div class="wa-community">'+
    '<div><h4>'+esc(T('wa_comm_t'))+'</h4><p>'+esc(T('wa_comm_p'))+'</p></div>'+
    '<a href="'+esc(waLink)+'" target="_blank" rel="noopener" class="btn sm">'+esc(T('wa_comm_btn'))+'</a>'+
    '</div>';
}

function setupCodeBlocks(){
  $$('.prose pre').forEach(function(pr){
    if(pr.querySelector('.code-copy-btn')) return;
    pr.classList.add('code-box');
    var b=document.createElement('button');
    b.type='button';
    b.className='code-copy-btn';
    b.textContent='Copy';
    b.onclick=function(){
      navigator.clipboard.writeText(pr.textContent.replace('Copy','').trim()).then(function(){
        toast(T('copied_code'));
      });
    };
    pr.appendChild(b);
  });
}

function renderRelated(cur){
  var box=$('#relatedGrid'), wrap=$('#relatedWrap');
  if(!box||!wrap) return;
  var list = S.posts.filter(function(x){
    return x.id !== cur.id && x.type !== 'product';
  });
  list.sort(function(a,b){
    var aScore = (a.type === cur.type ? 2 : 0);
    var bScore = (b.type === cur.type ? 2 : 0);
    return bScore - aScore;
  });
  list = list.slice(0, 3);
  if(!list.length){ wrap.hidden=true; return; }
  wrap.hidden=false;
  box.innerHTML = list.map(function(p){
    var img=p.imgCount?imgUrl(p,0):ph(hash(p.id));
    var badgeClass='badge'+(p.type==='book'?(p.price?' paid':' free'):'');
    var badgeText=p.type==='book'?(p.price?esc(p.price):esc(T('free'))):esc(T('bt'));
    return '<article class="pc" data-search="'+esc((p.title+' '+(p.excerpt||'')).toLowerCase())+'"><a class="pimg" href="/p/'+p.id+'"><img src="'+img+'" alt="" loading="lazy"></a><div class="pb">'+
      '<span class="'+badgeClass+'">'+badgeText+'</span>'+
      '<h3><a href="/p/'+p.id+'">'+esc(p.title)+'</a></h3>'+
      '<div class="pm"><span>'+fmt(p.date)+'</span><a class="more" href="/p/'+p.id+'">'+esc(T('more'))+'</a></div></div></article>';
  }).join('');
}

function saveBtn(p){
  var on=isSaved(p.id);
  return '<div class="row" style="margin-top:10px"><button class="save-btn'+(on?' on':'')+'" type="button" id="saveToggle" data-id="'+p.id+'">'+(on?'★ ':'☆ ')+esc(T(on?'saved':'save'))+'</button></div>';
}
function renderGate(head,cover){
  $('#commentsWrap').hidden=true;
  $('#relatedWrap').hidden=true;
  var p=S.post;
  var form=S.pending?
    '<p class="mut" style="margin-top:14px">'+esc(T('gate_pending'))+'</p>':
    '<h3 style="margin-top:18px">'+esc(T('gate_t'))+'</h3><p class="mut">'+esc(T('gate_p'))+'</p>'+
    '<input type="email" id="g-email" placeholder="you@example.com">'+
    '<input type="text" id="g-hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">'+
    '<div class="row" style="justify-content:center"><button class="btn" type="button" id="g-go">'+esc(T('gate_btn'))+'</button></div>'+
    '<p class="mut" id="g-err" style="min-height:1.4em"></p>';
  $('#postBody').innerHTML=head+cover+
    '<div class="gate">'+
    '<p class="mut">'+esc(p.pageCount||0)+' pages'+(p.price?' &middot; '+esc(p.price):' &middot; '+esc(T('free')))+'</p>'+
    '<div class="prose">'+(p.previewHtml||'')+'&hellip;</div>'+
    payBox(p)+form+
    '</div>';
}
function payBox(p){
  var s=S.settings||{}, list=s.payments||[];
  if(!p.link && !list.length) return '';
  var top=p.link?'<a class="aff-btn cta" style="display:inline-block;margin:10px 0" href="'+esc(p.link)+'" target="_blank" rel="noopener nofollow">'+esc(T('buynow'))+'</a>':'';
  var rows=list.length?('<p class="mut" style="margin:6px 0">'+esc(T('pay_p'))+'</p>'+list.map(function(pm){
    return '<div class="payrow" dir="ltr"><b>'+esc(T('pay_'+(pm.type||'other')))+(pm.label?' \u2014 '+esc(pm.label):'')+':</b> <span class="mut">'+esc(pm.value)+'</span></div>';
  }).join('')):'';
  return '<details class="pay"><summary>'+esc(T('buyc'))+'</summary>'+top+rows+'</details>';
}
function renderReader(head,cover){
  $('#commentsWrap').hidden=false; loadComments(S.post.id);
  var p=S.post, pages=p.pageHtml||[], i=Math.min(S.curPage,pages.length-1);
  var codeBtn = p.codeLink ? '<p><a class="code-btn" href="'+esc(p.codeLink)+'" target="_blank" rel="noopener">💻 '+esc(T('get_code'))+'</a></p>' : '';
  $('#postBody').innerHTML=head+cover+
    (!p.locked?payBox(p):'')+
    readerToolsBar()+
    audioPlayerBar()+
    '<div class="reader"><div class="prose" id="listenText">'+(pages[i]||'')+'</div>'+
    codeBtn+
    '<div class="reader-nav"><button class="btn sm ghost" type="button" id="pPrev" '+(i<=0?'disabled':'')+'>\u2190 '+esc(T('prev'))+'</button>'+
    '<span>'+T('page_of').replace('{n}',i+1).replace('{t}',pages.length)+'</span>'+
    '<button class="btn sm ghost" type="button" id="pNext" '+(i>=pages.length-1?'disabled':'')+'>'+esc(T('next'))+' \u2192</button></div></div>'+
    reactionsBar(p.id)+
    authorBox()+waCommunityBox()+
    shareBar(p)+saveBtn(p);
  setupCodeBlocks();
  setupAudioListeners();
}
function goPage(delta){
  var pages=(S.post.pageHtml||[]);
  S.curPage=Math.max(0,Math.min(pages.length-1,S.curPage+delta));
  stopListen();
  renderPost();
  $('.reader').scrollIntoView({behavior:'smooth',block:'start'});
}

/* ---------- Enhanced Multi-Platform Share Bars ---------- */
function siteShareBar(){
  var u=encodeURIComponent(location.origin+'/'), t=encodeURIComponent(document.title);
  var rawUrl = location.origin+'/';
  $('#siteShare').innerHTML='<span>'+esc(T('share'))+'</span>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text='+t+'%20'+u+'" title="WhatsApp">WhatsApp</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u='+u+'" title="Facebook">Facebook</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text='+t+'&url='+u+'" title="X (Twitter)">X</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url='+u+'" title="LinkedIn">LinkedIn</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://pinterest.com/pin/create/button/?url='+u+'&description='+t+'" title="Pinterest">Pinterest</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://t.me/share/url?url='+u+'&text='+t+'" title="Telegram">Telegram</a>'+
    (navigator.share?'<button class="btn sm ghost" type="button" id="siteNativeShare" title="More apps">📲 More</button>':'')+
    '<button class="btn sm ghost" type="button" id="siteCopy">📋 '+esc(T('copy'))+'</button>';
}

function shareBar(p){
  var rawUrl = location.origin+'/p/'+p.id;
  var u=encodeURIComponent(rawUrl), t=encodeURIComponent(p.title);
  return '<div class="share"><span>'+esc(T('share'))+'</span>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text='+t+'%20'+u+'" title="WhatsApp">WhatsApp</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u='+u+'" title="Facebook">Facebook</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text='+t+'&url='+u+'" title="X (Twitter)">X</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url='+u+'" title="LinkedIn">LinkedIn</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://pinterest.com/pin/create/button/?url='+u+'&description='+t+'" title="Pinterest">Pinterest</a>'+
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://t.me/share/url?url='+u+'&text='+t+'" title="Telegram">Telegram</a>'+
    (navigator.share?'<button class="btn sm ghost" type="button" data-native-share="'+rawUrl+'" data-native-title="'+esc(p.title)+'" title="More apps">📲 More</button>':'')+
    '<button class="btn sm ghost" type="button" data-copy="1">📋 '+esc(T('copy'))+'</button></div>';
}

function showPost(id){
  $('#home').hidden=true; $('#postView').hidden=false;
  S.curPage=0; S.unlocked=false; S.pending=false; stopListen();
  var seenKey='v_'+id, seen=SS.get(seenKey); SS.set(seenKey,'1');
  api('posts/'+id,{noCount:!!seen}).then(function(p){
    S.post=p;
    var savedEmail=LS.get('bookEmail');
    if(p.type==='book'&&p.locked&&savedEmail){
      return unlockBook(id,savedEmail,true).catch(function(){renderPost()});
    }
    renderPost();
  }).catch(function(){
    $('#commentsWrap').hidden=true;
    $('#relatedWrap').hidden=true;
    $('#postBody').innerHTML='<a class="back" href="/">'+esc(T('back'))+'</a><p>'+esc(T('notfound'))+'</p>';
  }).then(function(){var s=$('#ssr');if(s)s.remove()});
}
function unlockBook(id,email,silent){
  return api('unlock/'+id,{method:'POST',body:JSON.stringify({email:email})}).then(function(j){
    LS.set('bookEmail',email);
    if(j.pending){
      S.pending=true; S.unlocked=false;
      renderPost();
      return;
    }
    S.post=Object.assign({},S.post,{locked:false,pageHtml:j.pageHtml});
    S.unlocked=true; S.pending=false;
    renderPost();
  }).catch(function(e){
    if(!silent){$('#g-err').textContent=T('gate_err')}
    throw e;
  });
}

/* ---------- Robust Chunked Audio Synthesis Engine ---------- */
function getBestVoice(targetLang){
  if(!('speechSynthesis' in window)) return null;
  var voices = window.speechSynthesis.getVoices();
  if(!voices || !voices.length) return null;
  var prefix = targetLang === 'ar' ? 'ar' : (targetLang === 'ha' ? 'ha' : 'en');
  var match = voices.find(function(v){ return v.lang && v.lang.toLowerCase().indexOf(prefix) === 0; });
  if(match) return match;
  var enMatch = voices.find(function(v){ return v.lang && v.lang.toLowerCase().indexOf('en') === 0; });
  return enMatch || voices[0] || null;
}

function splitTextChunks(text, maxLen){
  maxLen = maxLen || 140;
  var sentences = (text || '').replace(/\s+/g,' ').trim().split(/(?<=[.?!;:\n])\s+/);
  var chunks = [];
  var cur = '';
  sentences.forEach(function(s){
    if((cur + ' ' + s).length > maxLen && cur.length > 0){
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur = (cur ? cur + ' ' : '') + s;
    }
  });
  if(cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function stopListen(){
  try{window.speechSynthesis && window.speechSynthesis.cancel()}catch(e){}
  audioState.speaking = false;
  audioState.chunks = [];
  audioState.chunkIdx = 0;
  var playBtn = $('#audioPlayBtn'), stopBtn = $('#audioStopBtn'), wave = $('#audioWave');
  if(playBtn) playBtn.textContent = '▶ ' + T('listen');
  if(stopBtn) stopBtn.style.display = 'none';
  if(wave) wave.style.display = 'none';
}

function speakChunk(){
  if(!audioState.speaking || audioState.chunkIdx >= audioState.chunks.length){
    stopListen();
    return;
  }
  var text = audioState.chunks[audioState.chunkIdx];
  var u = new SpeechSynthesisUtterance(text);
  u.rate = audioState.speed || 1;
  var voice = getBestVoice(lang);
  if(voice){
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = lang === 'ar' ? 'ar-SA' : (lang === 'ha' ? 'ha-NG' : 'en-US');
  }
  u.onend = function(){
    if(!audioState.speaking) return;
    audioState.chunkIdx++;
    speakChunk();
  };
  u.onerror = function(){
    if(!audioState.speaking) return;
    audioState.chunkIdx++;
    if(audioState.chunkIdx < audioState.chunks.length) speakChunk();
    else stopListen();
  };
  window.speechSynthesis.speak(u);
}

function startListen(){
  if(!('speechSynthesis' in window)){
    toast('Audio playback is not supported on this browser.');
    return;
  }
  var el = $('#listenText');
  if(!el) return;
  var raw = el.textContent || '';
  if(!raw.trim()){ toast('No text available to read.'); return; }

  audioState.chunks = splitTextChunks(raw, 140);
  audioState.chunkIdx = 0;
  audioState.speaking = true;

  var playBtn = $('#audioPlayBtn'), stopBtn = $('#audioStopBtn'), wave = $('#audioWave');
  if(playBtn) playBtn.textContent = '⏸ Pause';
  if(stopBtn) stopBtn.style.display = 'inline-block';
  if(wave) wave.style.display = 'inline-flex';

  window.speechSynthesis.cancel();
  speakChunk();
}

function toggleAudio(){
  if(audioState.speaking){
    stopListen();
  } else {
    startListen();
  }
}

function setupAudioListeners(){
  var playBtn = $('#audioPlayBtn');
  if(playBtn) playBtn.onclick = toggleAudio;
  var stopBtn = $('#audioStopBtn');
  if(stopBtn) stopBtn.onclick = stopListen;
  $$('.speed-btn').forEach(function(b){
    b.onclick = function(){
      $$('.speed-btn').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      audioState.speed = parseFloat(b.getAttribute('data-spd')) || 1;
      if(audioState.speaking){
        window.speechSynthesis.cancel();
        speakChunk();
      }
    };
  });

  // Reader Controls
  var dec = $('#fontDec'), inc = $('#fontInc'), toggleF = $('#fontFamilyToggle'), prn = $('#printDocBtn');
  var proseEl = $('#listenText');
  var curSize = 1.13;
  if(dec && proseEl){
    dec.onclick = function(){
      curSize = Math.max(0.9, curSize - 0.1);
      proseEl.style.fontSize = curSize + 'rem';
    };
  }
  if(inc && proseEl){
    inc.onclick = function(){
      curSize = Math.min(1.6, curSize + 0.1);
      proseEl.style.fontSize = curSize + 'rem';
    };
  }
  if(toggleF && proseEl){
    toggleF.onclick = function(){
      proseEl.classList.toggle('sans-mode');
    };
  }
  if(prn){
    prn.onclick = function(){
      window.print();
    };
  }
}

/* Ensure speech voices load asynchronously */
if('speechSynthesis' in window){
  window.speechSynthesis.onvoiceschanged = function(){
    getBestVoice(lang);
  };
}

/* ---------- Quote & Share Tooltip Logic ---------- */
var quoteBox = $('#quoteTooltip');
document.addEventListener('mouseup', function(){
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if(!text || text.length < 5 || !$('#listenText') || !$('#listenText').contains(sel.anchorNode)){
    if(quoteBox) quoteBox.style.display = 'none';
    return;
  }
  var r = sel.getRangeAt(0).getBoundingClientRect();
  if(quoteBox){
    quoteBox.style.left = (r.left + r.width / 2 + window.scrollX) + 'px';
    quoteBox.style.top = (r.top + window.scrollY - 8) + 'px';
    quoteBox.style.display = 'flex';
  }
});
document.addEventListener('mousedown', function(e){
  if(quoteBox && !quoteBox.contains(e.target) && !window.getSelection().toString()){
    quoteBox.style.display = 'none';
  }
});
if($('#quoteWa')){
  $('#quoteWa').onclick = function(){
    var sel = window.getSelection().toString().trim();
    if(!sel) return;
    var u = location.href;
    var shareTxt = '“' + sel + '” — Read on Allarbaa.cloud: ' + u;
    window.open('https://wa.me/?text=' + encodeURIComponent(shareTxt), '_blank');
    if(quoteBox) quoteBox.style.display = 'none';
  };
}
if($('#quoteCopy')){
  $('#quoteCopy').onclick = function(){
    var sel = window.getSelection().toString().trim();
    if(!sel) return;
    navigator.clipboard.writeText('“' + sel + '” — ' + location.href).then(function(){
      toast(T('quote_copied'));
    });
    if(quoteBox) quoteBox.style.display = 'none';
  };
}

/* ---------- Daily Tech Trivia Widget ---------- */
var TRIVIA_DATA = [
  {
    q: { en: "What does HTML stand for?", ha: "Mecece ma'anar HTML?", ar: "ماذا يعني اختصار HTML؟" },
    opts: [
      { t: "HyperText Markup Language", c: true },
      { t: "HighText Machine Learning", c: false },
      { t: "HyperTransfer Multi Link", c: false }
    ]
  },
  {
    q: { en: "Which company originally created the JavaScript programming language?", ha: "Wane kamfani ne ya fara ƙirƙirar yaren JavaScript?", ar: "أي شركة أنشأت لغة جافاسكريبت أولاً؟" },
    opts: [
      { t: "Netscape", c: true },
      { t: "Microsoft", c: false },
      { t: "Google", c: false }
    ]
  },
  {
    q: { en: "Which port does standard HTTPS web traffic use?", ha: "Wace lamba (port) ce amintaccen HTTPS ke amfani da ita?", ar: "ما هو المنفذ الافتراضي لبروتوكول HTTPS؟" },
    opts: [
      { t: "443", c: true },
      { t: "80", c: false },
      { t: "8080", c: false }
    ]
  }
];

var triviaAnswers = {};

function renderTrivia(){
  var box = $('#triviaContent'), scoreEl = $('#triviaScore');
  if(!box) return;
  var correctCount = 0;
  box.innerHTML = TRIVIA_DATA.map(function(item, idx){
    var qTxt = item.q[lang] || item.q.en;
    var userAns = triviaAnswers[idx];
    if(userAns !== undefined && item.opts[userAns] && item.opts[userAns].c) correctCount++;
    return '<div class="trivia-q">' +
      '<b>#' + (idx+1) + '. ' + esc(qTxt) + '</b>' +
      '<div class="trivia-opts">' +
      item.opts.map(function(opt, oIdx){
        var isSelected = userAns === oIdx;
        var cls = 'trivia-opt';
        if(userAns !== undefined){
          if(opt.c) cls += ' correct';
          else if(isSelected) cls += ' wrong';
        }
        var disabled = userAns !== undefined ? 'disabled' : '';
        return '<button type="button" class="'+cls+'" data-tq="'+idx+'" data-to="'+oIdx+'" '+disabled+'>'+esc(opt.t)+'</button>';
      }).join('') +
      '</div></div>';
  }).join('');
  if(scoreEl){
    scoreEl.textContent = T('trivia_score').replace('{s}', correctCount).replace('{t}', TRIVIA_DATA.length);
  }
}

document.addEventListener('click', function(e){
  var tBtn = e.target.closest('button[data-tq]');
  if(tBtn){
    var qIdx = +tBtn.getAttribute('data-tq');
    var oIdx = +tBtn.getAttribute('data-to');
    if(triviaAnswers[qIdx] === undefined){
      triviaAnswers[qIdx] = oIdx;
      renderTrivia();
    }
  }
  // Native share clicks
  var natBtn = e.target.closest('[data-native-share]');
  if(natBtn && navigator.share){
    var nUrl = natBtn.getAttribute('data-native-share');
    var nTitle = natBtn.getAttribute('data-native-title') || document.title;
    navigator.share({ title: nTitle, url: nUrl }).catch(function(){});
  }
  if(e.target.closest('#siteNativeShare') && navigator.share){
    navigator.share({ title: document.title, url: location.origin+'/' }).catch(function(){});
  }
  // Reactions clicks
  var rxBtn = e.target.closest('.rx-btn');
  if(rxBtn){
    var pBox = rxBtn.closest('.reactions-box');
    if(pBox){
      var pid = pBox.getAttribute('data-pid');
      var rType = rxBtn.getAttribute('data-rx');
      handleReaction(pid, rType);
    }
  }
});


//END-OF-FILE
