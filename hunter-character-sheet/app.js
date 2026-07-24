(() => {
  const ARCS = window.HXH_ARCS || [];
  const CHARACTERS = window.HXH_CHARACTERS || [];
  let activeArc = ARCS.length ? ARCS[0].id : '';
  let spoilerOn = false;
  let query = '';
  let group = 'all';
  const $ = id => document.getElementById(id);

  function safeText(value){ return String(value ?? ''); }

  function renderArcs(){
    $('arcs').innerHTML = ARCS.map(a => `<button class="arc ${a.id===activeArc?'active':''}" onclick="HXH.setArc('${a.id}')">${safeText(a.name)}</button>`).join('');
  }

  function setArc(id){
    activeArc = id;
    group = 'all';
    $('group').value = 'all';
    renderArcs();
    renderGroupOptions();
    render();
  }

  function renderGroupOptions(){
    const groups = [...new Set(CHARACTERS.filter(c => c.arc===activeArc).map(c => c.group).filter(Boolean))].sort();
    $('group').innerHTML = '<option value="all">所属すべて</option>' + groups.map(g => `<option value="${safeText(g)}">${safeText(g)}</option>`).join('');
  }

  function filtered(){
    const word = query.toLowerCase();
    return CHARACTERS.filter(c => {
      if(c.arc !== activeArc) return false;
      if(group !== 'all' && c.group !== group) return false;
      if(!word) return true;
      return [c.name,c.role,c.group,c.nen,c.summary,c.ability,c.relation].map(safeText).join(' ').toLowerCase().includes(word);
    });
  }

  function render(){
    const arc = ARCS.find(a => a.id===activeArc);
    if(!arc){
      $('arcInfo').innerHTML = '<h2>データ読み込みエラー</h2><p>ページを再読み込みしてください。</p>';
      $('grid').innerHTML = '<div class="empty">キャラクターデータを読み込めませんでした。</div>';
      return;
    }
    $('arcInfo').innerHTML = `<h2>${safeText(arc.name)}</h2><p>${safeText(arc.summary)}</p>`;
    const chars = filtered();
    $('count').textContent = `${chars.length} CHARACTER${chars.length===1?'':'S'}`;
    $('grid').className = `grid ${spoilerOn?'showSpoiler':''}`;
    $('grid').innerHTML = chars.length ? chars.map(c => `
      <article class="card" onclick="this.classList.toggle('open')">
        <div class="cardTop">
          <div class="avatar">${safeText(c.initial)}</div>
          <div><div class="name">${safeText(c.name)}</div><div class="role">${safeText(c.role)}</div></div>
        </div>
        <div class="tags"><span class="tag group">${safeText(c.group)}</span><span class="tag nen">${safeText(c.nen)}</span></div>
        <div class="summary">${safeText(c.summary)}</div>
        <div class="detail">
          <dl><dt>能力</dt><dd>${safeText(c.ability)}</dd><dt>関係</dt><dd>${safeText(c.relation)}</dd></dl>
          ${c.spoiler ? `<div class="spoiler"><b>ネタバレ</b><br>${safeText(c.spoiler)}</div>` : ''}
        </div>
      </article>`).join('') : '<div class="empty">該当するキャラクターがいません。</div>';
  }

  window.HXH = { setArc };

  function init(){
    if(!ARCS.length || !CHARACTERS.length){
      $('arcInfo').innerHTML = '<h2>データ読み込みエラー</h2><p>キャラクターデータを取得できませんでした。</p>';
      $('grid').innerHTML = '<div class="empty">Safariの再読み込みをお試しください。</div>';
      return;
    }
    $('search').addEventListener('input', e => { query = e.target.value.trim(); render(); });
    $('group').addEventListener('change', e => { group = e.target.value; render(); });
    $('spoilerBtn').addEventListener('click', () => {
      spoilerOn = !spoilerOn;
      $('spoilerBtn').textContent = `ネタバレ表示：${spoilerOn?'ON':'OFF'}`;
      render();
    });
    renderArcs();
    renderGroupOptions();
    render();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
