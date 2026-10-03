import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { assert, issue } from './store.mjs';
import { feishuURL } from './lark.mjs';

// Reads only visible DOM. No cookies, private endpoints or page application state.
export function readNativeIcon() {
  const h = document.querySelector('h1.page-block-content');
  if (!h) return { ready:false, url:location.href };
  const title = h.querySelector('.zone-container')?.textContent.replace(/[\u200b-\u200f\ufeff]/g, '').trim();
  const icon = h.querySelector('.custom-icon');
  const emoji = icon?.querySelector('.gpf-biz-suite-custom-icon__icon-emoji')?.textContent.trim();
  const add = h.closest('.page-block-header')?.querySelector('.doc-custom-icon-entry');
  return { ready:!!title && !!(icon || add), url:location.href, title, icon:icon ? (emoji || 'custom:non-emoji') : null, editable:!!h.querySelector('[contenteditable=true]') };
}

// Coordinates are computed from one current, visible element, including Shadow DOM.
export function iconControl(kind, desired) {
  const visible = e => { const r=e.getBoundingClientRect(), s=getComputedStyle(e); return r.width>0 && r.height>0 && r.right>0 && r.bottom>0 && r.left<innerWidth && r.top<innerHeight && s.visibility!=='hidden' && s.display!=='none'; };
  const h=document.querySelector('h1.page-block-content');
  const hosts=[...document.querySelectorAll('em-emoji-picker')];
  let elements=[];
  if(kind==='entry') elements=[...(h?.querySelectorAll('.custom-icon') || [])];
  if(kind==='entry' && !elements.length) elements=[...(h?.closest('.page-block-header')?.querySelectorAll('.doc-custom-icon-entry') || [])];
  if(kind==='search') elements=hosts.flatMap(h=>[...(h.shadowRoot?.querySelectorAll('input[type=search]') || [])]);
  if(kind==='choice') elements=hosts.flatMap(h=>[...(h.shadowRoot?.querySelectorAll('button[aria-label]') || [])]).filter(e=>e.getAttribute('aria-label')===desired);
  elements=elements.filter(visible);
  if(elements.length!==1)return { count:elements.length };
  const e=elements[0],r=e.getBoundingClientRect();
  return {count:1,x:r.left+r.width/2,y:r.top+r.height/2,label:e.getAttribute('aria-label'),value:e.value,focused:e.getRootNode().activeElement===e};
}

export async function resolveOpenCliPage() {
  const roots=[];
  if(process.env.ELX_OPENCLI_PACKAGE) { assert(path.isAbsolute(process.env.ELX_OPENCLI_PACKAGE),'BROWSER_CONFIG','ELX_OPENCLI_PACKAGE 必须是包目录绝对路径');roots.push(process.env.ELX_OPENCLI_PACKAGE); }
  else {
    try { const entry=createRequire(import.meta.url).resolve('@jackwener/opencli');roots.push(path.resolve(path.dirname(entry),'../..')); } catch {}
    roots.push(path.join(os.homedir(),'.opencli/node_modules/@jackwener/opencli'));
    if(process.env.APPDATA)roots.push(path.join(process.env.APPDATA,'npm/node_modules/@jackwener/opencli'));
    roots.push('/usr/local/lib/node_modules/@jackwener/opencli','/usr/lib/node_modules/@jackwener/opencli');
  }
  for(const root of roots) {
    try {
      const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
      if(pkg.name!=='@jackwener/opencli' || typeof pkg.exports?.['./browser/page']!=='string')continue;
      const module=await import(pathToFileURL(path.resolve(root,pkg.exports['./browser/page'])).href);
      if(typeof module.Page==='function')return {Page:module.Page,version:pkg.version};
    } catch(e) { if(process.env.ELX_OPENCLI_PACKAGE)throw issue('BROWSER_CONFIG','指定的 OpenCLI 包无法加载'); }
  }
  throw issue('BROWSER_MISSING','未找到已安装 OpenCLI；先安装并连接浏览器扩展，或用 ELX_OPENCLI_PACKAGE 指定包目录');
}

export class OpenCliIconBrowser {
  constructor(page, version='unknown') { this.page=page;this.version=version; }
  async poll(fn, phase = 'page') {
    for(let i=0;i<60;i++){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,200));}
    throw issue('ICON_UI_UNSUPPORTED','未找到唯一可见的图标控件；页面结构、登录或加载状态需要检查',{phase});
  }
  async read(target) {
    const result=await this.poll(async()=>{const r=await this.page.evaluate(readNativeIcon);return r.ready?r:null;});
    const url=feishuURL(result.url),expected=feishuURL(target.url);
    assert(url.kind===expected.kind && url.token===expected.token && result.title===target.title,'ICON_TARGET','浏览器落点或标题与计划不符');
    return {...result,documentId:target.documentId,backend:'opencli',backendVersion:this.version};
  }
  async inspect(target) {
    await this.page.goto(target.url,{settleMs:2000});
    let last,stable=0;
    return this.poll(async()=>{const r=await this.read(target),key=JSON.stringify([r.title,r.icon]);stable=key===last?stable+1:0;last=key;return stable>=3?r:null;},'reload-observation');
  }
  async point(kind,icon) {
    let previous;
    return this.poll(async()=>{const p=await this.page.evaluate(iconControl,kind,icon);const stable=p.count===1 && previous?.count===1 && Math.abs(p.x-previous.x)<.5 && Math.abs(p.y-previous.y)<.5;previous=p;return stable?p:null;},kind);
  }
  async set(target,icon,searchText) {
    const before=await this.read(target);assert(before.editable,'ICON_PERMISSION','网页无编辑能力');
    assert(before.icon===target.expectedIcon,'ICON_CHANGED','操作前图标已变化，保留用户修改');
    if(before.icon===null) await this.page.hover('h1.page-block-content');
    const entry=await this.point('entry');await this.page.nativeClick(entry.x,entry.y);
    const input=await this.point('search');await this.page.nativeClick(input.x,input.y);
    await this.poll(async()=>{const p=await this.page.evaluate(iconControl,'search');return p.count===1 && p.focused?p:null;},'input-focus');
    await this.page.nativeKeyPress('a',['Control']);await this.page.nativeType(searchText || icon);
    await this.poll(async()=>{const p=await this.page.evaluate(iconControl,'search');return p.count===1 && p.value===(searchText||icon)?p:null;},'input-value');
    const choice=await this.point('choice',icon);assert(choice.label===icon,'ICON_CHOICE','候选图标不一致');await this.page.nativeClick(choice.x,choice.y);
    let stableSince=0;
    await this.poll(async()=>{const r=await this.page.evaluate(readNativeIcon);if(!r.ready || r.icon!==icon){stableSince=0;return null;}stableSince ||= Date.now();return Date.now()-stableSince>=2000?r:null;},'icon-save');
    await this.page.nativeKeyPress('Escape');
  }
  async close(){await this.page.closeWindow();}
}

export async function createIconBrowser() {
  const {Page,version}=await resolveOpenCliPage();
  const page=new Page('magic-study-icons-'+randomUUID(),120,undefined,'foreground');
  return new OpenCliIconBrowser(page,version);
}
