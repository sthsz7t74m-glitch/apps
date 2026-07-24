const svg = {
  reflection:`<svg viewBox="0 0 320 170" width="100%"><rect x="20" y="118" width="280" height="8" rx="4" fill="#8e7f67"/><line x1="160" y1="20" x2="160" y2="118" stroke="#55736a" stroke-width="2" stroke-dasharray="5 4"/><text x="170" y="28" font-size="12" fill="#55736a">法線</text><line x1="70" y1="50" x2="160" y2="108" stroke="#c85d57" stroke-width="4"/><line x1="160" y1="108" x2="252" y2="48" stroke="#3b75ad" stroke-width="4"/><text x="28" y="47" font-size="12" fill="#c85d57">入射光</text><text x="238" y="40" font-size="12" fill="#3b75ad">反射光</text><path d="M160 90 A25 25 0 0 0 138 96" fill="none" stroke="#e2b841" stroke-width="3"/><path d="M160 90 A25 25 0 0 1 182 96" fill="none" stroke="#e2b841" stroke-width="3"/></svg>`,
  refraction:`<svg viewBox="0 0 320 170" width="100%"><line x1="20" y1="95" x2="300" y2="95" stroke="#6ea6d6" stroke-width="4"/><text x="28" y="87" font-size="12" fill="#3b75ad">空気</text><text x="28" y="114" font-size="12" fill="#3b75ad">ガラス</text><line x1="160" y1="20" x2="160" y2="150" stroke="#55736a" stroke-width="2" stroke-dasharray="5 4"/><line x1="70" y1="40" x2="160" y2="95" stroke="#c85d57" stroke-width="4"/><line x1="160" y1="95" x2="210" y2="140" stroke="#3b75ad" stroke-width="4"/><text x="60" y="32" font-size="12" fill="#c85d57">入射光</text><text x="215" y="146" font-size="12" fill="#3b75ad">屈折光</text></svg>`,
  lens:`<svg viewBox="0 0 320 170" width="100%"><line x1="15" y1="85" x2="305" y2="85" stroke="#55736a" stroke-width="2"/><ellipse cx="160" cy="85" rx="18" ry="58" fill="#a9d5f5" stroke="#3975ab" stroke-width="3"/><circle cx="92" cy="85" r="4" fill="#c85d57"/><circle cx="228" cy="85" r="4" fill="#c85d57"/><text x="82" y="103" font-size="12">F</text><text x="220" y="103" font-size="12">F</text><line x1="48" y1="35" x2="48" y2="85" stroke="#4f8b71" stroke-width="4"/><line x1="48" y1="35" x2="160" y2="35" stroke="#4f8b71" stroke-width="3"/><line x1="160" y1="35" x2="264" y2="118" stroke="#4f8b71" stroke-width="3"/><line x1="48" y1="35" x2="160" y2="85" stroke="#e2b841" stroke-width="3"/><line x1="160" y1="85" x2="264" y2="118" stroke="#e2b841" stroke-width="3"/><line x1="264" y1="118" x2="264" y2="85" stroke="#c85d57" stroke-width="4"/></svg>`,
  wave:`<svg viewBox="0 0 320 170" width="100%"><line x1="20" y1="85" x2="300" y2="85" stroke="#8e7f67" stroke-width="1.5"/><path d="M20 85 C40 45,60 45,80 85 S120 125,140 85 S180 45,200 85 S240 125,260 85 S280 45,300 85" fill="none" stroke="#3b75ad" stroke-width="4"/><line x1="40" y1="30" x2="40" y2="140" stroke="#c85d57" stroke-width="2" stroke-dasharray="4 4"/><line x1="80" y1="30" x2="80" y2="140" stroke="#c85d57" stroke-width="2" stroke-dasharray="4 4"/><text x="43" y="27" font-size="12" fill="#c85d57">山</text><text x="86" y="27" font-size="12" fill="#c85d57">山</text><line x1="40" y1="148" x2="80" y2="148" stroke="#4f8b71" stroke-width="3"/><text x="43" y="165" font-size="12" fill="#4f8b71">1波長</text></svg>`,
  force:`<svg viewBox="0 0 320 170" width="100%"><rect x="120" y="65" width="80" height="40" rx="8" fill="#ead067" stroke="#8e7f67"/><line x1="70" y1="85" x2="118" y2="85" stroke="#c85d57" stroke-width="5"/><polygon points="70,85 83,78 83,92" fill="#c85d57"/><line x1="202" y1="85" x2="250" y2="85" stroke="#3b75ad" stroke-width="5"/><polygon points="250,85 237,78 237,92" fill="#3b75ad"/><text x="48" y="75" font-size="12" fill="#c85d57">2N</text><text x="256" y="75" font-size="12" fill="#3b75ad">3N</text><text x="123" y="58" font-size="12" fill="#55736a">反対向きの力</text></svg>`,
  density:`<svg viewBox="0 0 320 170" width="100%"><rect x="55" y="30" width="70" height="100" fill="#e7f2ff" stroke="#55736a" stroke-width="3" rx="6"/><rect x="195" y="30" width="70" height="100" fill="#e7f2ff" stroke="#55736a" stroke-width="3" rx="6"/><rect x="70" y="90" width="40" height="40" fill="#c85d57" opacity=".85"/><rect x="210" y="55" width="40" height="75" fill="#3b75ad" opacity=".85"/><text x="40" y="150" font-size="12">同じ体積でも質量はちがう</text></svg>`,
  gas:`<svg viewBox="0 0 320 170" width="100%"><rect x="40" y="80" width="70" height="60" fill="#dff0ff" stroke="#55736a"/><rect x="160" y="45" width="55" height="95" fill="none" stroke="#55736a" stroke-width="3"/><rect x="250" y="45" width="55" height="95" fill="none" stroke="#55736a" stroke-width="3"/><text x="36" y="72" font-size="12">水上置換</text><text x="150" y="37" font-size="12">上方置換</text><text x="242" y="37" font-size="12">下方置換</text><line x1="75" y1="50" x2="75" y2="80" stroke="#3b75ad" stroke-width="3"/></svg>`,
  flower:`<svg viewBox="0 0 320 170" width="100%"><circle cx="160" cy="70" r="18" fill="#ead067"/><ellipse cx="160" cy="35" rx="20" ry="28" fill="#ffb3c1"/><ellipse cx="195" cy="55" rx="20" ry="28" fill="#ffb3c1" transform="rotate(45 195 55)"/><ellipse cx="195" cy="95" rx="20" ry="28" fill="#ffb3c1" transform="rotate(135 195 95)"/><ellipse cx="125" cy="95" rx="20" ry="28" fill="#ffb3c1" transform="rotate(-135 125 95)"/><ellipse cx="125" cy="55" rx="20" ry="28" fill="#ffb3c1" transform="rotate(-45 125 55)"/><line x1="160" y1="88" x2="160" y2="140" stroke="#4f8b71" stroke-width="6"/><text x="172" y="72" font-size="12">めしべ</text><text x="214" y="76" font-size="12">花弁</text></svg>`,
  photosynthesis:`<svg viewBox="0 0 320 170" width="100%"><ellipse cx="150" cy="90" rx="80" ry="40" fill="#86c76b" stroke="#4f8b71" stroke-width="4"/><line x1="75" y1="90" x2="40" y2="90" stroke="#3b75ad" stroke-width="4"/><polygon points="40,90 52,83 52,97" fill="#3b75ad"/><line x1="260" y1="90" x2="295" y2="90" stroke="#c85d57" stroke-width="4"/><polygon points="295,90 283,83 283,97" fill="#c85d57"/><circle cx="60" cy="45" r="18" fill="#ead067"/><text x="35" y="32" font-size="12">光</text><text x="8" y="86" font-size="12" fill="#3b75ad">二酸化炭素</text><text x="260" y="86" font-size="12" fill="#c85d57">酸素</text><text x="122" y="96" font-size="12">葉</text></svg>`,
  earthquake:`<svg viewBox="0 0 320 170" width="100%"><line x1="20" y1="135" x2="300" y2="135" stroke="#8e7f67" stroke-width="2"/><line x1="40" y1="20" x2="40" y2="140" stroke="#8e7f67" stroke-width="2"/><polyline points="40,120 70,118 100,116 130,112 150,92 170,105 190,72 210,110 230,52 250,118 270,40 290,116" fill="none" stroke="#3b75ad" stroke-width="3"/><polyline points="40,122 70,121 100,120 130,119 160,117 190,115 220,113 250,111 290,109" fill="none" stroke="#c85d57" stroke-width="3" stroke-dasharray="5 4"/><text x="210" y="48" font-size="12" fill="#3b75ad">S波</text><text x="154" y="108" font-size="12" fill="#c85d57">P波</text></svg>`,
  seafloor:`<svg viewBox="0 0 320 170" width="100%"><line x1="20" y1="45" x2="300" y2="45" stroke="#6ea6d6" stroke-width="3"/><path d="M30 120 C80 95,100 140,135 100 S200 70,220 100 S265 135,290 115" fill="none" stroke="#8e7f67" stroke-width="5"/><circle cx="140" cy="98" r="4" fill="#c85d57"/><line x1="140" y1="98" x2="140" y2="45" stroke="#c85d57" stroke-dasharray="5 4"/><text x="126" y="112" font-size="12">震源</text><text x="116" y="38" font-size="12">震央</text></svg>`,
  circuit:`<svg viewBox="0 0 320 170" width="100%"><rect x="55" y="30" width="210" height="100" fill="none" stroke="#3b75ad" stroke-width="4" rx="10"/><line x1="90" y1="130" x2="90" y2="150" stroke="#3b75ad" stroke-width="4"/><line x1="102" y1="130" x2="102" y2="145" stroke="#3b75ad" stroke-width="2"/><circle cx="160" cy="80" r="22" fill="#fff3ef" stroke="#c85d57" stroke-width="4"/><text x="153" y="87" font-size="20" fill="#c85d57">A</text><line x1="240" y1="55" x2="240" y2="105" stroke="#55736a" stroke-width="6"/><line x1="250" y1="55" x2="250" y2="105" stroke="#55736a" stroke-width="2"/></svg>`,
  magnetic:`<svg viewBox="0 0 320 170" width="100%"><rect x="75" y="40" width="170" height="80" rx="18" fill="none" stroke="#8e7f67" stroke-width="3"/><path d="M100 80 C120 55,145 55,160 80 S200 105,220 80" fill="none" stroke="#c85d57" stroke-width="4"/><text x="112" y="32" font-size="12">コイル</text><text x="233" y="68" font-size="12">N</text><text x="233" y="100" font-size="12">S</text></svg>`,
  atom:`<svg viewBox="0 0 320 170" width="100%"><circle cx="160" cy="85" r="18" fill="#ead067"/><ellipse cx="160" cy="85" rx="55" ry="24" fill="none" stroke="#3b75ad" stroke-width="3"/><ellipse cx="160" cy="85" rx="24" ry="55" fill="none" stroke="#c85d57" stroke-width="3"/><circle cx="105" cy="85" r="6" fill="#3b75ad"/><circle cx="160" cy="30" r="6" fill="#c85d57"/><circle cx="215" cy="85" r="6" fill="#3b75ad"/></svg>`,
  body:`<svg viewBox="0 0 320 170" width="100%"><rect x="20" y="25" width="82" height="28" rx="14" fill="#f5d565"/><text x="40" y="44" font-size="13">でんぷん</text><rect x="118" y="25" width="82" height="28" rx="14" fill="#b2dfdb"/><text x="141" y="44" font-size="13">麦芽糖</text><rect x="216" y="25" width="82" height="28" rx="14" fill="#ffccbc"/><text x="237" y="44" font-size="13">ブドウ糖</text><line x1="102" y1="39" x2="118" y2="39" stroke="#4f8b71" stroke-width="4"/><line x1="200" y1="39" x2="216" y2="39" stroke="#4f8b71" stroke-width="4"/><path d="M55 90 C55 70,105 70,105 93 S55 120,55 147" fill="none" stroke="#c85d57" stroke-width="8"/><line x1="220" y1="82" x2="220" y2="132" stroke="#3b75ad" stroke-width="10"/><text x="18" y="160" font-size="12">小腸</text><text x="194" y="150" font-size="12">毛細血管</text></svg>`,
  circulation:`<svg viewBox="0 0 320 170" width="100%"><path d="M160 58 C140 28,100 38,105 75 C110 108,160 130,160 130 C160 130,210 108,215 75 C220 38,180 28,160 58Z" fill="#ffb3b0" stroke="#c85d57" stroke-width="3"/><line x1="70" y1="80" x2="105" y2="80" stroke="#3b75ad" stroke-width="5"/><line x1="215" y1="80" x2="250" y2="80" stroke="#c85d57" stroke-width="5"/><text x="40" y="74" font-size="12" fill="#3b75ad">静脈</text><text x="252" y="74" font-size="12" fill="#c85d57">動脈</text><text x="145" y="150" font-size="12">心臓</text></svg>`,
  weather:`<svg viewBox="0 0 320 170" width="100%"><circle cx="75" cy="48" r="18" fill="#ead067"/><path d="M175 55 l25 0" stroke="#c85d57" stroke-width="4"/><path d="M185 55 q10 -14 20 0 q-10 14 -20 0" fill="none" stroke="#c85d57" stroke-width="3"/><path d="M200 55 l30 0" stroke="#c85d57" stroke-width="4"/><path d="M90 112 l25 0" stroke="#3b75ad" stroke-width="4"/><path d="M100 112 l8 -10 l8 10 l8 -10" fill="none" stroke="#3b75ad" stroke-width="3"/><path d="M124 112 l30 0" stroke="#3b75ad" stroke-width="4"/><text x="165" y="38" font-size="12">温暖前線</text><text x="84" y="95" font-size="12">寒冷前線</text></svg>`,
  moon:`<svg viewBox="0 0 320 170" width="100%"><circle cx="70" cy="80" r="28" fill="#ead067"/><text x="55" y="125" font-size="12">太陽</text><circle cx="160" cy="80" r="20" fill="#6ea6d6"/><text x="146" y="115" font-size="12">地球</text><circle cx="250" cy="50" r="10" fill="#f5f3ef"/><circle cx="270" cy="80" r="10" fill="#f5f3ef"/><circle cx="250" cy="110" r="10" fill="#f5f3ef"/><path d="M250 50 A35 35 0 0 1 270 80 A35 35 0 0 1 250 110" fill="none" stroke="#8e7f67" stroke-width="2"/></svg>`,
  heredity:`<svg viewBox="0 0 320 170" width="100%"><rect x="70" y="40" width="180" height="90" rx="8" fill="none" stroke="#8e7f67" stroke-width="3"/><line x1="160" y1="40" x2="160" y2="130" stroke="#8e7f67"/><line x1="70" y1="85" x2="250" y2="85" stroke="#8e7f67"/><text x="97" y="70" font-size="16">A</text><text x="197" y="70" font-size="16">a</text><text x="95" y="108" font-size="16">A</text><text x="196" y="108" font-size="16">a</text><text x="142" y="32" font-size="12">遺伝の表</text></svg>`
};

const B=(title,content)=>({title,content});
const Q=(q,c,a,e)=>({q,c,a,e});
const F=t=>`<div class="formula">${t}</div>`;
const I=t=>`<div class="svgbox">${t}</div>`;
const mem=t=>`<div class="memory"><b>覚え方</b><br>${t}</div>`;
const warn=t=>`<div class="warn"><b>注意</b><br>${t}</div>`;
const step=t=>`<div class="steps"><b>解き方</b><br>${t}</div>`;
const tags=(a,b)=>`<div class="miniGrid"><div class="tagBox"><b>絶対暗記</b>${a}</div><div class="tagBox"><b>おさえること</b>${b}</div></div>`;

const UNITS=[
  {id:'light', grade:1, field:'物理', icon:'🔦', title:'光・音・力', desc:'反射・屈折、レンズ、音、力', boards:[
    B('光の反射', `<h3>反射の基本</h3><p><span class="must">入射角＝反射角</span>。角度は<span class="must">法線</span>から測る。</p>${I(svg.reflection)}${tags('法線 / 入射角 / 反射角','鏡に対する角度ではなく、法線からの角度で考える')} ${mem('「はんしゃ」は左右対称と考えると角度を間違えにくい。')} ${warn('鏡の面から角度を測らない。')}`),
    B('光の屈折', `<h3>屈折の向き</h3><p>空気からガラスなど<span class="marker">密な物質</span>へ進むと<span class="must">法線側</span>に曲がる。逆に出ると法線から離れる。</p>${I(svg.refraction)}${mem('「密へ行くと中心へ寄る」')} ${warn('反射と屈折を混同しない。')}`),
    B('凸レンズ', `<h3>像のでき方</h3><p><span class="must">実像</span>はスクリーンにうつる。<span class="must">虚像</span>はうつらない。</p>${I(svg.lens)}${tags('焦点 / 実像 / 虚像','焦点の外なら倒立実像、内なら正立虚像')} ${step('平行な光は焦点を通る、レンズ中心を通る光は直進、の2本で作図する。')}`),
    B('音', `<h3>音の性質</h3><p><span class="must">高さ＝振動数</span>、<span class="must">大きさ＝振幅</span>。音は真空中を伝わらない。</p>${I(svg.wave)}${mem('「高さは回数、大きさは幅」')} ${warn('波長が短いほど振動数は大きい。')}`),
    B('力', `<h3>力のはたらき</h3><p>力の三要素は<span class="must">作用点・向き・大きさ</span>。ばねの伸びは加えた力に比例する。</p>${I(svg.force)}${F('ばねの伸び ∝ 加えた力')}${step('比例グラフでは原点を通る直線になる。2倍・3倍を素直に使う。')}`),
    B('入試ポイント', `<h3>よく出る問題</h3><ul><li>反射の作図</li><li>屈折の向きの説明</li><li>凸レンズの像の位置</li><li>ばねグラフ</li></ul>${warn('音は「速さ」よりも「振動数・振幅」が問われやすい。')}`)
  ], questions:[
    Q('反射で等しいのはどれ？',['入射角と反射角','入射角と屈折角','鏡の角度と反射角','光の速さと反射角'],0,'反射では入射角と反射角が等しい。'),
    Q('空気からガラスへ進む光はどう曲がる？',['法線側へ曲がる','法線から離れる','まっすぐ進む','必ず反射する'],0,'密な物質へ進むと法線側へ曲がる。'),
    Q('音の高さを決めるものは？',['振幅','振動数','伝わる速さ','音源の大きさ'],1,'音の高さは振動数。'),
    Q('ばねに加える力を2倍にすると、伸びはどうなる？',['1/2倍','変わらない','2倍','4倍'],2,'比例関係なので2倍。')
  ]},
  {id:'matter', grade:1, field:'化学', icon:'🧪', title:'物質の性質', desc:'密度、気体、状態変化', boards:[
    B('密度の意味', `<h3>密度</h3><p>密度は<span class="must">1cm³あたりの質量</span>。物質を見分ける手がかり。</p>${I(svg.density)}${F('密度[g/cm³]＝質量[g]÷体積[cm³]')} ${mem('「みつど＝重さ÷かさ」')} `),
    B('密度の計算', `<h3>計算練習</h3>${step('①単位をそろえる ②式に代入する ③小数の位置に注意する')} ${warn('gとkg、cm³とmLの混同に注意。1mL=1cm³。')}`),
    B('気体の集め方', `<h3>集め方</h3>${I(svg.gas)}<ul><li><span class="must">水上置換</span>：水に溶けにくい気体</li><li><span class="must">上方置換</span>：空気より軽い気体</li><li><span class="must">下方置換</span>：空気より重い気体</li></ul>${mem('「軽い→上、重い→下、水に溶けにくい→水」')}`),
    B('気体の性質', `<h3>代表的な気体</h3><p><span class="must">酸素</span>：ものを燃えやすくする。<span class="must">二酸化炭素</span>：石灰水を白くにごらせる。<span class="must">水素</span>：火をつけると音を立てて燃える。</p>`),
    B('状態変化', `<h3>状態変化</h3><p>状態変化では<span class="must">物質の種類は変わらない</span>。<span class="marker">質量は一定</span>で、純物質の融点・沸点は一定。</p>${warn('溶ける・蒸発する・燃える を区別する。燃えるのは化学変化。')}`),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>密度の表・グラフ</li><li>気体の集め方の理由</li><li>加熱曲線の読み取り</li></ul>`)
  ], questions:[Q('質量20g、体積5cm³の密度は？',['2','3','4','5'],2,'20÷5=4g/cm³。'),Q('酸素の集め方として適切なのは？',['上方置換','下方置換','水上置換','ろ過'],2,'酸素は水に溶けにくいため水上置換。'),Q('純物質が沸騰している間の温度はどうなる？',['上がり続ける','下がる','一定','不規則に変わる'],2,'純物質の沸騰中は温度一定。'),Q('状態変化で変わらないものは？',['体積','見た目','質量','温度'],2,'質量は保存される。')]},
  {id:'plants', grade:1, field:'生物', icon:'🌿', title:'植物と分類', desc:'花、光合成、呼吸、分類', boards:[
    B('花のつくり', `<h3>花の各部分</h3>${I(svg.flower)}<p><span class="must">おしべ</span>のやくで花粉がつくられ、<span class="must">めしべ</span>の柱頭につくと受粉。</p>`),
    B('受粉後の変化', `<h3>受粉後</h3><p><span class="must">胚珠→種子</span>、<span class="must">子房→果実</span>。</p>${mem('「はいしゅ→たね、しぼう→くだもの」')} ${warn('裸子植物には子房がない。')}`),
    B('光合成', `<h3>光合成</h3>${I(svg.photosynthesis)}${F('二酸化炭素 + 水 → 養分 + 酸素')}<p>光合成は<span class="must">葉緑体</span>で行う。</p>`),
    B('呼吸', `<h3>呼吸</h3><p>呼吸は生きた細胞で<span class="must">昼夜行われる</span>。養分を分解してエネルギーを取り出す。</p>${warn('「植物は夜だけ呼吸する」は誤り。昼も夜も呼吸する。')}`),
    B('植物の分類', `<h3>単子葉類と双子葉類</h3>${tags('<span class="must">双子葉類</span>：網状脈・主根と側根・維管束が輪状','<span class="must">単子葉類</span>：平行脈・ひげ根・維管束が散在')} ${mem('双子は「網・主・輪」、単子は「平・ひげ・散」')} `),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>対照実験</li><li>ヨウ素液・BTB溶液</li><li>花のつくり</li><li>分類</li></ul>`)], questions:[Q('受粉後に果実になる部分は？',['やく','子房','胚珠','花弁'],1,'子房が果実、胚珠が種子。'),Q('光合成を行う細胞小器官は？',['核','葉緑体','液胞','細胞膜'],1,'光合成は葉緑体。'),Q('双子葉類の特徴として正しいものは？',['葉脈が平行','ひげ根','維管束がばらばら','網状脈'],3,'双子葉類は網状脈。'),Q('呼吸について正しいものは？',['昼だけ行う','夜だけ行う','昼夜行う','葉だけで行う'],2,'呼吸は昼夜行われる。')]},
  {id:'earth1', grade:1, field:'地学', icon:'🪨', title:'大地の変化', desc:'火山、地震、地層、化石', boards:[
    B('火山と岩石', `<h3>火山岩と深成岩</h3><p>地表付近で急に冷えると<span class="must">火山岩</span>、地下でゆっくり冷えると<span class="must">深成岩</span>。</p>${mem('急冷→細かく、ゆっくり→大きく')} `),
    B('火成岩の組織', `<h3>組織</h3><p>火山岩は<span class="must">斑状組織</span>、深成岩は<span class="must">等粒状組織</span>。</p>`),
    B('地震波', `<h3>P波とS波</h3>${I(svg.earthquake)}<p><span class="must">P波</span>は速く初期微動、<span class="must">S波</span>は遅く主要動。</p>${mem('PはPrompt、SはSlow')} ${F('初期微動継続時間が長いほど震源から遠い')}`),
    B('震源と震央', `<h3>震源・震央</h3>${I(svg.seafloor)}<p><span class="must">震源</span>は地下で地震が起こった場所、<span class="must">震央</span>はその真上の地表の点。</p>`),
    B('地層と化石', `<h3>地層</h3><p><span class="must">示準化石</span>は年代、<span class="must">示相化石</span>は環境の手がかり。</p>${warn('れき岩→砂岩→泥岩の順に粒が細かくなる。')}`),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>P波・S波のグラフ</li><li>柱状図の対比</li><li>化石の用途</li></ul>`)], questions:[Q('主要動を起こす地震波は？',['P波','S波','音波','表面波'],1,'S波が主要動を起こす。'),Q('地層のできた年代を調べる手がかりになる化石は？',['示相化石','示準化石','生痕化石','植物化石'],1,'示準化石は年代を示す。'),Q('マグマが地表付近で急に冷えてできる岩石は？',['深成岩','火山岩','石灰岩','泥岩'],1,'急冷すると火山岩。'),Q('初期微動継続時間が長い観測点は震源からどうか？',['近い','遠い','同じ','求められない'],1,'長いほど震源から遠い。')]},
  {id:'electric', grade:2, field:'物理', icon:'⚡', title:'電流とその利用', desc:'回路、電圧、電力、磁界', boards:[
    B('オームの法則', `<h3>基本式</h3>${F('電圧[V]＝電流[A]×抵抗[Ω]')}<p><span class="blueKey">I=V/R、R=V/I</span> と変形して使う。</p>${mem('VRIの三角形で覚える人も多い。')}`),
    B('直列回路', `<h3>直列回路</h3><p><span class="must">電流がどこも同じ</span>。電圧は分かれる。</p>${I(svg.circuit)}`),
    B('並列回路', `<h3>並列回路</h3><p><span class="must">電圧がどこも同じ</span>。電流は分かれる。</p>${warn('直列と並列で「同じ」ものを逆にしない。')}`),
    B('電力と電力量', `<h3>電力</h3>${F('電力[W]＝電圧[V]×電流[A]')} ${F('電力量[J]＝電力[W]×時間[s]')} ${step('①VとIを求める ②P=VI ③時間をかける')}`),
    B('電流と磁界', `<h3>磁界</h3>${I(svg.magnetic)}<p>電流のまわりには磁界ができる。コイルや鉄心で磁界を強くできる。</p>`),
    B('電磁誘導', `<h3>電磁誘導</h3><p>コイルの中の磁界が変化すると<span class="must">誘導電流</span>が流れる。</p>`),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>回路計算</li><li>電力と電力量</li><li>磁界の向き</li><li>誘導電流</li></ul>`)], questions:[Q('電圧6V、抵抗3Ωのときの電流は？',['1A','2A','3A','18A'],1,'I=V/R=6/3=2A。'),Q('電力を表す式は？',['P=VI','P=IR','P=V/R','P=Rt'],0,'電力はP=VI。'),Q('コイルの中の磁界が変化して電流が生じる現象は？',['電気分解','電磁誘導','静電気','整流'],1,'電磁誘導。'),Q('直列回路で各部分に共通するものは？',['電流','電圧','抵抗','電力'],0,'直列回路では電流が同じ。')]},
  {id:'chem', grade:2, field:'化学', icon:'🧫', title:'化学変化と原子・分子', desc:'原子、分解、酸化、還元', boards:[
    B('原子・分子', `<h3>原子と分子</h3>${I(svg.atom)}<p>原子は物質のもと。原子が結びついて<span class="must">分子</span>になる。</p>`),
    B('化学変化のきまり', `<h3>保存</h3><p>化学変化では<span class="must">原子の種類と数は変わらない</span>。</p>`),
    B('分解', `<h3>分解</h3><p>1つの物質が2種類以上の別の物質に分かれる変化。水の電気分解では水素と酸素ができる。</p>`),
    B('酸化・還元', `<h3>酸化と還元</h3><p><span class="must">酸化</span>は酸素と結びつく変化、<span class="must">還元</span>は酸素を失う変化。</p>${mem('酸化は酸素を足す、還元は酸素を返す')} `),
    B('質量保存', `<h3>質量保存の法則</h3><p>化学変化の前後で<span class="must">全体の質量は等しい</span>。</p>${warn('気体が出入りする実験では見かけの質量が変わる。')}`),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>質量変化グラフ</li><li>原子モデル</li><li>酸化・還元</li></ul>`)], questions:[Q('化学変化の前後で保存されるものは？',['原子の種類と数','色','体積','におい'],0,'原子の種類と数が保存される。'),Q('銅が酸素と結びつく変化は？',['還元','蒸発','酸化','中和'],2,'酸素と結びつく変化は酸化。'),Q('水を分解するとできる気体の組み合わせは？',['酸素と窒素','水素と酸素','二酸化炭素と酸素','水素と窒素'],1,'水は水素と酸素に分解される。'),Q('密閉した容器内で化学変化を起こしたとき、全体の質量は？',['増える','減る','変わらない','不規則'],2,'密閉なら質量保存。')]},
  {id:'biology2', grade:2, field:'生物', icon:'🫀', title:'動物の体のつくりとはたらき', desc:'消化、呼吸、循環、神経', boards:[
    B('消化', `<h3>消化</h3>${I(svg.body)}<p>でんぷんは最終的に<span class="must">ブドウ糖</span>になる。タンパク質は<span class="must">アミノ酸</span>。</p>`),
    B('消化液', `<h3>消化液</h3><p><span class="must">だ液</span>・胃液・すい液などがはたらく。</p>${warn('すい液は多くの栄養素に関わる重要な消化液。')}`),
    B('呼吸', `<h3>呼吸</h3><p>肺で<span class="must">酸素</span>を取り入れ、<span class="must">二酸化炭素</span>を出す。</p>`),
    B('循環', `<h3>血液循環</h3>${I(svg.circulation)}<p>心臓は血液を全身へ送るポンプ。動脈は心臓から出る、静脈は心臓へ戻る。</p>`),
    B('刺激と反応', `<h3>神経</h3><p>刺激は感覚器官→神経→脳・せきずいへ伝わる。反射は素早い無意識の反応。</p>${mem('反射は「考える前に動く」')} `),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>消化と吸収</li><li>肺胞・毛細血管</li><li>血液循環</li><li>反射の経路</li></ul>`)], questions:[Q('でんぷんが最終的に消化されてできるものは？',['アミノ酸','ブドウ糖','脂肪酸','グリセリン'],1,'でんぷんは最終的にブドウ糖になる。'),Q('反射の中枢になることが多いのは？',['小脳','大脳','せきずい','肺'],2,'反射はせきずいが中枢。'),Q('肺で血液中に取り入れる気体は？',['窒素','二酸化炭素','酸素','水蒸気'],2,'肺では酸素を取り入れる。'),Q('養分を吸収する主な器官は？',['胃','小腸','肝臓','食道'],1,'小腸で吸収。')]},
  {id:'weather', grade:2, field:'地学', icon:'☁️', title:'天気とその変化', desc:'気団、前線、天気図', boards:[
    B('気象観測', `<h3>観測するもの</h3><p>気温・湿度・気圧・風向・風力を観測する。<span class="must">百葉箱</span>は気温を正しく測るための箱。</p>`),
    B('湿度', `<h3>湿度</h3>${F('湿度[%]＝実際の水蒸気量÷飽和水蒸気量×100')} ${warn('気温が下がると飽和水蒸気量も小さくなる。')}`),
    B('前線', `<h3>前線</h3>${I(svg.weather)}<p><span class="must">温暖前線</span>では弱い雨が長く続きやすい。<span class="must">寒冷前線</span>では強い雨が短時間で降りやすい。</p>${mem('温暖はのんびり、寒冷は急に激しく')} `),
    B('低気圧・高気圧', `<h3>気圧配置</h3><p>北半球で低気圧のまわりでは<span class="must">反時計回りに吹き込む</span>。高気圧では時計回りに吹き出す。</p>`),
    B('日本の天気', `<h3>天気の移り変わり</h3><p>日本では西から東へ天気が変わることが多い。</p>`),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>天気図の記号</li><li>前線通過時の変化</li><li>湿度計算</li></ul>`)], questions:[Q('寒冷前線が通過するときの天気として多いのは？',['弱い雨が長く続く','晴れが続く','強い雨が短時間で降る','雪だけが降る'],2,'寒冷前線では強い雨が短時間で降りやすい。'),Q('百葉箱の役割として適切なのは？',['風を止める','気圧を上げる','気温を正しく測る','雨量を測る'],2,'気温を正しく測る。'),Q('北半球で低気圧のまわりの風向は？',['時計回りに吹き出す','反時計回りに吹き込む','時計回りに吹き込む','反時計回りに吹き出す'],1,'低気圧では反時計回りに吹き込む。'),Q('日本付近の天気が変わる方向として多いのは？',['東から西','西から東','南から北','北から南'],1,'西から東へ変わる。')]},
  {id:'motion', grade:3, field:'物理', icon:'🏃', title:'運動とエネルギー', desc:'速さ、力、仕事、エネルギー', boards:[
    B('速さ', `<h3>速さ</h3>${F('速さ＝移動した距離÷時間')} ${step('道のりを時間で割る。単位はm/sやkm/h。')} `),
    B('グラフ', `<h3>グラフの見方</h3><p>縦軸・横軸の意味をまず確認する。変化の割合や面積を使う問題もある。</p>`),
    B('力の合成', `<h3>力の合成と分解</h3><p>同じ向きなら足し算、反対向きなら引き算。斜めなら平行四辺形。</p>${I(svg.force)}`),
    B('仕事', `<h3>仕事</h3>${F('仕事[J]＝力[N]×力の向きに動いた距離[m]')} ${warn('支えるだけで動かないとき、仕事は0。')}`),
    B('エネルギー', `<h3>エネルギー</h3><p><span class="must">位置エネルギー</span>と<span class="must">運動エネルギー</span>は互いに移り変わる。</p>`),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>速さ計算</li><li>合力</li><li>仕事</li><li>エネルギー変換</li></ul>`)], questions:[Q('30mを6秒で進んだときの速さは？',['4m/s','5m/s','6m/s','180m/s'],1,'30÷6=5m/s。'),Q('仕事の単位は？',['N','W','J','Pa'],2,'仕事の単位はJ。'),Q('同じ向きの2Nと3Nの力の合力は？',['1N','5N','6N','-1N'],1,'足して5N。'),Q('高いところにある物体がもつエネルギーは？',['熱エネルギー','運動エネルギー','位置エネルギー','電気エネルギー'],2,'高さによるのは位置エネルギー。')]},
  {id:'ion', grade:3, field:'化学', icon:'🧲', title:'イオンと電池', desc:'イオン、酸・アルカリ、中和、電池', boards:[
    B('イオン', `<h3>イオン</h3><p>電気を帯びた粒子が<span class="must">イオン</span>。陽イオンは＋、陰イオンは−。</p>`),
    B('酸・アルカリ', `<h3>酸とアルカリ</h3><p>酸性水溶液には<span class="must">水素イオン(H⁺)</span>、アルカリ性水溶液には<span class="must">水酸化物イオン(OH⁻)</span>。</p>`),
    B('中和', `<h3>中和</h3>${F('H⁺ + OH⁻ → H₂O')}<p>中和では水ができ、塩も生じる。</p>`),
    B('電池', `<h3>電池</h3><p>電池は<span class="must">化学エネルギー→電気エネルギー</span>へ変える。</p>`),
    B('電気分解', `<h3>電気分解</h3><p>電気エネルギーを使って化学変化を起こす。電極の変化も重要。</p>`),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>BTB・リトマス紙</li><li>イオンの移動</li><li>中和</li><li>電池と電気分解</li></ul>`)], questions:[Q('塩酸にふくまれる陽イオンは？',['ナトリウムイオン','水素イオン','銅イオン','アンモニウムイオン'],1,'塩酸には水素イオン。'),Q('中和でできる主なものは？',['酸素','塩素','水','二酸化炭素'],2,'水素イオンと水酸化物イオンが結びついて水になる。'),Q('化学エネルギーを電気エネルギーに変えるものは？',['モーター','電池','電気分解','発熱体'],1,'電池。'),Q('アルカリ性を示すイオンは？',['H⁺','OH⁻','Na⁺','Cl⁻'],1,'OH⁻。')]},
  {id:'cell', grade:3, field:'生物', icon:'🧬', title:'生物の成長と遺伝', desc:'細胞分裂、生殖、遺伝', boards:[
    B('細胞分裂', `<h3>体細胞分裂</h3><p>成長や傷の修復に関わる。分裂後の細胞は<span class="must">同じ数の染色体</span>をもつ。</p>`),
    B('有性生殖と無性生殖', `<h3>生殖</h3><p><span class="must">有性生殖</span>は両親の形質が組み合わさる。<span class="must">無性生殖</span>は親とほぼ同じ形質。</p>`),
    B('遺伝子', `<h3>遺伝のもと</h3><p>形質を決めるもとを<span class="must">遺伝子</span>という。</p>`),
    B('遺伝の表', `<h3>組み合わせ</h3>${I(svg.heredity)}<p>メンデルの法則では表を作って考えると整理しやすい。</p>`),
    B('用語の注意', `<h3>優性・劣性</h3><p>「現れやすい・現れにくい」の意味で、性質の優劣ではない。</p>${warn('優れている・劣っている、ではない。')}`),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>体細胞分裂</li><li>有性・無性生殖</li><li>遺伝の組み合わせ</li></ul>`)], questions:[Q('体細胞分裂の結果として正しいものは？',['染色体数が半分になる','同じ数の染色体をもつ細胞ができる','必ず受精が必要','親と全く別の形質になる'],1,'同じ数の染色体をもつ細胞ができる。'),Q('有性生殖の特徴は？',['親と全く同じ','親の形質が組み合わさる','受精しない','1個体だけで必ず行う'],1,'両親の形質が組み合わさる。'),Q('形質を決めるもととなるものは？',['細胞膜','葉緑体','遺伝子','液胞'],2,'遺伝子。'),Q('優性・劣性の説明として正しいものは？',['優れている・劣っているの意味','現れやすさの違い','親の強さ','体の大きさ'],1,'現れやすさの違い。')]},
  {id:'space', grade:3, field:'地学', icon:'🌍', title:'地球と宇宙', desc:'自転、公転、月、太陽系', boards:[
    B('地球の自転', `<h3>自転</h3><p>地球は1日で1回自転する。昼夜の変化の原因。</p>`),
    B('地球の公転', `<h3>公転</h3><p>地球は1年で1回公転する。地軸の傾きとあわせて季節が変わる。</p>`),
    B('月の満ち欠け', `<h3>月</h3>${I(svg.moon)}<p>太陽・地球・月の位置関係で月の見え方が変わる。</p>`),
    B('日食・月食', `<h3>食</h3><p><span class="must">日食</span>は月が太陽をかくす。<span class="must">月食</span>は地球の影が月をかくす。</p>`),
    B('太陽系', `<h3>惑星と恒星</h3><p><span class="must">太陽</span>は恒星。惑星は太陽のまわりを回る。</p>${mem('「自分で光る＝恒星」')} `),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>昼夜の理由</li><li>季節の理由</li><li>月の満ち欠け</li><li>天体の位置</li></ul>`)], questions:[Q('昼夜が起こる主な原因は？',['地球の公転','地球の自転','月の公転','太陽の自転'],1,'昼夜は地球の自転で起こる。'),Q('月食とはどんな現象？',['月が太陽をかくす','地球の影が月に映る','雲が月をかくす','太陽が月に映る'],1,'月食は地球の影が月に映る。'),Q('太陽のように自ら光る星を何という？',['衛星','惑星','恒星','小惑星'],2,'自ら光る星は恒星。'),Q('季節の変化に関係するのは主にどれ？',['地球の自転のみ','地球の公転と地軸の傾き','月の満ち欠け','火山活動'],1,'公転と地軸の傾き。')]},
  {id:'ecosystem', grade:3, field:'生物', icon:'🌎', title:'自然と人間', desc:'生態系、食物連鎖、環境保全', boards:[
    B('生態系', `<h3>生態系</h3><p>生物どうしと環境のつながりをまとめて<span class="must">生態系</span>という。</p>`),
    B('生産者・消費者・分解者', `<h3>役割</h3>${tags('<span class="must">生産者</span>：植物','<span class="must">消費者</span>：動物 / <span class="must">分解者</span>：菌類や細菌類')} ${mem('生→消→分の流れ')} `),
    B('食物連鎖', `<h3>食う・食われる</h3><p>生物どうしは食物連鎖でつながる。矢印は「食べられる側→食べる側」。</p>`),
    B('物質の循環', `<h3>循環</h3><p>死がいや排出物は分解者により無機物となり、再び植物に利用される。</p>`),
    B('環境保全', `<h3>人間との関わり</h3><p>森林伐採や外来生物は生態系に影響する。持続可能な利用が大切。</p>`),
    B('入試ポイント', `<h3>入試頻出</h3><ul><li>生産者・消費者・分解者</li><li>食物連鎖の矢印</li><li>環境保全</li></ul>`)], questions:[Q('食物連鎖で生産者にあたるのは？',['ライオン','植物','菌類','人間'],1,'植物は生産者。'),Q('死がいや排出物を分解する生物は？',['消費者','生産者','分解者','捕食者'],2,'菌類や細菌類などの分解者。'),Q('生態系を守るために大切な考え方は？',['短期間で使い切る','持続可能な利用','外来生物を増やす','森林をなくす'],1,'持続可能な利用。'),Q('植物が無機物から有機物をつくるはたらきは？',['呼吸','分解','光合成','発酵'],2,'光合成。')]}
];

const PREF_ANALYSIS = [
  {name:'東京都', level:'やや高め', tags:['計算','考察','記述'], body:'資料読解・実験考察・作図や短い記述がバランスよく出る。単純暗記だけでは点が伸びにくい。', points:['電流・イオン・天気・地震などでグラフや表の読み取りが多い','実験の目的・結果・考察のつながりを説明する力が必要','用語暗記に加え、理由を1〜2文で説明する練習が有効']},
  {name:'神奈川県', level:'標準〜やや高め', tags:['資料読解','思考力'], body:'会話文や複数資料を組み合わせて判断する出題が多い。基本知識を使って考えさせる問題が中心。', points:['生物・地学の資料読解を落とさないことが重要','会話文の条件を読み落とさず、必要な情報を整理する力が必要','計算は難問よりも基本式を正確に使えることが大切']},
  {name:'埼玉県', level:'標準', tags:['基本〜応用','分野横断'], body:'基本問題から応用問題まで幅広く、全分野をまんべんなく学んでおく必要がある。', points:['教科書レベルの基本用語・作図・計算を確実にする','後半で差がつくので、実験考察やグラフ読解も練習する','苦手分野を放置せず、4分野を均等に仕上げる']},
  {name:'千葉県', level:'標準', tags:['基礎重視','計算'], body:'基本知識の確認に加え、典型計算問題が安定して出る。取りやすい問題を確実に取ることが大切。', points:['密度・電流・仕事などの計算で失点しない','用語・法則を正確に書けるようにする','天気や地震の基本グラフも頻出']},
  {name:'大阪府', level:'標準〜やや高め', tags:['資料読解','記述'], body:'複数の資料を見て考える問題や、実験結果から説明させる問題が多い。', points:['会話文・図・表をまとめて読む練習が有効','記述では理由・条件・結果をつなげて書く','イオン、電流、生態系など近年扱いやすい分野を強化']}
];
const SCHOOL_ANALYSIS = [
  {name:'難関公立タイプ', body:'学校選択問題や自校作成に近い難しめの問題を想定。情報量の多い資料読解や、実験条件を比較させる記述がポイント。', tips:['語句暗記だけでなく、理由説明と作図が必要','物理・化学の計算は途中式も意識','生物・地学も考察問題まで仕上げる']},
  {name:'標準公立タイプ', body:'教科書の基本知識＋典型問題をしっかり取れるかが重要。計算や資料問題も基本の組み合わせが中心。', tips:['単元ごとの基本事項を取りこぼさない','よく出る公式や用語は即答できるようにする','演習量を増やしてミスを減らす']},
  {name:'記述多めタイプ', body:'結果だけでなく「なぜそうなるか」を説明する問題が多い。因果関係を短く正確に書く練習が必要。', tips:['「〜なので、〜になる」型で説明練習','実験の目的・結果・考察をセットで整理','キーワードを書き落とさない']},
  {name:'計算多めタイプ', body:'密度、電流、仕事、中和など、式を使う典型問題で差がつくタイプ。', tips:['単位を必ずそろえる','式を立ててから代入する習慣をつける','途中式を簡潔に書く']}
];
const SUMMARY_SETS = [
  {id:'grade1', title:'中1まとめ', type:'grade', target:1, icon:'①', desc:'中1範囲の総まとめ'},
  {id:'grade2', title:'中2まとめ', type:'grade', target:2, icon:'②', desc:'中2範囲の総まとめ'},
  {id:'grade3', title:'中3まとめ', type:'grade', target:3, icon:'③', desc:'中3範囲の総まとめ'},
  {id:'phy', title:'物理まとめ', type:'field', target:'物理', icon:'⚙️', desc:'光・電流・運動など'},
  {id:'chemF', title:'化学まとめ', type:'field', target:'化学', icon:'🧪', desc:'物質・化学変化・イオン'},
  {id:'bio', title:'生物まとめ', type:'field', target:'生物', icon:'🌱', desc:'植物・動物・遺伝・生態系'},
  {id:'earthF', title:'地学まとめ', type:'field', target:'地学', icon:'🌍', desc:'地震・天気・宇宙'}
];
