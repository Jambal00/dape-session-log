/* Worked examples for todo.js. Run with: node tests/todo.test.js (must print "All to-do checks passed" before a push to main) */
var assert=require('assert');
var T=require('../todo.js');
var n=0;
function check(name,fn){fn();n++;console.log('ok  '+name)}
var TODAY='2026-11-11'; // a Wednesday
function keys(g){return g.map(function(x){return x.key+':'+x.items.map(function(t){return t.id}).join(',')})}

check('Buckets: overdue, today, the next 6 days, later, no date, done',function(){
  assert.strictEqual(T.bucket({due:'2026-11-09'},TODAY),'overdue');
  assert.strictEqual(T.bucket({due:'2026-11-11'},TODAY),'today');
  assert.strictEqual(T.bucket({due:'2026-11-12'},TODAY),'week');
  assert.strictEqual(T.bucket({due:'2026-11-17'},TODAY),'week');   // today + 6
  assert.strictEqual(T.bucket({due:'2026-11-18'},TODAY),'later');  // today + 7
  assert.strictEqual(T.bucket({due:''},TODAY),'nodate');
  assert.strictEqual(T.bucket({due:'2026-11-09',done:'2026-11-10T10:00'},TODAY),'done');
  assert.strictEqual(T.shift('2026-12-28',7),'2027-01-04');
});

check('Groups come in order, only the ones with items; important first, then due date, then oldest added',function(){
  var list=[
    {id:'a',due:'2026-11-13',created:'2'},{id:'b',due:'2026-11-12',created:'3'},{id:'c',due:'2026-11-13',star:true,created:'4'},
    {id:'d',due:'2026-11-09'},{id:'e',due:'',created:'1'},{id:'f',due:'',created:'0'},
    {id:'g',done:'2026-11-10T08:00'},{id:'h',done:'2026-11-11T08:00'}];
  assert.deepStrictEqual(keys(T.groups(list,{today:TODAY})),['overdue:d','week:c,b,a','nodate:f,e','done:h,g']);
});

check('Category filter and search apply to every group',function(){
  var list=[{id:'a',title:'Call parent',cat:'pc',due:TODAY},{id:'b',title:'Order boards',notes:'scooter',cat:'eq',due:TODAY},{id:'c',title:'Old call',cat:'pc',done:'x'}];
  assert.deepStrictEqual(keys(T.groups(list,{today:TODAY,cat:'pc'})),['today:a','done:c']);
  assert.deepStrictEqual(keys(T.groups(list,{today:TODAY,q:'SCOOTER'})),['today:b']);
  assert.deepStrictEqual(keys(T.groups(list,{today:TODAY,q:'call'})),['today:a','done:c']);
});

check('Home counts: overdue, due today, open',function(){
  var list=[{due:'2026-11-01'},{due:TODAY},{due:TODAY},{due:'2026-11-20'},{due:'',done:'x'}];
  assert.deepStrictEqual(T.counts(list,TODAY),{overdue:1,today:2,open:4});
});

console.log('\nAll to-do checks passed ('+n+')');
