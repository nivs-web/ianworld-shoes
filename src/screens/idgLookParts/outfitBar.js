/**
 * 꾸미기 창 «코디 3칸 · 랜덤코디» 줄 (겜보조 2 · 11/13)
 *  코디 = 지금 입은 모습(드래곤 + 드래곤캐슬)을 1 · 2 · 3 칸에 저장하고 불러온다. 주사위 = 가진 것 중 무작위로 입혀 보기 — 저장은 눌러야 한다.
 *  저장 필드 : outfits ['', '', ''] (글자 한도 80 · catalog.encodeOutfit)
 */
import { el } from '../ui.js';
import { kitBtn } from '../idgKit.js';

/**
 * @param {{outfits:()=>string[], onSave:(i:number)=>void, onLoad:(i:number)=>void, onDice:()=>void}} o
 * @returns {HTMLElement & {refresh:()=>void, say:(t:string)=>void}}
 */
export function outfitBar(o) {
  let at = 0;
  const msg = el('span.idg-ob-msg', { role: 'status' });
  const slots = [0, 1, 2].map((i) => kitBtn({ kind: 'purple', size: 'sm', text: String(i + 1), cls: 'idg-ob-slot', label: `코디 ${i + 1}`, onClick: () => { at = i; refresh(); } }));
  const save = kitBtn({ kind: 'green', size: 'sm', text: '저장', onClick: () => { o.onSave(at); refresh(); say(`코디 ${at + 1} 에 저장했어요`); } });
  const load = kitBtn({ kind: 'purple', size: 'sm', text: '불러오기', onClick: () => { o.onLoad(at); say(`코디 ${at + 1} 을 입었어요`); } });
  const dice = kitBtn({ kind: 'purple', size: 'sm', text: '랜덤코디', cls: 'idg-ob-dice', onClick: () => o.onDice() });
  const node = el('div.idg-ob', null, [el('b.idg-ob-label', '코디'), el('div.idg-ob-slots', { role: 'radiogroup', 'aria-label': '코디 칸' }, slots), save, load, dice, msg]);
  function say(t) { msg.textContent = t; }
  function refresh() {
    const list = o.outfits();
    slots.forEach((b, i) => { b.classList.toggle('on', i === at); b.classList.toggle('full', !!list[i]); b.setAttribute('aria-checked', String(i === at)); b.title = list[i] ? `코디 ${i + 1} (저장됨)` : `코디 ${i + 1} (비어 있어요)`; });
    load.disabled = !list[at];
  }
  node.refresh = refresh; node.say = say;
  refresh();
  return node;
}
