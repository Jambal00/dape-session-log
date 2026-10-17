/* Worked examples for pay.js. Every expected figure is worked out by hand in the comment beside it.
   Run with: node tests/pay.test.js   (must print "All pay checks passed" before a push to main) */
var assert=require('assert');
var P=require('../pay.js');

// Sample agencies. D works like the agency with the office rule and a mid-year mileage rate change.
var D={id:'D',name:'Designs',rate:60,paysTravel:true,travelOwn:false,reimburseMiles:true,mileFrom:'office',
  mileRates:[{from:'',rate:0.67},{from:'2026-07-01',rate:0.70}],taxMiles:true};
var N={id:'N',name:'Northstar',rate:62,paysTravel:true,travelOwn:true,travelRate:45,reimburseMiles:true,mileFrom:'home',
  mileRates:[{from:'',rate:0.70}],taxMiles:true};
var Pr={id:'P',name:'Prairie',rate:58,paysTravel:false,reimburseMiles:false,taxMiles:false};
var OLD={id:'O',name:'Older agency',rate:62,mileRate:0.7}; // saved before these settings existed
var ag={D:D,N:N,P:Pr,O:OLD};

var n=0;
function check(name,fn){fn();n++;console.log('ok  '+name)}
function day(date,studentMin,legs){return P.dayPay({date:date,agencies:ag,studentMin:studentMin,legs:legs})}

// Route used in several checks: home -> Designs school A (27.4 mi driven, 37 min; office to A is 12.0 mi) -> Designs school B (8.5 mi, 15 min).
var routeD=[{from:'home',to:'A',agencyId:'D',miles:27.4,min:37,officeMiles:12.0},{from:'A',to:'B',agencyId:'D',miles:8.5,min:15}];

check('Rate lookup picks the rate in effect on the date, including both sides of the change',function(){
  assert.strictEqual(P.mileRateOn(D,'2026-01-01').rate,0.67);
  assert.strictEqual(P.mileRateOn(D,'2026-06-30').rate,0.67);
  assert.strictEqual(P.mileRateOn(D,'2026-07-01').rate,0.70);
  assert.strictEqual(P.mileRateOn(D,'2026-12-31').rate,0.70);
  assert.strictEqual(P.mileRateOn({mileRates:[{from:'2026-07-01',rate:0.7}]},'2026-03-01'),null); // no rate before the first start date
  assert.strictEqual(P.mileRateOn(OLD,'2026-03-01').rate,0.7); // single old-style rate applies to every date
});

check('Office rule, second half of the year (10/19)',function(){
  var r=day('2026-10-19',{D:120},routeD).byAgency.D;
  // students 120 min x $60/hr = $120.00
  // travel 37+15 = 52 min, paid at base rate: 52/60 x 60 = $52.00 (actual drive time, not office time)
  // paid miles: office->A 12.0 + A->B 8.5 = 20.5 mi; 20.5 x $0.70 = $14.35
  // total $186.35; miles driven 27.4+8.5 = 35.9; tax miles = paid miles = 20.5
  assert.strictEqual(r.pay.students,120);assert.strictEqual(r.pay.travel,52);assert.strictEqual(r.pay.mileage,14.35);assert.strictEqual(r.pay.total,186.35);
  assert.strictEqual(r.miles,35.9);assert.strictEqual(r.paidMiles,20.5);assert.strictEqual(r.taxMiles,20.5);assert.strictEqual(r.travelMin,52);
  assert.ok(r.officeUsed);assert.deepStrictEqual(r.missing,[]);
});

check('Same route in the first half of the year (3/16) uses the earlier rate',function(){
  var r=day('2026-03-16',{D:120},routeD).byAgency.D;
  // 20.5 mi x $0.67 = $13.735, rounds to $13.74; total 120 + 52 + 13.74 = $185.74
  assert.strictEqual(r.pay.mileage,13.74);assert.strictEqual(r.pay.total,185.74);
});

check('Last day before and first day after the rate change',function(){
  // 20.5 x 0.67 = 13.735 -> $13.74 on 6/30; 20.5 x 0.70 = $14.35 on 7/1
  assert.strictEqual(day('2026-06-30',{},routeD).byAgency.D.pay.mileage,13.74);
  assert.strictEqual(day('2026-07-01',{},routeD).byAgency.D.pay.mileage,14.35);
});

check('Mixed day: Designs school after another agency uses actual school-to-school miles',function(){
  var legs=[{from:'home',to:'NS',agencyId:'N',miles:18.2,min:26},{from:'NS',to:'A',agencyId:'D',miles:12.4,min:19,officeMiles:12.0}];
  var r=day('2026-10-19',{N:80,D:30},legs);
  // Northstar: students 80/60 x 62 = 82.666 -> $82.67; travel 26/60 x $45 = $19.50; miles 18.2 x 0.70 = $12.74; total $114.91
  var x=r.byAgency.N;assert.strictEqual(x.pay.students,82.67);assert.strictEqual(x.pay.travel,19.5);assert.strictEqual(x.pay.mileage,12.74);assert.strictEqual(x.pay.total,114.91);
  // Designs: not the first stop after home, so actual 12.4 mi (office 12.0 is ignored); students 30/60 x 60 = $30.00; travel 19/60 x 60 = $19.00; miles 12.4 x 0.70 = $8.68; total $57.68
  var y=r.byAgency.D;assert.strictEqual(y.paidMiles,12.4);assert.strictEqual(y.pay.students,30);assert.strictEqual(y.pay.travel,19);assert.strictEqual(y.pay.mileage,8.68);assert.strictEqual(y.pay.total,57.68);
  assert.ok(!y.officeUsed);
  // day: $114.91 + $57.68 = $172.59; miles driven 30.6; tax miles 18.2 + 12.4 = 30.6
  assert.strictEqual(r.totals.pay,172.59);assert.strictEqual(r.totals.miles,30.6);assert.strictEqual(r.totals.taxMiles,30.6);
});

check('Office distance not entered yet: mileage is left out and flagged, nothing else changes',function(){
  var r=day('2026-10-19',{D:120},[{from:'home',to:'A',agencyId:'D',miles:27.4,min:37},{from:'A',to:'B',agencyId:'D',miles:8.5,min:15}]).byAgency.D;
  // only A->B 8.5 mi is paid: 8.5 x 0.70 = $5.95; total 120 + 52 + 5.95 = $177.95
  assert.deepStrictEqual(r.missing,['office distance']);assert.strictEqual(r.paidMiles,8.5);assert.strictEqual(r.pay.mileage,5.95);assert.strictEqual(r.pay.total,177.95);
});

check('Agency that pays neither travel nor mileage and is not tracked for taxes',function(){
  var r=day('2026-10-19',{P:60},[{from:'home',to:'PS',agencyId:'P',miles:20,min:30}]).byAgency.P;
  // students 60/60 x 58 = $58.00; travel and miles unpaid; miles driven 20, tax miles 0
  assert.strictEqual(r.pay.total,58);assert.strictEqual(r.pay.travel,0);assert.strictEqual(r.pay.mileage,0);
  assert.strictEqual(r.miles,20);assert.strictEqual(r.taxMiles,0);assert.deepStrictEqual(r.unpaid,['travel time','miles']);
});

check('Agency saved before these settings keeps the old behavior',function(){
  var r=day('2026-10-19',{O:45},[{from:'home',to:'OS',agencyId:'O',miles:10,min:20}]).byAgency.O;
  // students 45/60 x 62 = $46.50; travel at base 20/60 x 62 = 20.666 -> $20.67; miles from home 10 x 0.70 = $7.00; total $74.17; tax miles 10
  assert.strictEqual(r.pay.students,46.5);assert.strictEqual(r.pay.travel,20.67);assert.strictEqual(r.pay.mileage,7);assert.strictEqual(r.pay.total,74.17);assert.strictEqual(r.taxMiles,10);
});

check('No mileage rate in effect yet on that date is flagged, not guessed',function(){
  var late={id:'L',rate:60,reimburseMiles:true,mileRates:[{from:'2026-07-01',rate:0.7}]};
  var r=P.dayPay({date:'2026-03-02',agencies:{L:late},studentMin:{L:60},legs:[{from:'home',to:'LS',agencyId:'L',miles:10,min:15}]}).byAgency.L;
  // students $60.00; travel 15/60 x 60 = $15.00; mileage none; total $75.00
  assert.strictEqual(r.pay.mileage,0);assert.strictEqual(r.pay.total,75);assert.deepStrictEqual(r.missing,['mileage rate for this date']);
});

check('Exact minutes, not rounded hours (the 80-minute case that used to pay $82.46)',function(){
  // 80/60 x 62 = 82.6667 -> $82.67 (rounding hours to 1.33 first gave $82.46)
  assert.strictEqual(day('2026-10-19',{N:80},[]).byAgency.N.pay.students,82.67);
});

check('On-site agency: paid from arrive to leave instead of session minutes; travel uses its own settings',function(){
  var OS={id:'S',name:'Prairie on site',rate:58,paysTravel:true,travelOwn:true,travelRate:40,reimburseMiles:false,taxMiles:true,payClock:'onsite'};
  // Arrived 10:55, left 12:27: 92 min on site. Sessions only added up to 75 min.
  // time 92/60 x 58 = 88.9333 -> $88.93; travel 19/60 x 40 = 12.6667 -> $12.67; miles not paid; total $101.60
  var r=P.dayPay({date:'2026-10-26',agencies:{S:OS},studentMin:{S:75},onSiteMin:{S:92},legs:[{from:'A',to:'B',agencyId:'S',miles:12.4,min:19}]}).byAgency.S;
  assert.strictEqual(r.clock,'onsite');assert.strictEqual(r.sessionMin,75);assert.strictEqual(r.studentMin,92);
  assert.strictEqual(r.pay.students,88.93);assert.strictEqual(r.pay.travel,12.67);assert.strictEqual(r.pay.mileage,0);assert.strictEqual(r.pay.total,101.6);
  assert.strictEqual(r.taxMiles,12.4);
});

check('On-site and per-session agencies on the same day are each paid their own way',function(){
  var OS={id:'S',rate:58,paysTravel:false,reimburseMiles:false,payClock:'onsite'};
  // N per session: 82 min x 62 = 84.7333 -> $84.73. S on site: 120 min x 58 = $116.00, travel not paid.
  var R=P.dayPay({date:'2026-10-26',agencies:{N:N,S:OS},studentMin:{N:82,S:70},onSiteMin:{S:120},legs:[]});
  assert.strictEqual(R.byAgency.N.pay.students,84.73);assert.strictEqual(R.byAgency.N.clock,'session');
  assert.strictEqual(R.byAgency.S.pay.students,116);assert.strictEqual(R.totals.studentMin,202);assert.strictEqual(R.totals.pay,200.73);
});

check('On-site agency with no arrive and leave times falls back to session minutes and says so',function(){
  var OS={id:'S',rate:58,paysTravel:false,reimburseMiles:false,payClock:'onsite'};
  // 45/60 x 58 = $43.50
  var r=P.dayPay({date:'2026-10-26',agencies:{S:OS},studentMin:{S:45},legs:[]}).byAgency.S;
  assert.strictEqual(r.pay.students,43.5);assert.deepStrictEqual(r.missing,['arrive and leave times (paid on session minutes)']);
});

console.log('\nAll pay checks passed ('+n+')');
