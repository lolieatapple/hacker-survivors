// Nickname prompt. A canvas cannot open a phone keyboard, so this is a real <input> laid over it.
// window.prompt is not an option: browsers block it inside cross-origin iframes (the X card).
import { tx } from './i18n';
import { cleanName, NAME_MAX } from './game/economy';

let open = false;
export const nameInputOpen = () => open;

/** Resolves to a valid name, or null if the player skips. */
export function askName(current?: string): Promise<string | null> {
  if (open) throw new Error('[name] prompt already open');
  open = true;
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,3,10,.75);z-index:10;font-family:FP12,monospace';
    box.innerHTML = `
      <form style="background:#0b0a18;border:2px solid #ffd23f;padding:16px;width:min(86vw,340px);color:#f4f4f8;text-align:center">
        <div style="font-size:18px;color:#ffd23f;margin-bottom:6px"></div>
        <div style="font-size:12px;color:#9aa3c7;margin-bottom:12px;font-family:FP8,monospace"></div>
        <input maxlength="${NAME_MAX}" autocomplete="off" autocapitalize="off" spellcheck="false"
          style="width:100%;box-sizing:border-box;font:18px FP12,monospace;padding:8px;background:#110e22;color:#f4f4f8;border:1px solid #3a2e5c;outline:none" />
        <div class="err" style="font-size:12px;color:#ff4545;min-height:16px;margin-top:6px;font-family:FP8,monospace"></div>
        <div style="display:flex;gap:10px;margin-top:6px">
          <button type="button" class="skip" style="flex:1;font:16px FP12,monospace;padding:8px;background:#110e22;color:#9aa3c7;border:1px solid #3a2e5c"></button>
          <button type="submit" style="flex:1;font:16px FP12,monospace;padding:8px;background:#2a1d3f;color:#ffd23f;border:1px solid #ffd23f"></button>
        </div>
      </form>`;
    const form = box.querySelector('form') as HTMLFormElement;
    const [title, sub] = Array.from(form.children).slice(0, 2) as HTMLDivElement[];
    const field = form.querySelector('input') as HTMLInputElement;
    const err = form.querySelector('.err') as HTMLDivElement;
    const skip = form.querySelector('.skip') as HTMLButtonElement;
    const ok = form.querySelector('button[type=submit]') as HTMLButtonElement;
    title.textContent = tx('上排行榜', 'JOIN THE LEADERBOARD');
    sub.textContent = tx(`起个昵称（最多 ${NAME_MAX} 个字）`, `Pick a nickname (up to ${NAME_MAX} characters)`);
    skip.textContent = tx('跳过', 'Skip');
    ok.textContent = tx('确定', 'OK');
    field.value = current ?? '';
    const done = (v: string | null) => { open = false; box.remove(); resolve(v); };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = cleanName(field.value);
      if (name) done(name);
      else err.textContent = tx('只能用文字、数字、空格和 _ . -', 'Letters, digits, spaces and _ . - only');
    });
    skip.addEventListener('click', () => done(null));
    field.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(null); });
    document.body.appendChild(box);
    field.focus();
  });
}
