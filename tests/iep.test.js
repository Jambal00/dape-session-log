/* Checks for iep.js, the pasted-IEP reader. Sample goal pages are made up; the names are made up.
   Run with: node tests/iep.test.js */
var assert=require('assert');
var R=require('../iep.js');
var n=0;function check(name,fn){fn();n++;console.log('ok  '+name)}

var PAGE=['Goal 4',
 'Measurable Annual Goal: In 36 weeks, Jordan will improve upper body strength and endurance to participate in physical education activities as measured by teacher observation and data collection.',
 'Short-term Objective 1: Jordan will complete at least 8-12 repetitions of the current push-up progression (wall, incline, knee) with adult demonstration on 3 out of 4 sessions per month.',
 'Short-term Objective 2: Jordan will increase plank hold time by 5-10 seconds within 8 weeks.',
 "Short-term Objective 3: Jordan will remain on task for at least 8 minutes with no more than 3 prompts in 4 out of 5 opportunities, as recorded on Jordan's data sheet."].join('\n');

check('Splits a goal page into the goal number, goal wording and numbered objectives',function(){
  var p=R.parse(PAGE,'J.R.');
  assert.strictEqual(p.goalNum,'4');
  assert.ok(/^In 36 weeks, Jordan will improve upper body strength/.test(p.goalText));
  assert.deepStrictEqual(p.objectives.map(function(o){return o.num}),['1','2','3']);
  assert.ok(/^Jordan will complete at least 8-12 repetitions/.test(p.objectives[0].text));
  assert.ok(!/Objective 2/.test(p.objectives[0].text)); // stops at the next objective
});

check('First guesses for each objective',function(){
  var o=R.parse(PAGE,'J.R.').objectives;
  // push-ups: reps, target 8 (first number before "repetitions"), levels, mastery rule
  assert.deepStrictEqual([o[0].label,o[0].unit,o[0].target,o[0].variants,o[0].mastery],['Push-ups','reps','8','Wall, Incline, Knee','on 3 out of 4 sessions per month']);
  // plank: an increase "by" an amount, so no fixed target
  assert.deepStrictEqual([o[1].label,o[1].unit,o[1].target,o[1].mastery],['Plank hold','sec','','within 8 weeks']);
  // on task: at least 8 minutes; "no more than 3 prompts" is not about minutes, so direction stays "at least"
  assert.deepStrictEqual([o[2].label,o[2].unit,o[2].target,o[2].dir,o[2].mastery],['On-task time','min','8','min','in 4 out of 5 opportunities']);
});

check('Finds the real name, and swaps it for the initials everywhere',function(){
  var p=R.parse(PAGE,'J.R.');
  assert.deepStrictEqual(p.names,[{name:'Jordan',count:5}]);
  var fixed=R.replaceName(PAGE,'Jordan','J.R.');
  assert.ok(!/Jordan/.test(fixed));assert.ok(/J\.R\. will complete/.test(fixed));assert.ok(/J\.R\.'s data sheet/.test(fixed));
  assert.deepStrictEqual(R.parse(fixed,'J.R.').names,[]);
});

check('A full name is swapped too, first and last',function(){
  var t='Objective 1: Maria Lopez will dribble a ball 10 times. Objective 2: Maria will catch a ball in 4 of 5 trials.';
  var p=R.parse(t,'M.L.');
  assert.deepStrictEqual(p.names,[{name:'Maria Lopez',count:2}]);
  var f=R.replaceName(t,'Maria Lopez','M.L.');assert.ok(!/Maria|Lopez/.test(f));
  // second objective is out of tries: a ratio, target 4 of 5
  var o2=R.parse(f,'M.L.').objectives[1];assert.deepStrictEqual([o2.kind,o2.unit,o2.target,o2.label],['ratio','of 5','4','Catching']);
});

check('Text already using initials has nothing to flag; words like "The student will" are not names',function(){
  var p=R.parse('Goal 2. Annual goal: The student will improve balance. Objective 1: J.R. will balance on one foot for 10 seconds.','J.R.');
  assert.deepStrictEqual(p.names,[]);assert.strictEqual(p.goalNum,'2');assert.strictEqual(p.goalText,'The student will improve balance.');
  assert.deepStrictEqual([p.objectives[0].label,p.objectives[0].unit,p.objectives[0].target],['Balance','sec','10']);
});

check('No objective headings: everything is the goal, nothing is invented',function(){
  var p=R.parse('In 36 weeks the student will improve gross motor skills.','A.B.');
  assert.strictEqual(p.objectives.length,0);assert.strictEqual(p.goalText,'In 36 weeks the student will improve gross motor skills.');
});

console.log('\nAll IEP reader checks passed ('+n+')');
