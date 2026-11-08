/* 「全文を見る」ボタン
   各ページの引用（.rec の blockquote）に、会議録の発言まるごとと、すぐ後の答弁を開くボタンを付ける。
   全文は full/<町>.json（{u:発言, r:引用の行}）に置き、ボタンを初めて押したときだけ読み込む（ページを軽くするため）。
   使い方：<script src="zen.js" data-town="kamo" defer></script>
   u: {id:{d:日付,s:発言者,m:会議名,url,f:全文,rp:[[答弁者,答弁]],ocr}}  r: [[日付,引用の頭30字,id]] */
(function(){
  var me=document.currentScript, town=me&&me.dataset.town;
  if(!town) return;
  var data=null, loading=null;

  var css=document.createElement("style");
  css.textContent=
  ".zen-btn{justify-self:start;font:inherit;font-size:13px;font-weight:700;color:var(--accent);background:var(--accent-soft);border:1px solid var(--accent);border-radius:999px;padding:3px 12px;cursor:pointer}"+
  ".zen-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}"+
  "dialog.zen{width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink)}"+
  "dialog.zen::backdrop{background:rgba(0,0,0,.45)}"+
  ".zen-top{position:sticky;top:0;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:12px 16px;background:var(--paper);border-bottom:1px solid var(--line)}"+
  ".zen-top .ttl{font-weight:700;font-size:15px;line-height:1.5}.zen-top .sub{font-size:12.5px;color:var(--muted)}"+
  ".zen-x{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:6px;padding:4px 12px;cursor:pointer;white-space:nowrap}"+
  ".zen-body{padding:14px 16px 20px;display:grid;gap:14px}"+
  ".zen-body h4{margin:0;font-size:14px;color:var(--accent)}"+
  ".zen-txt{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14.5px;line-height:1.85}"+
  ".zen-txt mark{background:var(--care-soft);color:inherit;box-shadow:0 0 0 2px var(--care-soft);border-radius:2px}"+
  ".zen-reply{border-left:3px solid var(--accent);padding-left:12px;display:grid;gap:4px}.zen-who{font-weight:700;font-size:13.5px}"+
  ".zen-note{font-size:12.5px;color:var(--muted)}";
  document.head.appendChild(css);

  var dlg=document.createElement("dialog");dlg.className="zen";dlg.setAttribute("lang","ja");
  dlg.innerHTML='<div class="zen-top"><div><div class="ttl"></div><div class="sub"></div></div><button type="button" class="zen-x">閉じる</button></div><div class="zen-body"></div>';
  document.body.appendChild(dlg);
  dlg.querySelector(".zen-x").onclick=function(){dlg.close()};
  dlg.addEventListener("click",function(e){if(e.target===dlg)dlg.close()});

  // 比べるときは空白・記号の違いを無視する
  function norm(s){return (s||"").replace(/[\s　、。，．,.「」『』（）()・…―ー－\-]/g,"")}
  function esc(s){return String(s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}

  // 頭の（説明）を除き、全体が「」で囲まれていれば外す
  function core(t){t=t.trim();
    if(t.charAt(0)==="（"){var dep=0;for(var i=0;i<t.length;i++){var ch=t.charAt(i);if(ch==="（")dep++;else if(ch==="）"&&--dep===0){t=t.slice(i+1).trim();break}}}
    t=t.replace(/（[^（）]*）$/,"").trim();
    if(t.charAt(0)==="「"&&t.charAt(t.length-1)==="」")t=t.slice(1,-1);return t}

  function load(){
    if(data) return Promise.resolve(data);
    if(!loading) loading=fetch("full/"+town+".json",{cache:"force-cache"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){
      Object.keys(j.u).forEach(function(k){j.u[k]._n=norm(j.u[k].f)});
      j.r.forEach(function(r){r._q=norm(r[1])});
      data=j;return data});
    return loading;
  }

  // 1) 同じ日付で、引用の頭が一致する行 2) 引用の文を含む発言（同じ日付を先に）
  function find(date,quote){
    var head=norm(quote.split(/（中略）|\(中略\)/)[0]), all=norm(quote);
    for(var i=0;i<data.r.length;i++){var r=data.r[i];
      if(r._q.length>=8&&(!date||r[0]===date||r[0].indexOf(date)===0)&&all.indexOf(r._q)===0)return data.u[r[2]]}
    var keys=[head.slice(0,40),head.slice(0,20),head.slice(-20)].filter(function(k){return k.length>=8});
    var us=Object.keys(data.u).map(function(k){return data.u[k]});
    var pools=[us.filter(function(u){return u.d===date}),us];
    for(var p=0;p<pools.length;p++)for(var k=0;k<keys.length;k++)for(var j=0;j<pools[p].length;j++)
      if(pools[p][j]._n.indexOf(keys[k])>=0)return pools[p][j];
    // 市の答えの引用は、議員の発言のすぐ後の答弁の中を探す
    for(var p2=0;p2<pools.length;p2++)for(var k2=0;k2<keys.length;k2++)for(var j2=0;j2<pools[p2].length;j2++){
      var u=pools[p2][j2];if(!u._r)u._r=(u.rp||[]).map(function(r){return norm(r[1])}).join("|");
      if(u._r.indexOf(keys[k2])>=0)return u}
    return null;
  }

  // 本文の中で引用にあたる所に印を付ける（記号の違いがあっても当たるよう、1文字ずつ対応表を作る）
  function marked(full,quote){
    var parts=quote.split(/（中略）|\(中略\)/).map(norm).filter(function(s){return s.length>=6});
    var map=[],n="";
    for(var i=0;i<full.length;i++){var c=norm(full[i]);if(c){map.push(i);n+=c}}
    var spans=[];
    parts.forEach(function(p){
      // 見つからなければ、頭から短くして探す（引用の後ろに付けた説明や、写すときの直しがあっても色が付くように）
      for(var len=p.length;len>=15;len=(len>40?Math.floor(len*0.8):len-5)){var sub=p.slice(0,len),at=n.indexOf(sub);
        if(at>=0){spans.push([map[at],map[at+sub.length-1]+1]);return}}});
    spans.sort(function(a,b){return a[0]-b[0]});
    var out="",pos=0;
    spans.forEach(function(s){if(s[0]<pos)return;out+=esc(full.slice(pos,s[0]))+"<mark>"+esc(full.slice(s[0],s[1]))+"</mark>";pos=s[1]});
    return out+esc(full.slice(pos));
  }

  function open(rec){
    var when=rec.querySelector(".when"),bq=rec.querySelector("blockquote");
    var dm=when.textContent.match(/[HR]\d+\.\d+(\.\d+)?/),date=dm?dm[0]:"",quote=core(bq.textContent);
    var src=when.querySelector("a");
    var ttl=dlg.querySelector(".ttl"),sub=dlg.querySelector(".sub"),body=dlg.querySelector(".zen-body");
    ttl.textContent="読み込み中…";sub.textContent="";body.innerHTML="";
    if(!dlg.open)dlg.showModal();
    load().then(function(){
      var e=find(date,quote);
      if(!e){ttl.textContent="全文が見つかりませんでした";
        body.innerHTML='<p class="zen-note">この引用の全文は、まだ用意できていません。'+(src?'<a href="'+esc(src.href)+'" target="_blank" rel="noopener">会議録</a>で確かめてください。':'')+'</p>';return}
      ttl.textContent=(e.s||"")+"の発言（全文）";
      sub.textContent=[e.d,e.m].filter(Boolean).join("　");
      var mk=marked(e.f,quote),hasMark=mk.indexOf("<mark>")>=0||(e.rp||[]).some(function(r){return marked(r[1],quote).indexOf("<mark>")>=0});
      var h='<p class="zen-note">'+(hasMark?'黄色の所が、このページで引用した部分です。':'引用した部分に色を付けられませんでした（文字の読み取りの違いのため）。本文の中から探してください。')+'文は会議録のままです。</p>';
      if(e.ocr) h+='<p class="zen-note">この会議録はPDFの文字が化けていたため、画像から文字を読み取りました（OCR）。全文には読み違いが残っている場合があります。引用した部分は画像で確かめてあります。</p>';
      h+='<div class="zen-txt">'+mk+'</div>';
      if(e.rp&&e.rp.length){h+='<h4>すぐ後の答弁</h4>';
        e.rp.forEach(function(r){var mr=marked(r[1],quote);h+='<div class="zen-reply"><div class="zen-who">'+esc(r[0])+'</div><div class="zen-txt">'+mr+'</div></div>'})}
      else h+='<p class="zen-note">この発言のすぐ後に答弁はありません（答弁の側の発言や、討論・委員会の発言など）。</p>';
      var url=e.url||(src&&src.href);
      if(url) h+='<p class="zen-note">出典：<a href="'+esc(url)+'" target="_blank" rel="noopener">会議録（'+esc(e.m||"市のサイト")+'）</a></p>';
      body.innerHTML=h;
      var m=body.querySelector("mark");
      if(m) setTimeout(function(){m.scrollIntoView({block:"center"})},30);
      try{if(window.goatcounter&&goatcounter.count)goatcounter.count({path:"zen-"+town,title:"全文",event:true})}catch(_){}
    }).catch(function(){ttl.textContent="読み込めませんでした";body.innerHTML='<p class="zen-note">通信を確かめて、もう一度押してください。</p>';loading=null});
  }

  document.querySelectorAll(".rec").forEach(function(rec){
    if(!rec.querySelector("blockquote")||!rec.querySelector(".when"))return;
    var b=document.createElement("button");b.type="button";b.className="zen-btn";b.textContent="全文を見る";
    b.onclick=function(){open(rec)};rec.appendChild(b);
  });
})();
