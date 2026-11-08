/* 「全文を見る」ボタン
   各ページの引用（.rec の blockquote）に、会議録の発言まるごとと、すぐ後の答弁を開くボタンを付ける。
   全文は full/<町>.json に置き、ボタンを初めて押したときだけ読み込む（ページを軽くするため）。
   使い方：<script src="zen.js" data-town="kamo" defer></script>
   full/<町>.json の形：[{"date","quote","speaker","meeting","full","reply_speaker","reply"}] */
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
  ".zen-reply{border-left:3px solid var(--accent);padding-left:12px}"+
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

  function load(){
    if(data) return Promise.resolve(data);
    if(!loading) loading=fetch("full/"+town+".json",{cache:"force-cache"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){
      data=j.map(function(e){e._n=norm(e.full);e._q=norm(e.quote);return e});return data});
    return loading;
  }

  // 引用の頭（（中略）の前）で探す。同じ日付を先に見る。
  function find(date,quote){
    var head=norm(quote.split(/（中略）|\(中略\)/)[0]);
    var keys=[head.slice(0,40),head.slice(0,20),head.slice(-20)].filter(function(k){return k.length>=8});
    var same=data.filter(function(e){return e.date===date});
    var pools=[same,data];
    for(var p=0;p<pools.length;p++){for(var k=0;k<keys.length;k++){
      for(var i=0;i<pools[p].length;i++){var e=pools[p][i];if(e._n.indexOf(keys[k])>=0||(e._q&&head.indexOf(e._q)===0))return e}
    }}
    return null;
  }

  // 本文の中で引用にあたる所に印を付ける（記号の違いがあっても当たるよう、1文字ずつ対応表を作る）
  function marked(full,quote){
    var parts=quote.split(/（中略）|\(中略\)/).map(norm).filter(function(s){return s.length>=6});
    var map=[],n="";
    for(var i=0;i<full.length;i++){var c=norm(full[i]);if(c){map.push(i);n+=c}}
    var spans=[];
    parts.forEach(function(p){var at=n.indexOf(p);if(at>=0)spans.push([map[at],map[at+p.length-1]+1])});
    spans.sort(function(a,b){return a[0]-b[0]});
    var out="",pos=0;
    spans.forEach(function(s){if(s[0]<pos)return;out+=esc(full.slice(pos,s[0]))+"<mark>"+esc(full.slice(s[0],s[1]))+"</mark>";pos=s[1]});
    return out+esc(full.slice(pos));
  }

  function open(rec){
    var when=rec.querySelector(".when"),bq=rec.querySelector("blockquote");
    var date=(when.textContent.trim().split(/\s/)[0]||""),quote=bq.textContent;
    var src=when.querySelector("a");
    var ttl=dlg.querySelector(".ttl"),sub=dlg.querySelector(".sub"),body=dlg.querySelector(".zen-body");
    ttl.textContent="読み込み中…";sub.textContent="";body.innerHTML="";
    if(!dlg.open)dlg.showModal();
    load().then(function(){
      var e=find(date,quote);
      if(!e){ttl.textContent="全文が見つかりませんでした";
        body.innerHTML='<p class="zen-note">この引用の全文は、まだ用意できていません。'+(src?'<a href="'+esc(src.href)+'" target="_blank" rel="noopener">会議録</a>で確かめてください。':'')+'</p>';return}
      ttl.textContent=(e.speaker||"")+"の発言（全文）";
      sub.textContent=[e.date,e.meeting].filter(Boolean).join("　");
      var h='<p class="zen-note">黄色の所が、このページで引用した部分です。文は会議録のままです。</p>'+
        '<div class="zen-txt">'+marked(e.full,quote)+'</div>';
      if(e.reply) h+='<h4>すぐ後の答弁'+(e.reply_speaker?"（"+esc(e.reply_speaker)+"）":"")+'</h4><div class="zen-txt zen-reply">'+esc(e.reply)+'</div>';
      else h+='<p class="zen-note">この発言のすぐ後に答弁はありません。</p>';
      if(src) h+='<p class="zen-note">出典：<a href="'+esc(src.href)+'" target="_blank" rel="noopener">会議録（市のサイト）</a></p>';
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
