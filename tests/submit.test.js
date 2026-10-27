/* Worked examples for submit.js. Run with: node tests/submit.test.js (must print "All submit checks passed" before a push to main) */
var assert=require('assert');
var U=require('../submit.js');
var n=0;
function check(name,fn){fn();n++;console.log('ok  '+name)}
var DES={id:'des',submit:{on:true,due:'same',since:'2026-10-01',systems:[{id:'a',name:'Timesheet portal'},{id:'b',name:'Billing notes'}]}};
var RENO={id:'reno',submit:{on:true,due:'same',since:'2026-10-01',systems:[{id:'r',name:'Reno time system'}]}};
function T(map){return function(key,id){return (map[key]||{})[id]||{}}}

check('Setup: off, or no named systems, means nothing is asked',function(){
  assert.strictEqual(U.setup({submit:{on:false,systems:[{id:'a',name:'X'}]}}),null);
  assert.strictEqual(U.setup({submit:{on:true,systems:[{id:'a',name:'  '}]}}),null);
  assert.strictEqual(U.setup({}),null);
  assert.strictEqual(U.setup(DES).systems.length,2);
});

check('Periods: same day reminds the next morning, next day the morning after, weekly the Monday after next',function(){
  // Tue Oct 27 2026.
  assert.deepStrictEqual(U.periodFor('same','2026-10-27'),{key:'2026-10-27',from:'2026-10-27',to:'2026-10-27',remind:'2026-10-28'});
  assert.strictEqual(U.periodFor('next','2026-10-27').remind,'2026-10-29');
  // Week of Mon Oct 26 to Sun Nov 1; due Mon Nov 2; reminder from Tue Nov 3.
  assert.deepStrictEqual(U.periodFor('week','2026-10-27'),{key:'2026-10-26',from:'2026-10-26',to:'2026-11-01',remind:'2026-11-03'});
  // A Sunday belongs to the week that started the Monday before.
  assert.strictEqual(U.monday('2026-11-01'),'2026-10-26');
  assert.strictEqual(U.monday('2026-10-26'),'2026-10-26');
});

check('The mockup day: Designs 1 of 2 on Tue, Reno 0 of 1 on Fri, Reno done on Tue',function(){
  var r=U.owed({agencies:[DES,RENO],today:'2026-10-28',
    worked:{'2026-10-23':['reno'],'2026-10-27':['des','reno']},
    ticks:T({'2026-10-27':{des:{a:'2026-10-27T16:12'},reno:{r:'2026-10-27T16:05'}}})});
  assert.deepStrictEqual(r.map(function(x){return x.key+' '+x.agencyId+' '+x.done+'/'+x.total}),['2026-10-23 reno 0/1','2026-10-27 des 1/2']);
  assert.deepStrictEqual(r[1].missing.map(function(y){return y.id}),['b']);
});

check('Not late yet on the day itself; a day not worked asks nothing',function(){
  var r=U.owed({agencies:[DES,RENO],today:'2026-10-27',worked:{'2026-10-27':['des']},ticks:T({})});
  assert.strictEqual(r.length,0);
  var r2=U.owed({agencies:[DES,RENO],today:'2026-10-30',worked:{'2026-10-27':['des']},ticks:T({})});
  assert.deepStrictEqual(r2.map(function(x){return x.agencyId}),['des']);
});

check('Only the last 14 days, and nothing before she turned it on',function(){
  // Today Oct 28: 14 days back is Oct 14. Oct 13 drops off, Oct 14 stays.
  var r=U.owed({agencies:[DES],today:'2026-10-28',worked:{'2026-10-13':['des'],'2026-10-14':['des']},ticks:T({})});
  assert.deepStrictEqual(r.map(function(x){return x.key}),['2026-10-14']);
  var late={id:'des',submit:Object.assign({},DES.submit,{since:'2026-10-20'})};
  var r2=U.owed({agencies:[late],today:'2026-10-28',worked:{'2026-10-19':['des'],'2026-10-20':['des']},ticks:T({})});
  assert.deepStrictEqual(r2.map(function(x){return x.key}),['2026-10-20']);
});

check('Weekly: one entry for the whole week, kept on its Monday, once the week is late',function(){
  var W={id:'w',submit:{on:true,due:'week',systems:[{id:'s',name:'Weekly sheet'}]}};
  var worked={'2026-10-27':['w'],'2026-10-29':['w']};
  // Mon Nov 2 is the due day: not late yet. Tue Nov 3: late, one entry for the week of Oct 26.
  assert.strictEqual(U.owed({agencies:[W],today:'2026-11-02',worked:worked,ticks:T({})}).length,0);
  var r=U.owed({agencies:[W],today:'2026-11-03',worked:worked,ticks:T({})});
  assert.deepStrictEqual(r.map(function(x){return x.key+' '+x.from+'..'+x.to}),['2026-10-26 2026-10-26..2026-11-01']);
  // Ticked on the Monday: done.
  assert.strictEqual(U.owed({agencies:[W],today:'2026-11-03',worked:worked,ticks:T({'2026-10-26':{w:{s:'x'}}})}).length,0);
});

console.log('\nAll submit checks passed ('+n+')');
