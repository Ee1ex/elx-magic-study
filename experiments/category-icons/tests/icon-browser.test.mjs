import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { iconControl } from '../skills/elx-magic-study/scripts/icon-browser.mjs';

test('原生图标选择器的 Shadow DOM 宿主无布局框时，仍能定位可见输入框', () => {
  const input={value:'',getAttribute(){return null;},getRootNode(){return {activeElement:input};},getBoundingClientRect(){return {x:100,y:100,left:100,top:100,right:300,bottom:125,width:200,height:25};}};
  const host={getBoundingClientRect(){return {left:0,top:0,right:0,bottom:0,width:0,height:0};},shadowRoot:{querySelectorAll(){return [input];}}};
  const context={document:{querySelector(){return null;},querySelectorAll(){return [host];}},innerWidth:1000,innerHeight:700,getComputedStyle(){return {visibility:'visible',display:'block'};}};
  const result=vm.runInNewContext('('+iconControl.toString()+')("search")',context);
  assert.equal(result.count,1);assert.equal(result.x,200);assert.equal(result.y,112.5);
});
