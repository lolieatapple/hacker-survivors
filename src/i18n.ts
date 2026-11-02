// Two languages. Copy lives next to where it is used as tx('中文', 'English') pairs.
export type Lang = 'zh' | 'en';
export interface Text { zh: string; en: string }

let lang: Lang = 'zh';
export const getLang = (): Lang => lang;
export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
}
export const tx = (zh: string, en: string): string => (lang === 'zh' ? zh : en);
export const T = (t: Text): string => t[lang];
