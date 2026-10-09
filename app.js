
(function(){
'use strict';

/* ---------- translations ---------- */
var D={
en:{
 nav_home:"Home",nav_posts:"Posts",nav_trivia:"Trivia",nav_about:"About",nav_contact:"Contact",
 sub:"Publish • Share • Earn • Grow Organically",
 hero:"Tech blogging, insightful articles, and digital books, all in one place and easy to read on any device.",
 cta:"Read the latest",stores:"Recommended Stores",connect:"Connect With Me",latest:"Latest Posts",
 all:"All",blog:"Blog",book:"Books",bt:"Blog",bk:"Book",more:"Read more",none:"No posts yet.",
 back:"\u2190 Back to home",getbook:"Get the book",notfound:"This post could not be found.",
 about_t:"About",contact_t:"Contact",contact_p:"Questions, feedback or partnership ideas? Reach out.",
 email:"Email",phone:"Phone",priv_t:"Privacy Policy",updated:"Last updated: 2026",
 disc:"As an Amazon Associate I earn from qualifying purchases. Some links on this site are affiliate links; they cost you nothing extra.",
 author:"Author: Ticher",
 search:"Search posts",nores:"No posts match your search.",follow_t:"Follow and get new posts",follow_p:"Leave your email. No password and no account. Reading is always free.",f_ph:"Your email",f_btn:"Follow",f_ok:"Thank you! You are now following.",f_err:"Please enter a valid email.",share:"Share",copy:"Copy link",copied:"Link copied",
 tb_t:"Blog",tb_s:"Tech tips, programming & articles",tk_t:"Books",tk_s:"Read, download or buy",ts_t:"Products",ts_s:"Things worth buying",shop:"Recommended Products",buy:"Buy on",deal:"View deal",store_desc:"Curated stores and recommended products \u2014 click any link below.",cookie_p:"We use cookies for basic analytics and to remember your language.",cookie_ok:"Got it",views:"views",wa_chat:"Chat on WhatsApp",gate_t:"Enter your email to read",gate_p:"Free to read \u2014 we\u2019ll just email you when new books come out.",gate_btn:"Unlock and read",gate_err:"Please enter a valid email.",pay_bank:"Bank transfer",pay_ussd:"USSD code",pay_paypal:"PayPal",pay_stripe:"Card / Stripe",pay_wallet:"Crypto wallet",pay_other:"Other",buynow:"Buy now",gate_pending:"Thanks! Once your payment is confirmed, this book will unlock automatically the next time you open it \u2014 no need to pay again.",support_t:"Support this work",support_p:"If you\u2019ve enjoyed reading, you can support with a small donation.",page_of:"Page {n} of {t}",prev:"Previous",next:"Next",buyc:"Buy me a copy",pay_p:"Send payment to the account below, then message me a screenshot to receive the book.",acct:"Account",listen:"Listen",stop:"Stop",save:"Save for later",saved:"Saved",saved_t:"Saved for later",comments_t:"Comments",c_name:"Your name (optional)",c_text:"Your comment",c_send:"Post comment",c_none:"No comments yet. Be the first!",free:"Free",
 min_read:"min read",related_t:"Related Articles",font_ctrl:"Text size",recommended:"Recommended",
 wa_comm_t:"Join Our WhatsApp Community",
 wa_comm_p:"Get our latest tech tutorials, coding guides, and digital books directly to your phone.",
 wa_comm_btn:"Join WhatsApp Channel",
 get_code:"Click to Get Full Code / Resources",
 copied_code:"Code copied to clipboard!",
 trivia_t:"🧠 Daily Tech Trivia",
 trivia_desc:"Test your tech knowledge with 3 quick questions!",
 trivia_score:"Score: {s} / {t}",
 print_pdf:"🖨️ PDF / Print",
 reactions_t:"Did you find this helpful? (Reactions):",
 rx_voted:"Thank you for your reaction!",
 quote_copied:"Quote copied!",
 about:[["What you will find","Insightful tech articles, programming tutorials, guides on creating and hosting digital websites, rich educational books, and trusted product recommendations through affiliate links that support this platform."],
  ["Why this website?","Allarbaa.cloud was built to make digital knowledge, books, and blogging accessible and permanent for everyone."],
  ["The author","Allarbaa.cloud is created and published by Ticher, dedicated to open knowledge, tech sharing, and creative publishing."]],
 priv:[["Overview","Your privacy matters. This policy explains what information Allarbaa.cloud (allarbaa.cloud) collects, how it is used and the choices you have. By using this site you agree to this policy."],
  ["Information we collect","We do not ask visitors to create accounts. We use standard privacy-respecting analytics to understand site visits. If you follow by email, we only use it to notify you about new posts, and you can unsubscribe at any time."],
  ["Cookies","Analytics tools and affiliate partners may set cookies to measure traffic and record visits from this site."],
  ["Affiliate links","Some links are affiliate links (Amazon, Jumia, Konga). If you purchase through them, we may receive a small commission at no extra cost to you."],
  ["Third-party websites","Our posts may link to external websites whose policies we do not control."],
  ["Contact","Questions? Reach out using the contact information provided."]]
},
ha:{
 nav_home:"Farko",nav_posts:"Rubutu",nav_trivia:"Trivia",nav_about:"Game da mu",nav_contact:"Tuntuɓa",
 sub:"Wallafa • Rabawa • Samun Riba • Ci Gaba",
 hero:"Rubutun fasaha, labarai masu ilmantarwa da wallafa littattafai a wuri ɗaya, masu sauƙin karantawa a kowace na'ura.",
 cta:"Karanta sababbi",stores:"Shagunan da Muke Ba da Shawara",connect:"Haɗa da Ni",latest:"Sababbin Rubutu",
 all:"Duka",blog:"Rubutu",book:"Littattafai",bt:"Rubutu",bk:"Littafi",more:"Karanta ƙari",none:"Babu rubutu tukuna.",
 back:"\u2190 Koma shafin farko",getbook:"Sami littafin",notfound:"Ba a sami wannan rubutu ba.",
 about_t:"Game da mu",contact_t:"Tuntuɓa",contact_p:"Tambaya, shawara ko ra'ayin haɗin gwiwa? Ka tuntuɓe mu.",
 email:"Imel",phone:"Waya",priv_t:"Manufar Sirri",updated:"An sabunta: 2026",
 disc:"A matsayina na Abokin Amazon (Amazon Associate), ina samun kuɗi daga sayayya da suka cancanta. Wasu hanyoyin haɗi na affiliate ne; ba sa ƙara maka farashi.",
 author:"Marubuci: Ticher",
 search:"Nemo rubutu",nores:"Babu rubutun da ya dace da bincikenka.",follow_t:"Bibi ka samu sababbin rubutu",follow_p:"Bar imel ɗinka. Babu kalmar sirri, babu buɗe asusu. Karatu kyauta ne kullum.",f_ph:"Imel ɗinka",f_btn:"Bibi",f_ok:"Na gode! Yanzu kana bibiya.",f_err:"Ka shigar da imel mai inganci.",share:"Raba",copy:"Kwafi link",copied:"An kwafi link ɗin",
 tb_t:"Rubutu",tb_s:"Fasahar kwamfuta, tutorials da labarai",tk_t:"Littattafai",tk_s:"Karanta, sauke ko saya",ts_t:"Kayayyaki",ts_s:"Abubuwan da suka cancanci saya",shop:"Kayayyakin da Muke Ba da Shawara",buy:"Saya a",deal:"Duba tayin",store_desc:"Zaɓaɓɓun kayayyaki masu inganci \u2014 danna ko wane link a ƙasa.",cookie_p:"Muna amfani da cookies don ƙididdiga da tuna harshenka.",cookie_ok:"Na gane",views:"kallo",wa_chat:"Tattauna a WhatsApp",gate_t:"Shigar da imel don karantawa",gate_p:"Karatu kyauta ne \u2014 za mu turo maka imel ne kawai idan sabon littafi ya fito.",gate_btn:"Buɗe ka karanta",gate_err:"Ka shigar da imel mai inganci.",pay_bank:"Canja wurin banki",pay_ussd:"Lambar USSD",pay_paypal:"PayPal",pay_stripe:"Katin biya / Stripe",pay_wallet:"Wallet na crypto",pay_other:"Wani",buynow:"Saya yanzu",gate_pending:"Na gode! Da zarar an tabbatar da biyanka, littafin zai buɗe kansa nan take.",support_t:"Taimaka wa wannan aiki",support_p:"Idan karatun ya yi maka daɗi, za ka iya taimakawa da ɗan gudunmawa.",page_of:"Shafi {n} na {t}",prev:"Na baya",next:"Na gaba",buyc:"Saya mini kwafi",pay_p:"Ka aika kuɗi zuwa asusun da ke ƙasa don karɓar littafin.",acct:"Asusun",listen:"Saurara",stop:"Tsaya",save:"Ajiye don baya",saved:"An ajiye",saved_t:"Ajiyayyu don baya",comments_t:"Tsokaci",c_name:"Sunanka (na zaɓi)",c_text:"Tsokacinka",c_send:"Aika tsokaci",c_none:"Babu tsokaci tukuna.",free:"Kyauta",
 min_read:"minti na karatu",related_t:"Kuna Iya Karanta Wannan Ma",font_ctrl:"Girman rubutu",recommended:"Shawarar mu",
 wa_comm_t:"Shiga Rukuninmu na WhatsApp",
 wa_comm_p:"Kuna son samun sababbin darussan fasaha, coding, da littattafai kai tsaye a wayarku? Shiga channel ɗinmu.",
 wa_comm_btn:"Shiga WhatsApp Channel Yanzu",
 get_code:"Danna Don Samun Code / Resources",
 copied_code:"An kwafi code ɗin!",
 trivia_t:"🧠 Tambayoyin Fasaha na Yau",
 trivia_desc:"Gwada basirarka da tambayoyin fasaha guda 3!",
 trivia_score:"Maki: {s} / {t}",
 print_pdf:"🖨️ PDF / Print",
 reactions_t:"Yaba da wannan rubutun (Reactions):",
 rx_voted:"Mun gode da yabawarka!",
 quote_copied:"An kwafi maganar!",
 about:[["Abin da za ka samu","Rubutun fasaha mai ma'ana, darussan coding, labarai masu ilmantarwa, da littattafai na musamman tare da affiliate links masu inganci."],
  ["Me ya sa aka kirkirar shafi?","Allarbaa.cloud an gina shi ne domin ilimi da wallafa littattafai su kasance kyauta kuma a sauƙaƙe ga kowa."],
  ["Marubuci","Ticher ne ke rubutawa da kula da Allarbaa.cloud."]],
 priv:[["Gabaɗaya","Sirrinka yana da muhimmanci a Allarbaa.cloud."],
  ["Bayanan da muke tattarawa","Ba ma neman buɗe asusu. Ana amfani da cookies don tuna yare da ƙididdigar shafi kawai."],
  ["Affiliate links","Wasu links na affiliate ne (Amazon, Jumia, Konga) don tallafa wa ci gaban shafin."],
  ["Tuntuɓa","Za a iya tuntuɓar mu ta hanyoyin sadarwa da ke shafin nan."]]
},
ar:{
 nav_home:"الرئيسية",nav_posts:"المنشورات",nav_trivia:"معلومات تقنية",nav_about:"من نحن",nav_contact:"اتصل بنا",
 sub:"انشر • شارك • اربح • انمُ",
 hero:"مدونة تقنية، مقالات مفيدة، ونشر الكتب الرقمية في مكان واحد وبسهولة.",
 cta:"اقرأ الجديد",stores:"متاجر موصى بها",connect:"تواصل معي",latest:"أحدث المنشورات",
 all:"الكل",blog:"مدونة",book:"كتب",bt:"مدونة",bk:"كتاب",more:"اقرأ المزيد",none:"لا توجد منشورات بعد.",
 back:"\u2192 العودة إلى الرئيسية",getbook:"احصل على الكتاب",notfound:"تعذر العثور على هذا المنشور.",
 about_t:"من نحن",contact_t:"اتصل بنا",contact_p:"أسئلة أو ملاحظات أو أفكار للتعاون؟ تواصل معنا.",
 email:"البريد الإلكتروني",phone:"الهاتف",priv_t:"سياسة الخصوصية",updated:"آخر تحديث: 2026",
 disc:"بصفتي شريكًا في Amazon، أحصل على عمولة من المشتريات المؤهلة.",
 author:"الكاتب: Ticher",
 search:"ابحث في المنشورات",nores:"لا توجد منشورات مطابقة.",follow_t:"تابعنا لتصلك المنشورات الجديدة",follow_p:"اترك بريدك الإلكتروني. القراءة مجانية دائمًا.",f_ph:"بريدك الإلكتروني",f_btn:"تابع",f_ok:"شكرًا لك! أنت الآن تتابعنا.",f_err:"يرجى إدخال بريد صحيح.",share:"شارك",copy:"انسخ الرابط",copied:"تم نسخ الرابط",
 tb_t:"المدونة",tb_s:"مقالات تقنية وشروحات",tk_t:"الكتب",tk_s:"اقرأ أو حمّل أو اشترِ",ts_t:"المنتجات",ts_s:"أشياء تستحق الشراء",shop:"منتجات موصى بها",buy:"اشترِ من",deal:"شاهد العرض",store_desc:"منتجات مختارة \u2014 اضغط على أحد الروابط أدناه.",cookie_p:"نستخدم ملفات تعريف الارتباط لإحصاءات أساسية ولتذكر لغتك.",cookie_ok:"حسنًا",views:"مشاهدة",wa_chat:"تحدث عبر واتساب",gate_t:"أدخل بريدك الإلكتروني للقراءة",gate_p:"القراءة مجانية.",gate_btn:"افتح واقرأ",gate_err:"يرجى إدخال بريد صحيح.",pay_bank:"تحويل بنكي",pay_ussd:"كود USSD",pay_paypal:"باي بال",pay_stripe:"بطاقة / سترايب",pay_wallet:"محفظة عملات",pay_other:"أخرى",buynow:"اشترِ الآن",gate_pending:"شكرًا لك! بمجرد تأكيد الدفع سيُفتح الكتاب.",support_t:"ادعم هذا العمل",support_p:"يمكنك الدعم بتبرع بسيط.",page_of:"صفحة {n} من {t}",prev:"السابق",next:"التالي",buyc:"اشترِ لي نسخة",pay_p:"أرسل المبلغ إلى الحساب أدناه.",acct:"الحساب",listen:"استماع",stop:"إيقاف",save:"احفظ لوقت لاحق",saved:"محفوظ",saved_t:"محفوظ لوقت لاحق",comments_t:"التعليقات",c_name:"اسمك (اختياري)",c_text:"تعليقك",c_send:"أرسل التعليق",c_none:"لا توجد تعليقات بعد.",free:"مجانًا",
 min_read:"دقيقة قراءة",related_t:"مقالات ذات صلة",font_ctrl:"حجم الخط",recommended:"موصى به",
 wa_comm_t:"انضم إلى مجتمعنا على واتساب",
 wa_comm_p:"احصل على أحدث الشروحات التقنية والكتب الرقمية مباشرة على هاتفك.",
 wa_comm_btn:"انضم إلى قناة واتساب",
 get_code:"اضغط للحصول على الكود / المصادر",
 copied_code:"تم نسخ الكود!",
 trivia_t:"🧠 معلومات تقنية يومية",
 trivia_desc:"اختبر معلوماتك مع 3 أسئلة سريعة!",
 trivia_score:"النتيجة: {s} / {t}",
 print_pdf:"🖨️ طباعة / PDF",
 reactions_t:"تفاعل مع المقال:",
 rx_voted:"شكرًا لتفاعلك!",
 quote_copied:"تم نسخ الاقتباس!",
 about:[["ماذا ستجد","مقالات تقنية وشروحات برمجية، كتب رقمية، وتوصيات بالمنتجات."],
  ["لماذا هذا الموقع؟","نشر المعرفة والكتب بطريقة حرة ومستدامة."],
  ["الكاتب","Allarbaa.cloud يُنشر بواسطة Ticher."]],
 priv:[["نظرة عامة","خصوصيتك تهمنا في Allarbaa.cloud."],
  ["المعلومات التي نجمعها","بيانات تصفح مجهولة الهوية لتحسين الموقع."],
  ["روابط الشراكة","بعض الروابط روابط تابعة لدعم الموقع."],
  ["التواصل","راسلنا عبر بيانات الاتصال الموضحة."]]
}};

/* ---------- helpers ---------- */
var $=function(s){return document.querySelector(s)};
var $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var LS={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
var SS={get:function(k){try{return sessionStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{sessionStorage.setItem(k,v)}catch(e){}},del:function(k){try{sessionStorage.removeItem(k)}catch(e){}}};

var OWNER=LS.get('owner')==='1';
if(location.hash==='#owner'){LS.set('owner','1');OWNER=true}
else if(location.hash==='#visitor'){LS.set('owner','');OWNER=false}
var lang=LS.get('tl'); if(!D[lang]) lang='en';
var curTheme=LS.get('theme') || 'dark';
document.documentElement.setAttribute('data-theme', curTheme);

var S={posts:[],q:'',subs:[],comments:[],claimsList:[],filter:'all',settings:null,key:SS.get('ak')||'',admin:false,editing:{},newImgs:{},storeImgs:{},post:null,tab:'blog',bookPages:[''],curPage:0,unlocked:false,payMethods:[]};
var T=function(k){var v=D[lang][k]; return v==null?D.en[k]:v};
var fmt=function(d){try{return new Date(d).toLocaleDateString(lang==='ar'?'ar':'en-GB',{year:'numeric',month:'short',day:'numeric'})}catch(e){return ''}};

var KINDS=['blog','book','product'];
var LIM={blog:4,book:1,product:1};
var SAVED_KEY='savedPosts';
var PAY_TYPES=['bank','ussd','paypal','stripe','wallet','other'];
var HEAD={blog:['New blog post','Edit blog post'],book:['New book','Edit book'],product:['New affiliate product','Edit affiliate product']};
var SOC=[['fb','Facebook'],['wa','WhatsApp'],['ig','Instagram'],['x','X (Twitter)'],['yt','YouTube'],['li','LinkedIn'],['tt','TikTok'],['tg','Telegram']];
var STO=[['amazon','Amazon'],['jumia','Jumia'],['konga','Konga']];
var STORE_NAME={amazon:'Amazon',jumia:'Jumia',konga:'Konga',other:''};
var DEF_STORES={amazon:{link:'https://www.amazon.com/',id:'',img:0},jumia:{link:'https://www.jumia.com.ng/',id:'',img:0},konga:{link:'https://www.konga.com/',id:'',img:0}};
var DEF_PHONES=['+2347069444260','+2349017668973'];
var WA_NUMBERS=['+2347069444260','+2348080335353'];

/* Audio Engine State */
var audioState={
  speaking:false,
  speed:1,
  chunks:[],
  chunkIdx:0
};

function readingTime(text){
  var words = (text || '').replace(/<[^>]*>/g,' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 170));
}

function getSaved(){try{return JSON.parse(LS.get(SAVED_KEY)||'[]')}catch(e){return []}}
function isSaved(id){return getSaved().indexOf(id)>=0}
function loadComments(postId){
  api('comments/'+postId).then(function(j){renderComments(j.comments||[])}).catch(function(){renderComments([])});
}
function renderComments(list){
  $('#cItems').innerHTML=list.length?list.map(function(c){
    return '<div class="c-item"><b>'+esc(c.name||'Guest')+'</b><div class="cd">'+fmt(c.date)+'</div><p>'+esc(c.text)+'</p></div>';
  }).join(''):'<p class="mut">'+esc(T('c_none'))+'</p>';
}
function sendComment(){
  var postId=S.post&&S.post.id; if(!postId)return;
  var name=$('#c-name').value.trim(), text=$('#c-text').value.trim();
  if(!text){toast('Write a comment first');return}
  $('#c-send').disabled=true;
  api('comments/'+postId,{method:'POST',body:JSON.stringify({name:name,text:text,website:$('#c-hp').value})}).then(function(){
    $('#c-name').value='';$('#c-text').value='';loadComments(postId);
  }).catch(function(){toast('Could not post comment')}).then(function(){$('#c-send').disabled=false});
}
function toggleSaved(id){
  var arr=getSaved(),i=arr.indexOf(id);
  if(i>=0)arr.splice(i,1);else arr.unshift(id);
  LS.set(SAVED_KEY,JSON.stringify(arr.slice(0,200)));
  return arr.indexOf(id)>=0;
}
function renderSavedSection(){
  var ids=getSaved(), box=$('#savedGrid');
  if(!box)return;
  var list=ids.map(function(id){return S.posts.find(function(p){return p.id===id})}).filter(Boolean);
  $('#savedBlock').hidden=!list.length;
  box.innerHTML=list.map(function(p){
    var img=p.imgCount?imgUrl(p,0):ph(hash(p.id));
    var badgeClass='badge'+(p.type==='book'?(p.price?' paid':' free'):'');
    var badgeText=p.type==='book'?(p.price?esc(p.price):esc(T('free'))):esc(T('bt'));
    return '<article class="pc" data-search="'+esc((p.title+' '+(p.excerpt||'')).toLowerCase())+'"><a class="pimg" href="/p/'+p.id+'"><img src="'+img+'" alt="" loading="lazy"></a><div class="pb">'+
      '<span class="'+badgeClass+'">'+badgeText+'</span><h3><a href="/p/'+p.id+'">'+esc(p.title)+'</a></h3>'+
      '<div class="pm"><span>'+fmt(p.date)+'</span><a class="more" href="/p/'+p.id+'">'+esc(T('more'))+'</a></div></div></article>';
  }).join('');
}
function toast(m){var t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(function(){t.remove()},3200)}

function api(path,opts){
  opts=opts||{};
  var h={'content-type':'application/json'}; if(S.key) h['x-admin-key']=S.key;
  if(opts.noCount||OWNER) h['x-no-count']='1';
  return fetch('/api/'+path,{method:opts.method||'GET',headers:h,body:opts.body}).then(function(r){
    return r.json().catch(function(){return {}}).then(function(j){
      if(!r.ok){var e=new Error(j.error||'error');e.status=r.status;e.code=j.error;throw e}
      return j;
    });
  });
}

var PH=[
'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10306a"/><stop offset="1" stop-color="#2a86b8"/></linearGradient></defs><rect width="400" height="250" fill="url(#a)"/><circle cx="300" cy="78" r="34" fill="#ffd27a" opacity=".92"/><path d="M0 190Q90 130 180 175T400 160V250H0Z" fill="#0b3b63"/><path d="M0 222Q120 172 230 212T400 200V250H0Z" fill="#082a49"/></svg>',
'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3a8f"/><stop offset="1" stop-color="#1590c8"/></linearGradient></defs><rect width="400" height="250" fill="url(#b)"/><circle cx="70" cy="50" r="46" fill="#fff" opacity=".07"/><circle cx="345" cy="205" r="62" fill="#fff" opacity=".07"/><path d="M200 78C170 62 130 62 96 74V180C130 168 170 168 200 184Z" fill="#fff" opacity=".93"/><path d="M200 78C230 62 270 62 304 74V180C270 168 230 168 200 184Z" fill="#dcecff" opacity=".85"/><path d="M200 78V184" stroke="#4b63d6" stroke-width="3"/></svg>',
'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"><defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#081d3f"/><stop offset="1" stop-color="#14508f"/></linearGradient></defs><rect width="400" height="250" fill="url(#c)"/><g stroke="#6ee7ff" stroke-opacity=".5" stroke-width="2" fill="none"><path d="M60 180L140 100L230 150L330 70"/><path d="M140 100L160 40M230 150L260 215M330 70L360 130"/></g><g fill="#6ee7ff"><circle cx="60" cy="180" r="9"/><circle cx="140" cy="100" r="11"/><circle cx="230" cy="150" r="9"/><circle cx="330" cy="70" r="12"/><circle cx="160" cy="40" r="6"/><circle cx="260" cy="215" r="6"/><circle cx="360" cy="130" r="6"/></g></svg>'];
function ph(i){return 'data:image/svg+xml;utf8,'+encodeURIComponent(PH[i%3])}
function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h%3}
function imgUrl(p,n){return '/api/img/'+p.id+'/'+n+'?v='+encodeURIComponent(p.updated||p.date)}

function tagged(link,store){
  var s=S.settings&&S.settings.stores&&S.settings.stores[store];
  if(store==='amazon'&&s&&s.id&&/amazon\./i.test(link)){
    try{var u=new URL(link);if(!u.searchParams.get('tag')){u.searchParams.set('tag',s.id)}return u.href}catch(e){}
  }
  return link;
}

/* ---------- theme toggle ---------- */
function updateThemeIcon(){
  var btn=$('#themeToggle');
  if(btn) btn.textContent = curTheme === 'dark' ? '🌙' : '☀️';
}
function toggleTheme(){
  curTheme = curTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', curTheme);
  LS.set('theme', curTheme);
  updateThemeIcon();
}
updateThemeIcon();
var themeBtn=$('#themeToggle');
if(themeBtn) themeBtn.addEventListener('click', toggleTheme);

/* ---------- Reading Progress Bar ---------- */
window.addEventListener('scroll', function(){
  var winScroll = document.documentElement.scrollTop || document.body.scrollTop;
  var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  var scrolled = height > 0 ? (winScroll / height) * 100 : 0;
  var bar = $('#progressBar');
  if(bar) bar.style.width = Math.min(100, Math.max(0, scrolled)) + '%';
}, {passive:true});

/* ---------- language and static text ---------- */
function applyLang(){
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  $$('#langs button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-l')===lang)});
  $$('[data-i]').forEach(function(e){e.textContent=T(e.getAttribute('data-i'))});
  $$('[data-ph]').forEach(function(e){e.placeholder=T(e.getAttribute('data-ph'))});
  var sec=function(a){return a.map(function(x){return '<h3>'+esc(x[0])+'</h3><p>'+esc(x[1])+'</p>'}).join('')};
  $('#aboutBody').innerHTML=sec(T('about'));
  $('#privBody').innerHTML=sec(T('priv'));
  renderPosts(); renderProducts(); renderStorage(); renderSupportCta(); siteShareBar(); renderTrivia();
  if(S.post) renderPost();
}

function renderSupportCta(){
  var s=S.settings; if(!s) return;
  var links='';
  if(s.social&&s.social.coffee) links+='<a class="btn sm" target="_blank" rel="noopener" href="'+esc(s.social.coffee)+'">☕ '+esc(T('buyc'))+'</a>';
  links+='<a class="btn sm ghost" href="#posts" data-f="book">'+esc(T('tk_t'))+'</a>';
  $('#supportLinks').innerHTML=links;
  $('#supportCta').hidden=false;
}

function renderStorage(){
  var s=S.settings; if(!s) return;
  if(s.logo){
    var limg=$('#logoImg'), csvg=$('#cloudSvg');
    if(limg){limg.src=s.logo; limg.style.display='block';}
    if(csvg){csvg.style.display='none';}
    var navImg=$('#navLogoImg'), navSvg=$('#navCloudSvg');
    if(navImg){navImg.src=s.logo; navImg.style.display='inline-block';}
    if(navSvg){navSvg.style.display='none';}
  }
  var st=STO.filter(function(x){return s.stores&&s.stores[x[0]]&&s.stores[x[0]].link}).map(function(x){
    var o=s.stores[x[0]];
    return '<a class="store" href="'+esc(tagged(o.link,x[0]))+'" target="_blank" rel="sponsored nofollow noopener">'+(o.img?'<img src="/api/simg/'+x[0]+'?v='+o.img+'" alt="">':'')+'<span>'+x[1]+'</span></a>';
  }).join('');
  $('#stores').innerHTML=st; $('#storesBlock').hidden=!st;
  var so=SOC.filter(function(x){return s.social&&s.social[x[0]]}).map(function(x){return '<a href="'+esc(s.social[x[0]])+'" target="_blank" rel="noopener">'+x[1]+'</a>'}).join('');
  $('#bio').innerHTML=so; $('#connectBlock').hidden=!so;
  $('#coffeeRow').hidden=!(s.social&&s.social.coffee);
  if(s.social&&s.social.coffee)$('#coffeeLink').href=s.social.coffee;

  var contactEmail=s.email||'ticher218@gmail.com';
  var h='<li>'+esc(T('email'))+': <a href="mailto:'+esc(contactEmail)+'">'+esc(contactEmail)+'</a></li>';
  (s.phones||[]).forEach(function(p){h+='<li>'+esc(T('phone'))+': <a href="tel:'+esc(p.replace(/[^0-9+]/g,''))+'" dir="ltr">'+esc(p)+'</a></li>'});
  if(s.social&&s.social.wa) h+='<li>WhatsApp: <a href="'+esc(s.social.wa)+'" target="_blank" rel="noopener" dir="ltr">'+esc(s.social.wa.replace('https://',''))+'</a></li>';
  $('#contactList').innerHTML=h;
}

/* ---------- lists on the main page ---------- */
function renderPosts(){
  var box=$('#postGrid'), list=S.posts.filter(function(p){return p.type!=='product'});
  if(S.filter!=='all') list=list.filter(function(p){return p.type===S.filter});
  var q=S.q.trim().toLowerCase();
  if(q) list=list.filter(function(p){return (p.title+' '+(p.excerpt||'')).toLowerCase().indexOf(q)>=0});
  if(!list.length){box.innerHTML='<p class="mut">'+esc(T(q?'nores':'none'))+'</p>';return}
  box.innerHTML=list.map(function(p){
    var img=p.imgCount?imgUrl(p,0):ph(hash(p.id));
    var badgeClass='badge'+(p.type==='book'?(p.price?' paid':' free'):'');
    var badgeText=p.type==='book'?(p.price?esc(p.price):esc(T('free'))):esc(T('bt'));
    return '<article class="pc" data-search="'+esc((p.title+' '+(p.excerpt||'')+' '+(p.tags||[]).join(' ')).toLowerCase())+'"><a class="pimg" href="/p/'+p.id+'"><img src="'+img+'" alt="" loading="lazy"></a><div class="pb">'+
      '<span class="'+badgeClass+'">'+badgeText+'</span>'+
      '<h3><a href="/p/'+p.id+'">'+esc(p.title)+'</a></h3>'+(p.excerpt?'<p>'+esc(p.excerpt)+'</p>':'')+
      tagPills(p.tags)+
      '<div class="pm"><span>'+fmt(p.date)+'</span><a class="more" href="/p/'+p.id+'">'+esc(T('more'))+'</a></div></div></article>';
  }).join('');
}
function tagPills(tags){
  if(!tags||!tags.length)return '';
  return '<div class="tagset">'+tags.map(function(t){
    return '<span style="color:var(--mut);font-size:.8rem">#'+esc(t)+'</span>';
  }).join(' ')+'</div>';
}

function renderProducts(){
  var list=S.posts.filter(function(p){return p.type==='product'&&p.link});
  $('#shop').hidden=!list.length;
  $('#shopGrid').innerHTML=list.map(function(p){
    var img=p.imgCount?imgUrl(p,0):ph(hash(p.id));
    var nm=STORE_NAME[p.store]||'', label=nm?T('buy')+' '+nm:T('deal');
    return '<article class="pc" data-search="'+esc((p.title+' '+(p.excerpt||'')+' '+nm).toLowerCase())+'"><div class="pimg"><img src="'+img+'" alt="'+esc(p.title)+'" loading="lazy"></div><div class="pb">'+
      '<span class="badge deal">⭐ '+esc(T('recommended'))+'</span>'+
      '<h3>'+esc(p.title)+'</h3>'+(p.price?'<span class="price">'+esc(p.price)+'</span>':'')+(p.excerpt?'<p>'+esc(p.excerpt)+'</p>':'')+
      '<a class="aff-btn cta" href="'+esc(tagged(p.link,p.store))+'" target="_blank" rel="sponsored nofollow noopener">'+esc(label)+'</a></div></article>';
  }).join('');
}

function setFilter(f){
  S.filter=f;
  $$('#tabs button').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-f')===f)});
  renderPosts();
}

function showSkeletons(){
  var box=$('#postGrid');
  if(!box || S.posts.length) return;
  box.innerHTML=[1,2,3].map(function(){
    return '<article class="pc skeleton-card"><div class="pimg skeleton-box"></div><div class="pb">'+
      '<div class="skeleton-line" style="width:35%"></div><div class="skeleton-line" style="width:85%;height:18px"></div><div class="skeleton-line" style="width:65%"></div></div></article>';
  }).join('');
}

function loadPosts(){
  showSkeletons();
  return api('posts').then(function(j){S.posts=j.posts||[]}).catch(function(){S.posts=[]}).then(function(){renderPosts();renderProducts();renderMgr();renderSavedSection();injectListSchema()});
}
function injectListSchema(){
  var old=document.getElementById('listSchema');if(old)old.remove();
  var list=S.posts.filter(function(p){return p.type!=='product'}).slice(0,20);
  if(!list.length)return;
  var ld={'@context':'https://schema.org','@type':'ItemList','itemListElement':list.map(function(p,i){
    return {'@type':'ListItem','position':i+1,'url':location.origin+'/p/'+p.id,'name':p.title};
  })};
  var s=document.createElement('script');s.type='application/ld+json';s.id='listSchema';s.textContent=JSON.stringify(ld);
  document.head.appendChild(s);
}
function loadSettings(){
  return api('settings').then(function(j){S.settings=j}).catch(function(){S.settings={social:{},stores:DEF_STORES,phones:DEF_PHONES}}).then(function(){renderStorage();fillSettings();if(S.post)renderPost()});
}


//END-OF-FILE
