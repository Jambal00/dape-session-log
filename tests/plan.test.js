/* Worked examples for plan.js. Every expected time is worked out by hand in the comment beside it.
   Run with: node tests/plan.test.js   (must print "All plan checks passed" before a push to main) */
var assert=require('assert');
var P=require('../plan.js');
var n=0;
function check(name,fn){fn();n++;console.log('ok  '+name)}
function times(r){return r.rows.map(function(x){return x.id+' '+x.start+'-'+x.end})}

check('Students follow one another from arrival, with the gap after each',function(){
  // arrive 8:30. J.R. 20 min: 8:30-8:50. +5 gap -> T.K. 30 min: 8:55-9:25. +5 -> D.S. 25 min: 9:30-9:55. Done 9:55.
  var r=P.lineUp({arrive:'08:30',gap:5,items:[{id:'JR',min:20},{id:'TK',min:30},{id:'DS',min:25}]});
  assert.deepStrictEqual(times(r),['JR 08:30-08:50','TK 08:55-09:25','DS 09:30-09:55']);
  assert.strictEqual(r.done,'09:55');assert.strictEqual(r.issues.length,0);
});

check('A pin holds its time and the free time before it is reported',function(){
  // arrive 8:30. J.R. 8:30-8:50, ready at 8:55. B.L. pinned 9:30: free 35 min (8:55 to 9:30), B.L. 9:30-10:00.
  // T.K. after: 10:05-10:35.
  var r=P.lineUp({arrive:'08:30',gap:5,items:[{id:'JR',min:20},{id:'BL',min:30,pin:'09:30'},{id:'TK',min:30}]});
  assert.deepStrictEqual(times(r),['JR 08:30-08:50','BL 09:30-10:00','TK 10:05-10:35']);
  assert.strictEqual(r.rows[1].freeBefore,35);
  // T.K. needs 30 min + 5 gap = 35, which fits the 35 free exactly.
  assert.deepStrictEqual(r.fits,[{beforeId:'BL',id:'TK',free:35,min:30}]);
});

check('Taking the suggestion fills the free time and the day ends earlier',function(){
  // J.R. 8:30-8:50, T.K. 8:55-9:25, ready 9:30, B.L. pinned 9:30-10:00. Done 10:00, usual leave 10:00: fits.
  var r=P.lineUp({arrive:'08:30',leave:'10:00',gap:5,items:[{id:'JR',min:20},{id:'TK',min:30},{id:'BL',min:30,pin:'09:30'}]});
  assert.deepStrictEqual(times(r),['JR 08:30-08:50','TK 08:55-09:25','BL 09:30-10:00']);
  assert.strictEqual(r.done,'10:00');assert.strictEqual(r.overLeave,0);assert.strictEqual(r.issues.length,0);
  assert.strictEqual(r.fits.length,0); // 0 min free before the pin
});

check('A student too long for the free time is not suggested; the longest one that fits is',function(){
  // arrive 9:00, pin at 9:30: 30 min free. A (30 min) needs 35, too long. B (20) needs 25, C (25) needs 30: C is longest that fits.
  var r=P.lineUp({arrive:'09:00',gap:5,items:[{id:'PIN',min:20,pin:'09:30'},{id:'A',min:30},{id:'B',min:20},{id:'C',min:25}]});
  assert.strictEqual(r.rows[0].freeBefore,30);
  assert.deepStrictEqual(r.fits,[{beforeId:'PIN',id:'C',free:30,min:25}]);
});

check('Running into a pin is a collision; the pin still starts on time',function(){
  // arrive 8:30. J.R. 8:30-8:50, T.K. 8:55-9:25, D.S. 9:30-9:55, ready 10:00. B.L. pinned 9:30: 30 min late. B.L. 9:30-10:00.
  var r=P.lineUp({arrive:'08:30',gap:5,items:[{id:'JR',min:20},{id:'TK',min:30},{id:'DS',min:25},{id:'BL',min:30,pin:'09:30'}]});
  assert.strictEqual(r.rows[3].start,'09:30');
  assert.deepStrictEqual(r.issues,[{type:'pin',id:'BL',pin:'09:30',overBy:30,prevId:'DS'}]);
});

check('The one-tap fix moves the nearest student before the pin to after it, only if that clears it',function(){
  // Same day. Moving D.S. after B.L.: J.R. 8:30-8:50, T.K. 8:55-9:25, ready 9:30, B.L. 9:30-10:00, D.S. 10:05-10:30. Clear.
  var o={arrive:'08:30',gap:5,items:[{id:'JR',min:20},{id:'TK',min:30},{id:'DS',min:25},{id:'BL',min:30,pin:'09:30'}]};
  var f=P.fixFor(o,P.lineUp(o).issues[0]);
  assert.deepStrictEqual(f,{id:'DS',afterId:'BL',order:['JR','TK','BL','DS']});
  // Two students who together run 50 min past the pin: moving only the nearest (25 min) leaves it late, so try the next one back.
  // arrive 8:30: A 40 (8:30-9:10), B 25 (9:15-9:40), ready 9:45, pin 9:00 -> 45 late. Move B: A ends 9:10, ready 9:15, still late.
  // Move A: B 8:30-8:55, ready 9:00, pin on time. So the fix is A.
  var o2={arrive:'08:30',gap:5,items:[{id:'A',min:40},{id:'B',min:25},{id:'PIN',min:20,pin:'09:00'}]};
  assert.deepStrictEqual(P.fixFor(o2,P.lineUp(o2).issues[0]),{id:'A',afterId:'PIN',order:['B','PIN','A']});
});

check('Going past the usual leave time is reported',function(){
  // arrive 10:30, three students 30+25+25 with 5 min gaps: 10:30-11:00, 11:05-11:30, 11:35-12:00. Leave 11:45: 15 min over.
  var r=P.lineUp({arrive:'10:30',leave:'11:45',gap:5,items:[{id:'A',min:30},{id:'B',min:25},{id:'C',min:25}]});
  assert.strictEqual(r.done,'12:00');assert.strictEqual(r.overLeave,15);
  assert.deepStrictEqual(r.issues,[{type:'leave',overBy:15}]);
});

check('The gap is set per school, and a group starts together',function(){
  // gap 10. A 20: 9:00-9:20. B and C are a group: both 9:30, B 30 min to 10:00, C 20 min to 9:50. Next is after the longer: 10:10.
  var r=P.lineUp({arrive:'09:00',gap:10,items:[{id:'A',min:20},{id:'B',min:30,grp:'g'},{id:'C',min:20,grp:'g'},{id:'D',min:15}]});
  assert.deepStrictEqual(times(r),['A 09:00-09:20','B 09:30-10:00','C 09:30-09:50','D 10:10-10:25']);
});

check('No arrival time: start at the first student\'s usual time; with no times at all there are no estimates',function(){
  var r=P.lineUp({gap:5,items:[{id:'A',min:20,hint:'08:30'},{id:'B',min:20}]});
  assert.deepStrictEqual(times(r),['A 08:30-08:50','B 08:55-09:15']);
  var r2=P.lineUp({gap:5,items:[{id:'A',min:20},{id:'B',min:20}]});
  assert.strictEqual(r2.noTimes,true);assert.strictEqual(r2.rows[0].start,'');
});

check('Starting order: last time\'s order first, newcomers after by usual time; otherwise by pinned or usual time',function(){
  var items=[{id:'A',hint:'09:00'},{id:'B',pin:'08:45'},{id:'C',hint:'08:30'},{id:'D'}];
  assert.deepStrictEqual(P.startOrder(items,null).map(function(x){return x.id}),['C','B','A','D']);
  assert.deepStrictEqual(P.startOrder(items,['A','C']).map(function(x){return x.id}),['A','C','B','D']);
  assert.deepStrictEqual(P.moveBefore(['A','B','C'],'C','A'),['C','A','B']);
  assert.deepStrictEqual(P.moveAfter(['A','B','C'],'A','C'),['B','C','A']);
});

check('Indirect time at an on-site school: only the minutes outside arrive-to-leave are extra',function(){
  // on site 10:55-12:27. A 30-min meeting at 12:15 runs 12:15-12:45: 12 min inside, 18 outside.
  assert.strictEqual(P.outsideMin('12:15',30,'10:55','12:27'),18);
  // fully inside: 11:00-11:20 -> 0 extra. Fully outside (after school, 15:00): all 45.
  assert.strictEqual(P.outsideMin('11:00',20,'10:55','12:27'),0);
  assert.strictEqual(P.outsideMin('15:00',45,'10:55','12:27'),45);
  // starts before arrival: 10:40-11:10, 15 min before 10:55 -> 15 extra.
  assert.strictEqual(P.outsideMin('10:40',30,'10:55','12:27'),15);
  // no start time, or no time on site that day: all of it counts.
  assert.strictEqual(P.outsideMin('',25,'10:55','12:27'),25);
  assert.strictEqual(P.outsideMin('11:00',25,'',''),25);
});

console.log('\nAll plan checks passed ('+n+')');
