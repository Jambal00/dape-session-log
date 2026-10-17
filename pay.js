/* DAPE Session Log pay math. Plain functions with no page or storage access, so tests/pay.test.js can check them directly.
   Rules (decided with Pete, 2026-10-13 and 2026-10-14):
   - A drive is billed to the agency of the school she is driving to. The drive from home to the first school counts; the drive home does not.
   - Time with students is paid at the agency's base rate. Travel time is not paid, paid at the base rate, or paid at the agency's own travel rate.
   - Mileage, when the agency reimburses it, is paid at the rate in effect on the day's date. Rates have start dates.
   - "Mileage starts from the agency office": when a drive from home goes to that agency's school, the paid miles are the office-to-school
     distance instead of the miles driven. Travel time stays the actual drive time. Drives between schools always use actual miles.
   - Tax miles for an agency are the miles it pays on (so the office figure on those drives), when the agency's miles are tracked for taxes.
   - Money is worked out from exact minutes and miles and rounded to the cent once per line.
   Added 2026-10-17:
   - An agency pays for her time either per session (the minutes with each student, direct and indirect) or on site
     (from when she arrives at its schools to when she leaves). On-site time replaces session minutes for that agency only.
     Travel and mileage use the agency's own travel settings either way.
   - When an on-site agency has no arrive and leave times for the day, it is paid on session minutes and the times are reported missing.
   - Indirect time and meetings outside her time on site are billable on top (Pete, 2026-10-17): passed in as addMin per agency.
   - Quarter-hour rounding (Pete, 2026-10-17): for agencies that pay per session, each session's time with the student
     (direct and indirect combined) rounds up to the next 15 minutes. 15 direct + 10 indirect = 25, billed as 30.
     A session already on a quarter hour stays as it is. Sessions are passed in as sessionMin: {agencyId: [minutes or {min, round}, ...]}.
   - The rounding step is set per agency (Pete, 2026-10-17, "to handle variations"; moved from schools to agencies the same day):
     round is 0 (no rounding), 6, 15, 30 or 60 minutes. An agency with no setting uses 15.
   - On-site agencies round too (Pete, 2026-10-17), per school visit, not per session: arrive 1:00, leave 2:17 = 77 minutes,
     billed as 90 at the quarter hour. With two of the agency's schools in one day, each visit is rounded and the rounded
     times are added. onSiteMin can be a list of visit minutes per agency. Meetings outside time on site are added after,
     as logged. The same agency setting (roundTo) controls it.
     On-site agencies are not rounded this way; their session minutes are kept for the record only. */
(function(root){
  function num(v){return typeof v==='number'&&isFinite(v)}
  function cents(x){return Math.round((x+(x>=0?1:-1)*1e-9)*100)/100}

  function paysTravel(a){return !!a&&a.paysTravel!==false}
  function travelRate(a){return !paysTravel(a)?null:a.travelOwn&&num(a.travelRate)?a.travelRate:num(a.rate)?a.rate:null}
  function reimburses(a){return !!a&&a.reimburseMiles!==false}
  function tracksTax(a){return !a||a.taxMiles!==false}
  function officeStart(a){return reimburses(a)&&a.mileFrom==='office'}
  function onSite(a){return !!a&&a.payClock==='onsite'}
  function roundUp(m,step){if(!num(m)||m<=0)return 0;step=num(step)?step:15;return step>0?Math.ceil(m/step-1e-9)*step:m}
  function quarterUp(m){return roundUp(m,15)}

  /* Mileage rates as a list sorted by start date. An empty start date means "from the beginning".
     Agencies saved before dated rates existed have a single mileRate. */
  function mileRates(a){
    if(!a)return[];
    var list=Array.isArray(a.mileRates)&&a.mileRates.length?a.mileRates:num(a.mileRate)?[{from:'',rate:a.mileRate}]:[];
    return list.filter(function(r){return r&&num(r.rate)}).map(function(r){return{from:r.from||'',rate:r.rate}})
      .sort(function(x,y){return x.from<y.from?-1:x.from>y.from?1:0});
  }
  /* The rate in effect on a date (YYYY-MM-DD), or null when no rate applies yet. */
  function mileRateOn(a,date){var r=null;mileRates(a).forEach(function(x){if(x.from<=date)r=x});return r}

  /* Paid miles for one drive. leg: {from, to, miles, officeMiles}. Returns null when the distance it needs is missing. */
  function paidMiles(leg,a){
    if(leg.from==='home'&&officeStart(a))return num(leg.officeMiles)?leg.officeMiles:null;
    return num(leg.miles)?leg.miles:null;
  }

  /* One day's pay, split by agency.
     input: {date, agencies: {id: agency}, studentMin: {agencyId: minutes}, onSiteMin: {agencyId: minutes from arrive to leave},
             legs: [{from, to, agencyId, miles, min, officeMiles}]}
     sessionMin: {agencyId: [combined direct+indirect minutes of each session]}, rounded up per session for per-session agencies.
     addMin: {agencyId: minutes} paid on top, for indirect time and meetings outside time on site.
     For an on-site agency, studentMin in the result is the paid time on site (plus addMin) and sessionMin keeps the session minutes.
     Returns {byAgency: {id: {...}}, totals: {...}}. */
  function dayPay(input){
    var out={},date=input.date;
    function b(k){return out[k]||(out[k]={studentMin:0,travelMin:0,miles:0,paidMiles:0,taxMiles:0,
      pay:{students:0,travel:0,mileage:0,total:0},rates:{base:null,travel:null,mile:null,mileFrom:''},
      missing:[],unpaid:[],officeUsed:false,clock:'session',sessionMin:0})}
    Object.keys(input.studentMin||{}).forEach(function(k){if(num(input.studentMin[k]))b(k).studentMin+=input.studentMin[k]});
    var sm=input.sessionMin||{};
    Object.keys(sm).forEach(function(k){var list=sm[k]||[],x=b(k),a=(input.agencies||{})[k],raw=0,billed=0;
      list.forEach(function(e){var m=typeof e==='object'?e.min:e,st=typeof e==='object'?e.round:15;if(!num(m))return;raw+=m;billed+=onSite(a)?m:roundUp(m,st)});
      x.studentMin+=billed;x.loggedMin=(x.loggedMin||0)+raw;x.roundedUp=(x.roundedUp||0)+(billed-raw)});
    var os=input.onSiteMin||{};
    Object.keys(input.agencies||{}).forEach(function(k){var a=input.agencies[k];if(!onSite(a))return;
      if(!(k in out)&&!num(os[k])&&!Array.isArray(os[k]))return;
      var x=b(k);x.clock='onsite';x.sessionMin=x.studentMin;
      var st=num(a.roundTo)?a.roundTo:15,visits=Array.isArray(os[k])?os[k].filter(num):num(os[k])?[os[k]]:null;
      if(!visits||!visits.length){visits=[x.sessionMin];if(x.sessionMin)x.missing.push('arrive and leave times (paid on session minutes)')}
      var base=0,billed=0;visits.forEach(function(v){base+=v;billed+=roundUp(v,st)});
      x.studentMin=billed;x.onSiteLogged=base;x.roundedUp=(billed-base)||0;x.visits=visits.length});
    var am=input.addMin||{};
    Object.keys(am).forEach(function(k){if(num(am[k])&&am[k]>0){var x=b(k);x.studentMin+=am[k];x.addMin=(x.addMin||0)+am[k]}});
    (input.legs||[]).forEach(function(l){
      var k=l.agencyId||'',x=b(k),a=input.agencies[k];
      if(num(l.min))x.travelMin+=l.min;
      if(num(l.miles))x.miles+=l.miles;
      var pm=paidMiles(l,a);
      if(l.from==='home'&&officeStart(a))x.officeUsed=true;
      if(pm==null){x.missing.push(l.from==='home'&&officeStart(a)?'office distance':'distance')}
      else{x.paidMiles+=pm;if(tracksTax(a))x.taxMiles+=pm}
    });
    var T={studentMin:0,travelMin:0,miles:0,paidMiles:0,taxMiles:0,pay:0};
    Object.keys(out).forEach(function(k){
      var x=out[k],a=input.agencies[k],base=a&&num(a.rate)?a.rate:null,tr=travelRate(a),mr=reimburses(a)?mileRateOn(a,date):null;
      x.paidMiles=Math.round(x.paidMiles*100)/100;x.taxMiles=Math.round(x.taxMiles*100)/100;x.miles=Math.round(x.miles*100)/100;
      x.rates={base:base,travel:tr,mile:mr?mr.rate:null,mileFrom:mr?mr.from:'',office:officeStart(a)};
      if(a){
        if(base!=null)x.pay.students=cents(x.studentMin/60*base);else if(x.studentMin)x.missing.push('base rate');
        if(paysTravel(a)){if(tr!=null)x.pay.travel=cents(x.travelMin/60*tr);else if(x.travelMin)x.missing.push('travel rate')}
        else if(x.travelMin)x.unpaid.push('travel time');
        if(reimburses(a)){if(mr)x.pay.mileage=cents(x.paidMiles*mr.rate);else if(x.paidMiles)x.missing.push('mileage rate for this date')}
        else if(x.miles)x.unpaid.push('miles');
      }
      x.pay.total=cents(x.pay.students+x.pay.travel+x.pay.mileage);
      T.studentMin+=x.studentMin;T.travelMin+=x.travelMin;T.miles+=x.miles;T.paidMiles+=x.paidMiles;T.taxMiles+=x.taxMiles;T.pay+=x.pay.total;
    });
    T.miles=Math.round(T.miles*100)/100;T.paidMiles=Math.round(T.paidMiles*100)/100;T.taxMiles=Math.round(T.taxMiles*100)/100;T.pay=cents(T.pay);
    return{byAgency:out,totals:T};
  }

  var api={cents:cents,paysTravel:paysTravel,travelRate:travelRate,reimburses:reimburses,tracksTax:tracksTax,officeStart:officeStart,onSite:onSite,quarterUp:quarterUp,roundUp:roundUp,
    mileRates:mileRates,mileRateOn:mileRateOn,paidMiles:paidMiles,dayPay:dayPay};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DAPE_PAY=api;
})(this);
