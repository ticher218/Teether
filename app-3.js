/* ---------- admin ---------- */
function setTab(t){
  S.tab=t;
  $$('#atabs button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-t')===t)});
  ['blog','book','product','links','subs','comments','claims','code'].forEach(function(x){$('#tab-'+x).hidden=(x!==t)});
  if(t==='subs') loadSubs();
  if(t==='comments') loadAllComments();
  if(t==='claims') loadClaims();
}
function loadClaims(){
  api('claims').then(function(j){S.claimsList=j.claims||[];renderClaims()}).catch(function(){toast('Could not load purchases')});
}
function renderClaims(){
  $('#clList').innerHTML=S.claimsList.length?S.claimsList.map(function(c){
    return '<div class="mrow"><span dir="ltr"><b>'+esc(c.email)+'</b> <span class="views">— "'+esc(c.bookTitle)+'"</span></span><span class="acts"><button class="btn sm" type="button" data-claim-ok="1" data-book="'+esc(c.bookId)+'" data-email="'+esc(c.email)+'">Approve</button><button class="btn sm danger" type="button" data-claim-no="1" data-book="'+esc(c.bookId)+'" data-email="'+esc(c.email)+'">Reject</button></span></div>';
  }).join(''):'<p class="mut">No pending purchases.</p>';
}
function loadStats(){
  api('stats').then(function(j){$('#siteStats').textContent='Total site views: '+j.views}).catch(function(){});
}
function loadAllComments(){
  api('allcomments').then(function(j){S.comments=j.comments||[];renderAdminComments()}).catch(function(){toast('Could not load comments')});
}
function renderAdminComments(){
  $('#cList').innerHTML=S.comments.length?S.comments.map(function(c){
    return '<div class="mrow"><span>'+(c.name?'<b>'+esc(c.name)+'</b>: ':'')+esc(c.text)+' <span class="views">on "'+esc(c.postTitle)+'"</span></span><span class="acts"><button class="btn sm danger" type="button" data-act="rmcomment" data-post="'+esc(c.postId)+'" data-cid="'+esc(c.id)+'">Delete</button></span></div>';
  }).join(''):'<p class="mut">No comments yet.</p>';
}
function loadSubs(){
  api('subscribers').then(function(j){S.subs=j.subscribers||[];renderSubs()}).catch(function(){toast('Could not load followers')});
}
function renderSubs(){
  $('#subCount').textContent=S.subs.length;
  $('#subList').innerHTML=S.subs.length?S.subs.map(function(x){
    return '<div class="mrow"><span dir="ltr">'+esc(x.email)+'</span><span class="acts"><button class="btn sm danger" type="button" data-act="rmsub" data-email="'+esc(x.email)+'">Remove</button></span></div>';
  }).join(''):'<p class="mut">No followers yet.</p>';
}
function removeSub(email){
  if(!confirm('Remove '+email+'?')) return;
  api('subscribers?email='+encodeURIComponent(email),{method:'DELETE'}).then(loadSubs).catch(function(){toast('Could not remove')});
}
function follow(){
  var em=$('#f-email').value.trim(), msg=$('#f-msg');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){msg.textContent=T('f_err');return}
  $('#f-btn').disabled=true;
  api('subscribe',{method:'POST',body:JSON.stringify({email:em,website:$('#f-hp').value})}).then(function(){
    msg.textContent=T('f_ok');$('#f-email').value='';
    try{if(typeof gtag==='function')gtag('event','subscribe',{method:'email'})}catch(e){}
  }).catch(function(){msg.textContent=T('f_err')}).then(function(){$('#f-btn').disabled=false});
}
function val(k,f){var e=$('#'+k+'-'+f);return e?e.value.trim():''}
function renderPayMethods(){
  var el=$('#pay-methods');
  el.innerHTML=S.payMethods.map(function(pm,i){
    var opts=PAY_TYPES.map(function(t){return '<option value="'+t+'"'+(pm.type===t?' selected':'')+'>'+esc(T('pay_'+t))+'</option>'}).join('');
    return '<div class="payed" data-i="'+i+'">'+
      '<select class="fld" data-pf="type" data-pi="'+i+'">'+opts+'</select>'+
      '<input type="text" data-pf="value" data-pi="'+i+'" value="'+esc(pm.value)+'" placeholder="Account number, USSD code, PayPal link...">'+
      '<button class="btn sm danger" type="button" data-rmpay="'+i+'">Remove</button></div>';
  }).join('')||'<p class="mut">No payment methods yet.</p>';
}
function syncPayMethods(){
  $$('#pay-methods [data-pf]').forEach(function(el){
    var i=+el.getAttribute('data-pi'), f=el.getAttribute('data-pf');
    if(!S.payMethods[i])return; S.payMethods[i][f]=el.value;
  });
}
function renderBookPages(){
  var el=$('#book-pages');
  el.innerHTML=S.bookPages.map(function(txt,i){
    return '<div class="pageed" data-i="'+i+'"><div class="ph"><span>Page '+(i+1)+'</span>'+(S.bookPages.length>1?'<button class="btn sm ghost" type="button" data-rmpage="'+i+'">Remove</button>':'')+'</div><textarea data-page="'+i+'" placeholder="Write page '+(i+1)+' here...">'+esc(txt)+'</textarea></div>';
  }).join('');
}
function syncBookPages(){
  $$('#book-pages textarea').forEach(function(t){S.bookPages[+t.getAttribute('data-page')]=t.value});
}
function resetForm(k){
  S.editing[k]=null;S.newImgs[k]=null;
  ['title','content','link','price','code-link','tags'].forEach(function(f){var e=$('#'+k+'-'+f);if(e)e.value=''});
  if(k==='book'){S.bookPages=[''];renderBookPages()}
  var st=$('#'+k+'-store');if(st)st.value='amazon';
  $('#'+k+'-imgs').value='';$('#'+k+'-prev').innerHTML='';
  $('#'+k+'-h').textContent=HEAD[k][0];$('#'+k+'-save').textContent='Publish';$('#'+k+'-cancel').hidden=true;
}
function renderMgr(){
  KINDS.forEach(function(k){
    var el=$('#mgr-'+k); if(!el) return;
    var list=S.posts.filter(function(p){return p.type===k});
    el.innerHTML=list.length?list.map(function(p){
      var badge=p.status==='draft'?' <span class="views" style="color:var(--warm)">(draft)</span>':'';
      return '<div class="mrow"><span>'+esc(p.title)+badge+(p.type!=='product'&&p.views?' <span class="views">('+p.views+' '+esc(T('views'))+')</span>':'')+'</span><span class="acts"><button class="btn sm ghost" type="button" data-act="edit" data-id="'+p.id+'">Edit</button><button class="btn sm danger" type="button" data-act="del" data-id="'+p.id+'">Delete</button></span></div>';
    }).join(''):'<p class="mut">Nothing here yet.</p>';
  });
}
function showAdmin(){$('#admin').hidden=false;setTab(S.tab);renderMgr();fillSettings();loadStats();renderBookPages()}

function buildSettingsForm(){
  if($('#setSocial').children.length) return;
  $('#setSocial').innerHTML=SOC.map(function(x){return '<div><label for="s-'+x[0]+'">'+x[1]+'</label><input type="text" id="s-'+x[0]+'" placeholder="'+(x[0]==='wa'?'2348012345678':'https://... or @yourname')+'"></div>'}).join('');
  $('#setStores').innerHTML=STO.map(function(x){var k=x[0];
    return '<div class="storebox"><b>'+x[1]+'</b>'+
      '<label for="st-'+k+'-link">Store link</label><input type="text" id="st-'+k+'-link" placeholder="https://...">'+
      '<label for="st-'+k+'-id">Store ID (your affiliate ID)</label><input type="text" id="st-'+k+'-id">'+
      (k==='amazon'?'<p class="mut hint">Your Amazon ID (like yourname-20) is added to every Amazon link automatically.</p>':'<p class="mut hint">For '+x[1]+', paste the full affiliate link in Store link.</p>')+
      '<label for="st-'+k+'-img">Picture or logo (optional)</label><input type="file" id="st-'+k+'-img" data-simg="'+k+'" accept="image/*">'+
      '<div class="prev" id="st-'+k+'-prev"></div></div>';
  }).join('');
}
function fillSettings(){
  var s=S.settings; if(!s) return;
  buildSettingsForm();
  SOC.forEach(function(x){$('#s-'+x[0]).value=(s.social&&s.social[x[0]])||''});
  STO.forEach(function(x){
    var k=x[0],o=(s.stores&&s.stores[k])||{};
    $('#st-'+k+'-link').value=o.link||'';$('#st-'+k+'-id').value=o.id||'';
    var pv=$('#st-'+k+'-prev');pv.innerHTML='';
    if(o.img){pv.innerHTML='<img src="/api/simg/'+k+'?v='+o.img+'" alt=""> <button class="btn sm ghost" type="button" data-rm="'+k+'">Remove picture</button>'}
  });
  if($('#s-email')) $('#s-email').value=s.email||'';
  if($('#s-wachannel')) $('#s-wachannel').value=s.waChannel||'';
  if($('#s-authorbio')) $('#s-authorbio').value=s.authorBio||'';
  $('#s-phones').value=(s.phones||[]).join('\n');
  $('#s-coffee').value=(s.social&&s.social.coffee)||'';
  if(s.logo){
    $('#s-logo-prev').innerHTML='<img src="'+s.logo+'" style="width:60px;height:60px;object-fit:cover;border-radius:10px"> <button class="btn sm ghost" type="button" id="rmLogo">Remove custom logo</button>';
  } else {$('#s-logo-prev').innerHTML=''}
  S.payMethods=(s.payments||[]).map(function(p){return {type:p.type,label:p.label,value:p.value}});
  renderPayMethods();
  var cc=s.customCode||{};
  $('#cc-head').value=cc.head||'';$('#cc-css').value=cc.css||'';$('#cc-js').value=cc.bodyJs||'';
}

function adminUnlock(key){
  S.key=key;
  return api('login',{method:'POST'}).then(function(){S.admin=true;SS.set('ak',key);LS.set('owner','1');OWNER=true;showAdmin();return true}).catch(function(e){S.key='';S.admin=false;SS.del('ak');throw e});
}
function insertAt(el,s){
  var a=typeof el.selectionStart==='number'?el.selectionStart:el.value.length, b=typeof el.selectionEnd==='number'?el.selectionEnd:a;
  el.value=el.value.slice(0,a)+s+el.value.slice(b);el.focus();el.selectionStart=el.selectionEnd=a+s.length;
}
function affiliate(kind){
  var t=$('#a-text').value.replace(/[|\[\]]/g,'').trim(), u=$('#a-url').value.trim();
  if(!t||!u){toast('Add the text and the link first');return}
  if(!/^https?:\/\//i.test(u)) u='https://'+u;
  insertAt($('#blog-content'),kind==='btn'?'\n\n[[btn:'+t+'|'+u+']]\n\n':'['+t+']('+u+')');
  $('#a-text').value='';$('#a-url').value='';
}
function compress(file,max){
  return new Promise(function(res,rej){
    var fr=new FileReader();fr.onerror=rej;
    fr.onload=function(){var im=new Image();im.onerror=rej;im.onload=function(){
      var w=im.width,h=im.height,k=Math.min(1,max/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);
      var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);
      res(c.toDataURL('image/jpeg',0.8));};im.src=fr.result};
    fr.readAsDataURL(file);
  });
}
function onImgs(k){
  var files=Array.prototype.slice.call($('#'+k+'-imgs').files,0,LIM[k]), prev=$('#'+k+'-prev'); prev.innerHTML='';
  if(!files.length){S.newImgs[k]=null;return}
  Promise.all(files.map(function(f){return compress(f,1100)})).then(function(arr){
    S.newImgs[k]=arr; arr.forEach(function(d){var i=document.createElement('img');i.src=d;i.alt='';prev.appendChild(i)});
  }).catch(function(){toast('Could not read that photo');S.newImgs[k]=null});
}
function save(k,status){
  var title=val(k,'title'), content=val(k,'content'), link=val(k,'link');
  if(k==='book') syncBookPages();
  var pages=k==='book'?S.bookPages.map(function(t){return t.trim()}).filter(Boolean):null;
  if(!title){toast('Add a title');return}
  if(k==='blog'&&!content){toast('Add the content');return}
  if(k==='product'&&!link){toast('Add the product link');return}
  if(k==='book'&&!pages.length&&status!=='draft'){toast('Add at least one page, or save as draft');return}
  var body={type:k,title:title,content:content,link:link,status:status||'published'};
  if(k==='product'){body.store=val(k,'store');body.price=val(k,'price')}
  if(k==='book'){body.pages=pages;body.price=val(k,'price');body.codeLink=val(k,'code-link')}
  if(k==='blog'){body.codeLink=val(k,'code-link')}
  if(k==='blog'||k==='book'){body.tags=val(k,'tags')}
  if(S.newImgs[k]!=null) body.images=S.newImgs[k];
  var btns=[$('#'+k+'-save'),$('#'+k+'-draft')].filter(Boolean);btns.forEach(function(b){b.disabled=true});
  var editing=S.editing[k];
  api(editing?'posts/'+editing:'posts',{method:editing?'PUT':'POST',body:JSON.stringify(body)}).then(function(){
    toast(status==='draft'?'Saved as draft':(editing?'Saved':'Published')); resetForm(k); return loadPosts();
  }).catch(function(e){toast(e.status===401?'Wrong or missing password. Unlock again.':'Could not save ('+(e.code||'error')+')')}).then(function(){btns.forEach(function(b){b.disabled=false})});
}
function edit(id){
  api('posts/'+id).then(function(p){
    var k=p.type; if(KINDS.indexOf(k)<0) return;
    setTab(k);S.editing[k]=id;S.newImgs[k]=null;
    $('#'+k+'-title').value=p.title;$('#'+k+'-content').value=p.content||'';
    if($('#'+k+'-link'))$('#'+k+'-link').value=p.link||'';
    if($('#'+k+'-code-link'))$('#'+k+'-code-link').value=p.codeLink||'';
    if($('#'+k+'-tags'))$('#'+k+'-tags').value=(p.tags||[]).join(', ');
    if(k==='product'){$('#product-store').value=p.store||'amazon';$('#product-price').value=p.price||''}
    if(k==='book'){$('#book-price').value=p.price||'';S.bookPages=(p.pages&&p.pages.length?p.pages.slice():['']);renderBookPages()}
    $('#'+k+'-imgs').value='';
    var pv=$('#'+k+'-prev');pv.innerHTML='';
    if(p.imgCount){pv.innerHTML='<span>'+p.imgCount+' photo(s) kept. Choose new photos to replace them.</span> ';
      var b=document.createElement('button');b.type='button';b.className='btn sm ghost';b.textContent='Remove photos';b.onclick=function(){S.newImgs[k]=[];pv.textContent='Photos will be removed when you save.'};pv.appendChild(b)}
    $('#'+k+'-h').textContent=HEAD[k][1];$('#'+k+'-save').textContent='Save changes';$('#'+k+'-cancel').hidden=false;
    $('#tab-'+k).scrollIntoView({behavior:'smooth'});
  }).catch(function(){toast('Could not open this item')});
}
function del(id){
  if(!confirm('Delete this? This cannot be undone.')) return;
  api('posts/'+id,{method:'DELETE'}).then(function(){toast('Deleted');KINDS.forEach(function(k){if(S.editing[k]===id)resetForm(k)});return loadPosts()}).catch(function(){toast('Could not delete')});
}
function saveSettings(){
  syncPayMethods();
  var b={
    email:($('#s-email')?$('#s-email').value.trim():''),
    waChannel:($('#s-wachannel')?$('#s-wachannel').value.trim():''),
    authorBio:($('#s-authorbio')?$('#s-authorbio').value.trim():''),
    social:{},
    stores:{},
    phones:$('#s-phones').value.split('\n').map(function(x){return x.trim()}).filter(Boolean),
    storeImgs:S.storeImgs,
    payments:S.payMethods
  };
  if(S.uploadedLogo) b.logo = S.uploadedLogo;
  else if(S.removeLogo) b.logo = '';

  SOC.forEach(function(x){b.social[x[0]]=$('#s-'+x[0]).value.trim()});
  b.social.coffee=$('#s-coffee').value.trim();
  STO.forEach(function(x){b.stores[x[0]]={link:$('#st-'+x[0]+'-link').value.trim(),id:$('#st-'+x[0]+'-id').value.trim()}});
  api('settings',{method:'PUT',body:JSON.stringify(b)}).then(function(j){
    S.settings=j;S.storeImgs={};S.uploadedLogo=null;S.removeLogo=false;
    renderStorage();fillSettings();toast('Saved. Changes are now live on the main page.');
  }).catch(function(e){toast(e.status===401?'Unlock again':'Could not save settings')});
}

/* ---------- events ---------- */
$('#langs').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;lang=b.getAttribute('data-l');LS.set('tl',lang);applyLang()});
$('#tabs').addEventListener('click',function(e){var b=e.target.closest('button');if(b)setFilter(b.getAttribute('data-f'))});
$$('.tile[data-f]').forEach(function(a){a.addEventListener('click',function(){setFilter(a.getAttribute('data-f'))})});
$('#supportLinks').addEventListener('click',function(e){var a=e.target.closest('[data-f]');if(a)setFilter(a.getAttribute('data-f'))});
$('#admin').addEventListener('click',function(e){
  var b=e.target.closest('button[data-act]');
  if(b){var act=b.getAttribute('data-act');if(act==='rmsub')removeSub(b.getAttribute('data-email'));else if(act==='edit')edit(b.getAttribute('data-id'));else del(b.getAttribute('data-id'));return}
  var r=e.target.closest('button[data-rm]');
  if(r){var k=r.getAttribute('data-rm');S.storeImgs[k]=null;$('#st-'+k+'-prev').textContent='Picture will be removed when you save.'}
  if(e.target.closest('#rmLogo')){S.removeLogo=true;S.uploadedLogo=null;$('#s-logo-prev').textContent='Logo will be reset to default when you save.'}
});
$('#atabs').addEventListener('click',function(e){var b=e.target.closest('button');if(b)setTab(b.getAttribute('data-t'))});
$('#setStores').addEventListener('change',function(e){
  var i=e.target.closest('input[data-simg]');if(!i||!i.files[0])return;
  var k=i.getAttribute('data-simg');
  compress(i.files[0],420).then(function(d){S.storeImgs[k]=d;$('#st-'+k+'-prev').innerHTML='<img src="'+d+'" alt="">'}).catch(function(){toast('Could not read that picture')});
});
var logoInput=$('#s-logo');
if(logoInput){
  logoInput.addEventListener('change',function(){
    if(!this.files||!this.files[0]) return;
    compress(this.files[0],400).then(function(d){
      S.uploadedLogo=d;S.removeLogo=false;
      $('#s-logo-prev').innerHTML='<img src="'+d+'" style="width:60px;height:60px;object-fit:cover;border-radius:10px"> <span class="hint">Preview ready. Press Save below to apply.</span>';
    }).catch(function(){toast('Could not process logo image')});
  });
}
$('#admLink').addEventListener('click',function(){
  if(S.admin){if($('#postView').hidden){showAdmin();$('#admin').scrollIntoView({behavior:'smooth'})}else location.href='/#admin';return}
  $('#pwErr').textContent='';$('#pw').value='';$('#modal').hidden=false;$('#pw').focus();
});
window.addEventListener('keydown',function(e){
  if(e.ctrlKey&&e.altKey&&e.key.toLowerCase()==='a'){
    $('#admLink').click();
  }
});
$('#pwNo').addEventListener('click',function(){$('#modal').hidden=true});
function tryUnlock(){
  var v=$('#pw').value; if(!v) return;
  adminUnlock(v).then(function(){$('#modal').hidden=true;if(!$('#postView').hidden){location.href='/#admin'}else $('#admin').scrollIntoView({behavior:'smooth'})}).catch(function(e){
    $('#pwErr').textContent=e.code==='kv_missing'?'Storage is not connected yet. Add the KV binding named BLOG, then redeploy.':e.code==='password_not_set'?'Add the ADMIN_PASSWORD variable in Cloudflare, then redeploy.':'Wrong password.';
  });
}
$('#pwOk').addEventListener('click',tryUnlock);
$('#pw').addEventListener('keydown',function(e){if(e.key==='Enter')tryUnlock()});
$('#lockBtn').addEventListener('click',function(){S.admin=false;S.key='';SS.del('ak');$('#admin').hidden=true;KINDS.forEach(resetForm)});
KINDS.forEach(function(k){
  $('#'+k+'-imgs').addEventListener('change',function(){onImgs(k)});
  $('#'+k+'-save').addEventListener('click',function(){save(k)});
  $('#'+k+'-cancel').addEventListener('click',function(){resetForm(k)});
});
$('#a-btn').addEventListener('click',function affiliateBtn(){affiliate('btn')});
$('#a-lnk').addEventListener('click',function affiliateLnk(){affiliate('lnk')});
$('#saveSet').addEventListener('click',saveSettings);
$('#postBody').addEventListener('click',function(e){
  var g=e.target.closest('#g-go');
  if(g){
    var em=$('#g-email').value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){$('#g-err').textContent=T('gate_err');return}
    if($('#g-hp').value){return}
    g.disabled=true;
    unlockBook(S.post.id,em,false).catch(function(){}).then(function(){g.disabled=false});
    return;
  }
  var pp=e.target.closest('#pPrev'); if(pp&&!pp.disabled){goPage(-1);return}
  var pn=e.target.closest('#pNext'); if(pn&&!pn.disabled){goPage(1);return}
  var sv=e.target.closest('#saveToggle');
  if(sv){var on=toggleSaved(sv.getAttribute('data-id'));sv.classList.toggle('on',on);sv.innerHTML=(on?'★ ':'☆ ')+esc(T(on?'saved':'save'));renderSavedSection();return}
});
$('#c-send').addEventListener('click',sendComment);
$('#q').addEventListener('input',function(){S.q=this.value;renderPosts()});

/* ---------- Book search: straight to the results page of the chosen library ---------- */
var rf=$('#researchForm');
if(rf){
  rf.addEventListener('submit',function(e){
    e.preventDefault();
    var q=encodeURIComponent((rf.elements['q'].value||'').trim());
    if(!q) return;
    var base={
      gb:'https://www.google.com/search?tbm=bks&q=',
      ol:'https://openlibrary.org/search?q=',
      ia:'https://archive.org/search?query=',
      pg:'https://www.gutenberg.org/ebooks/search/?query='
    }[rf.elements['src'].value]||'https://www.google.com/search?tbm=bks&q=';
    window.open(base+q,'_blank','noopener');
  });
}

/* ---------- Real-Time Input Live Search Filter ---------- */
var liveInput=$('#liveSearch');
if(liveInput){
  liveInput.addEventListener('input',function(){
    var val=this.value.trim().toLowerCase();
    $$('.pc').forEach(function(card){
      var title=(card.querySelector('h3')?card.querySelector('h3').textContent:'').toLowerCase();
      var ds=(card.getAttribute('data-search')||'').toLowerCase();
      var desc=(card.querySelector('p')?card.querySelector('p').textContent:'').toLowerCase();
      var match=!val||title.indexOf(val)>=0||ds.indexOf(val)>=0||desc.indexOf(val)>=0;
      card.style.display=match?'':'none';
    });
  });
}

$('#pay-add').addEventListener('click',function(){syncPayMethods();S.payMethods.push({type:'bank',label:'',value:''});renderPayMethods()});
$('#pay-methods').addEventListener('click',function(e){
  var b=e.target.closest('button[data-rmpay]');if(!b)return;
  syncPayMethods();S.payMethods.splice(+b.getAttribute('data-rmpay'),1);renderPayMethods();
});
$('#book-addpage').addEventListener('click',function(){syncBookPages();S.bookPages.push('');renderBookPages()});
$('#book-pages').addEventListener('click',function(e){
  var b=e.target.closest('button[data-rmpage]');if(!b)return;
  syncBookPages();S.bookPages.splice(+b.getAttribute('data-rmpage'),1);if(!S.bookPages.length)S.bookPages=[''];renderBookPages();
});
$('#book-pages').addEventListener('input',function(e){
  var t=e.target.closest('textarea[data-page]');if(!t)return;S.bookPages[+t.getAttribute('data-page')]=t.value;
});
$('#book-save').addEventListener('click',function(){save('book','published')});
$('#book-draft').addEventListener('click',function(){save('book','draft')});
$('#cc-save').addEventListener('click',function(){
  var btn=$('#cc-save');btn.disabled=true;
  var body={social:S.settings?S.settings.social:{},stores:S.settings?S.settings.stores:{},phones:(S.settings&&S.settings.phones)||[],payments:(S.settings&&S.settings.payments)||[],
    customCode:{head:$('#cc-head').value,css:$('#cc-css').value,bodyJs:$('#cc-js').value}};
  api('settings',{method:'PUT',body:JSON.stringify(body)}).then(function(j){S.settings=j;toast('Custom code saved \u2014 live now')}).catch(function(e){toast(e.status===401?'Unlock again':'Could not save')}).then(function(){btn.disabled=false});
});
$('#clRefresh').addEventListener('click',loadClaims);
$('#clList').addEventListener('click',function(e){
  var ok=e.target.closest('[data-claim-ok]'), no=e.target.closest('[data-claim-no]'), b=ok||no;
  if(!b)return;
  api('claims',{method:'POST',body:JSON.stringify({bookId:b.getAttribute('data-book'),email:b.getAttribute('data-email'),approve:!!ok})}).then(loadClaims).catch(function(){toast('Could not update')});
});
$('#cRefresh').addEventListener('click',loadAllComments);
$('#cList').addEventListener('click',function(e){
  var b=e.target.closest('button[data-act="rmcomment"]');if(!b)return;
  if(!confirm('Delete this comment?'))return;
  api('comments/'+b.getAttribute('data-post')+'/'+b.getAttribute('data-cid'),{method:'DELETE'}).then(loadAllComments).catch(function(){toast('Could not delete')});
});
$('#f-btn').addEventListener('click',follow);
$('#f-email').addEventListener('keydown',function(e){if(e.key==='Enter')follow()});
$('#subRefresh').addEventListener('click',loadSubs);
$('#subCopy').addEventListener('click',function(){
  var t=S.subs.map(function(x){return x.email}).join(', ');
  if(!t){toast('No emails yet');return}
  try{navigator.clipboard.writeText(t).then(function(){toast('Copied '+S.subs.length+' emails')},function(){toast('Could not copy')})}catch(e){toast('Could not copy')}
});
$('#siteShare').addEventListener('click',function(e){
  if(!e.target.closest('#siteCopy')) return;
  var u=location.origin+'/';
  try{navigator.clipboard.writeText(u).then(function(){toast(T('copied'))},function(){prompt('',u)})}catch(err){prompt('',u)}
});
$('#postBody').addEventListener('click',function(e){
  if(!e.target.closest('[data-copy]')) return;
  var u=location.origin+location.pathname;
  try{navigator.clipboard.writeText(u).then(function(){toast(T('copied'))},function(){prompt('',u)})}catch(err){prompt('',u)}
});
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[rel~="sponsored"],a.aff-btn'); if(!a) return;
  try{if(typeof gtag==='function')gtag('event','affiliate_click',{link_url:a.href,link_domain:a.hostname,link_text:(a.textContent||'').trim().slice(0,80),page_path:location.pathname})}catch(err){}
});
$('#yr').textContent=new Date().getFullYear();
[0,1].forEach(function(i){$('#tile'+i).src=ph(i+1)});

/* ---------- floating WhatsApp ---------- */
function waLink(n,text){return 'https://wa.me/'+n.replace(/\D/g,'')+'?text='+encodeURIComponent(text)}
function buildWaMenu(){
  var text=T('wa_chat');
  $('#waMenu').innerHTML=WA_NUMBERS.map(function(n){
    return '<a href="'+waLink(n,'')+'" target="_blank" rel="noopener" dir="ltr">'+
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Z"/></svg>'+n+'</a>';
  }).join('');
}
$('#waBtn').addEventListener('click',function(){buildWaMenu();$('#waMenu').classList.toggle('show')});
document.addEventListener('click',function(e){if(!e.target.closest('.wa-wrap'))$('#waMenu').classList.remove('show')});

/* ---------- back to top ---------- */
window.addEventListener('scroll',function(){$('#topBtn').classList.toggle('show',window.scrollY>500)},{passive:true});
$('#topBtn').addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});

/* ---------- cookie banner ---------- */
if(!LS.get('cookieOk')){$('#cookieBar').hidden=false}
$('#cookieOk').addEventListener('click',function(){LS.set('cookieOk','1');$('#cookieBar').hidden=true});

/* ---------- offline app (PWA) ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});
}

if(!OWNER && !S.key && !SS.get('hitDone')){
  SS.set('hitDone','1');
  try{api('hit',{method:'POST'}).catch(function(){})}catch(e){}
}
if(location.hash==='#owner'||location.hash==='#visitor'){setTimeout(function(){toast(OWNER?'Owner mode ON: your visits are not counted on this device':'Owner mode OFF: your visits are counted again')},600)}

/* ---------- start ---------- */
applyLang();
var m=location.pathname.match(/^\/p\/([a-z0-9-]+)/);
loadSettings();
if(m){showPost(m[1])}
else{
  var s0=$('#ssr'); if(s0) s0.remove();
  loadPosts();
  if(S.key){adminUnlock(S.key).catch(function(){})}
}
})();

//END-OF-FILE
