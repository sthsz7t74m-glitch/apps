const EXTRA_LESSONS={
light:[
{title:'絶対暗記・光と音',content:`<h3>ここは必ず覚える</h3><div class="keylist"><div><span class="must">入射角＝反射角</span>（法線から測る）</div><div><span class="must">実像</span>はスクリーンに映る／<span class="must">虚像</span>は映らない</div><div>音の<span class="law">高さ＝振動数</span>、音の<span class="law">大きさ＝振幅</span></div><div>力の三要素＝<span class="must">作用点・向き・大きさ</span></div></div><div class="memory"><b>覚え方：</b>「高さは回数、大きさは幅」。</div>`},
{title:'光・音・力のひっかけ',content:`<div class="warning"><b>注意：</b>入射角は鏡との角度ではなく法線との角度。</div><div class="warning"><b>注意：</b>空気→ガラスは法線側、ガラス→空気は法線から離れる。</div><div class="checklist"><b>確認：</b><br>□ 凸レンズの作図<br>□ 波形の高さと大きさ<br>□ ばねの比例グラフ</div>`}],
matter:[
{title:'絶対暗記・物質',content:`<div class="keylist"><div><span class="law">密度＝質量÷体積</span></div><div><span class="must">酸素</span>：燃焼を助ける</div><div><span class="must">二酸化炭素</span>：石灰水を白くにごらせる</div><div><span class="must">水素</span>：火を近づけると音を立てて燃える</div><div>状態変化では<span class="must">質量は変わらない</span></div></div><div class="memory"><b>覚え方：</b>「溶けない水上、軽い上、重い下」。</div>`},
{title:'物質の計算・注意',content:`<div class="warning"><b>単位：</b>1mL＝1cm³。単位をそろえて計算。</div><div class="warning"><b>区別：</b>氷→水は状態変化、鉄がさびるのは化学変化。</div><div class="checklist"><b>確認：</b><br>□ メスシリンダーを真横から読む<br>□ 加熱曲線の水平部分<br>□ 純物質と混合物</div>`}],
plants:[
{title:'絶対暗記・植物',content:`<div class="keylist"><div><span class="must">胚珠→種子、子房→果実</span></div><div>光合成＝<span class="must">葉緑体</span></div><div>呼吸＝<span class="must">昼夜行う</span></div><div>双子葉類＝<span class="must">網状脈・主根と側根・維管束が輪状</span></div><div>単子葉類＝<span class="must">平行脈・ひげ根・維管束が散在</span></div></div><div class="memory"><b>覚え方：</b>「双子は網・主・輪、単子は平・ひげ・散」。</div>`},
{title:'植物実験の解き方',content:`<p>調べたい条件以外を同じにするのが<span class="must">対照実験</span>。</p><div class="warning"><b>注意：</b>熱湯は細胞を壊す、エタノールは葉の緑色を抜く。</div><div class="checklist"><b>記述型：</b>「○○以外の条件を同じにして、○○の有無による違いを調べるため。」</div>`}],
earth1:[
{title:'絶対暗記・大地',content:`<div class="keylist"><div><span class="must">P波＝速い・初期微動</span></div><div><span class="must">S波＝遅い・主要動</span></div><div><span class="must">示準化石＝年代</span></div><div><span class="must">示相化石＝環境</span></div><div>火山岩＝<span class="must">斑状組織</span>／深成岩＝<span class="must">等粒状組織</span></div></div><div class="memory"><b>覚え方：</b>PはPrompt、SはSlow。</div>`},
{title:'地震・地層の解法',content:`<div class="law">初期微動継続時間＝S波到着−P波到着</div><p>柱状図は凝灰岩などの<span class="must">鍵層</span>を横につなぐ。</p><div class="warning"><b>注意：</b>通常は下ほど古いが、断層・褶曲・逆転がある図では慎重に。</div>`}],
electric:[
{title:'絶対暗記・電流',content:`<div class="keylist"><div><span class="law">V＝IR</span></div><div><span class="law">電力P＝VI</span></div><div><span class="law">電力量＝電力×時間</span></div><div>直列＝<span class="must">電流が等しい</span></div><div>並列＝<span class="must">電圧が等しい</span></div></div><div class="memory"><b>覚え方：</b>オームの三角形。上にV、下にIとR。</div>`},
{title:'回路計算の手順',content:`<div class="checklist"><b>手順：</b><br>① 直列か並列か<br>② 共通する量<br>③ V＝IR<br>④ 単位確認</div><div class="warning"><b>注意：</b>1000mA＝1A。</div>`}],
chem:[
{title:'絶対暗記・化学変化',content:`<div class="keylist"><div><span class="must">原子の種類と数は保存</span></div><div>酸素と結びつく＝<span class="must">酸化</span></div><div>酸素を失う＝<span class="must">還元</span></div><div>密閉容器では<span class="must">全体の質量は保存</span></div></div><div class="memory"><b>覚え方：</b>「酸化は酸素を足す、還元は酸素を返す」。</div>`},
{title:'反応式の作り方',content:`<div class="checklist"><b>手順：</b><br>① 化学式で書く<br>② 左右の原子数を数える<br>③ 前の係数でそろえる<br>④ 右下の数字は変えない</div><div class="warning"><b>禁止：</b>化学式そのものを変えて合わせない。</div>`}],
biology2:[
{title:'絶対暗記・動物',content:`<div class="keylist"><div>でんぷん→<span class="must">ブドウ糖</span></div><div>タンパク質→<span class="must">アミノ酸</span></div><div>脂肪→<span class="must">脂肪酸とモノグリセリド</span></div><div>吸収＝<span class="must">小腸</span></div><div>尿＝<span class="must">腎臓</span></div></div><div class="memory"><b>覚え方：</b>「でんブ、タンアミ、脂肪は脂モノ」。</div>`},
{title:'循環と反射',content:`<div class="keylist"><div>動脈＝心臓から<span class="must">出る</span></div><div>静脈＝心臓へ<span class="must">戻る</span></div><div>反射の中枢＝主に<span class="must">せきずい</span></div></div><div class="warning"><b>注意：</b>動脈＝酸素が多い、ではない。肺動脈は例外。</div>`}],
weather:[
{title:'絶対暗記・天気',content:`<div class="keylist"><div>温暖前線＝<span class="must">広い・弱い・長い</span></div><div>寒冷前線＝<span class="must">狭い・強い・短い</span></div><div>低気圧＝<span class="must">反時計回りに吹き込む</span></div><div>日本の天気＝<span class="must">西から東</span></div></div><div class="memory"><b>覚え方：</b>「温暖はのんびり、寒冷は急に激しく」。</div>`},
{title:'湿度・雲の解法',content:`<div class="law">湿度＝実際の水蒸気量÷飽和水蒸気量×100</div><p>上昇→膨張→温度低下→露点→凝結→雲。</p><div class="memory"><b>覚え方：</b>「上がる・広がる・冷える・雲」。</div><div class="warning"><b>注意：</b>気温が下がると飽和水蒸気量は小さくなる。</div>`}],
motion:[
{title:'絶対暗記・運動',content:`<div class="keylist"><div><span class="law">速さ＝距離÷時間</span></div><div><span class="law">仕事＝力×距離</span></div><div><span class="law">仕事率＝仕事÷時間</span></div><div>つり合い＝<span class="must">一直線上・反対向き・同じ大きさ</span></div></div><div class="memory"><b>覚え方：</b>動かなければ仕事は0J。</div>`},
{title:'エネルギーの注意',content:`<p>位置エネルギーは高さ・質量、運動エネルギーは速さ・質量が大きいほど増える。</p><div class="warning"><b>注意：</b>力を加えても移動しなければ仕事は0J。</div>`}],
ion:[
{title:'絶対暗記・イオン',content:`<div class="keylist"><div>電子を失う→<span class="must">陽イオン</span></div><div>電子を受け取る→<span class="must">陰イオン</span></div><div>酸性＝<span class="must">H⁺</span></div><div>アルカリ性＝<span class="must">OH⁻</span></div><div><span class="law">H⁺＋OH⁻→H₂O</span></div></div><div class="memory"><b>覚え方：</b>電子はマイナス。失うとプラス、受け取るとマイナス。</div>`},
{title:'電池と中和の注意',content:`<div class="warning"><b>注意：</b>電子は負極→正極、電流はその逆。</div><div class="warning"><b>注意：</b>中和しても量がつり合わなければ中性とは限らない。</div>`}],
cell:[
{title:'絶対暗記・遺伝',content:`<div class="keylist"><div>体細胞分裂＝<span class="must">染色体数は同じ</span></div><div>生殖細胞＝<span class="must">染色体数が半分</span></div><div>形質を決める＝<span class="must">遺伝子</span></div><div>優性・劣性＝<span class="must">現れやすさ</span></div></div><div class="memory"><b>覚え方：</b>「体はそのまま、生殖は半分、受精で戻る」。</div>`},
{title:'遺伝問題の手順',content:`<div class="checklist"><b>手順：</b><br>① 親の遺伝子型<br>② 生殖細胞<br>③ 組み合わせ表<br>④ 遺伝子型と形質を分けて数える</div>`}],
space:[
{title:'絶対暗記・天体',content:`<div class="keylist"><div>昼夜＝<span class="must">自転</span></div><div>季節＝<span class="must">公転＋地軸の傾き</span></div><div>日周運動＝東から西</div><div>恒星＝<span class="must">自ら光る星</span></div></div><div class="memory"><b>覚え方：</b>「自転は1日、公転は1年」。</div>`},
{title:'月の見え方',content:`<p>太陽・地球・月の位置関係を必ず図にする。</p><div class="warning"><b>注意：</b>月は自ら光らず、太陽光を反射して見える。</div><div class="checklist"><b>確認：</b><br>□ 日食と月食<br>□ 月の方角と時刻<br>□ 満ち欠け</div>`}],
ecosystem:[
{title:'絶対暗記・生態系',content:`<div class="keylist"><div>植物＝<span class="must">生産者</span></div><div>動物＝<span class="must">消費者</span></div><div>菌類・細菌類＝<span class="must">分解者</span></div><div>有機物を<span class="must">無機物</span>に戻す</div></div><div class="memory"><b>覚え方：</b>「植物がつくる、動物が食べる、菌が戻す」。</div>`},
{title:'環境問題の考え方',content:`<p>1種の増減が食物網全体へ影響する。個別暗記ではなく関係で考える。</p><div class="warning"><b>記述：</b>何を食べる生物・何に食べられる生物へ影響するかを書く。</div>`}]
};
UNITS.forEach(unit=>unit.boards.push(...(EXTRA_LESSONS[unit.id]||[])));
