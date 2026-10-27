/* DAPE Session Log day planning. Plain functions with no page or storage access, so tests/plan.test.js can check them directly.
   Rules (decided with Pete, 2026-10-17):
   - A school day starts at her arrival time. Students follow one after another in the order she sets, with the school's
     "minutes between students" gap after each one. These are estimates, never rules.
   - A pinned student starts at the pinned time no matter what. If the students before run past it, that is a collision,
     and the app offers to move the student who runs over to just after the pin.
   - When there is free time before a pin, the app suggests a later student who fits in it (with the gap before the pin).
   - Students in a group (same group key, back to back) start together.
   - The day is done when the last student ends. Leave time is optional; going past it is reported, not prevented. */
(function(root){
  function toMin(t){if(!t||typeof t!=='string'||t.indexOf(':')<0)return null;var a=t.split(':');return +a[0]*60+ +a[1]}
  function toTime(m){if(m==null)return '';m=Math.round(m);var h=Math.floor(m/60)%24,mm=m%60;return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm}

  /* items: [{id, min, pin:'HH:MM' or '', hint:'HH:MM' or '', grp:'key' or ''}] in her order.
     o: {arrive:'HH:MM' or '', leave:'HH:MM' or '', gap:minutes, items}
     Returns {rows:[{id,start,end,pinned,freeBefore,late}], done, overLeave, issues:[...], fits:[...]} with times as 'HH:MM'.
     With no arrival time, the day starts at the first student's pinned or usual time; with neither, there are no times. */
  function lineUp(o){
    var gap=typeof o.gap==='number'&&o.gap>=0?o.gap:5,items=o.items||[],rows=[],issues=[],cur=toMin(o.arrive);
    if(cur==null&&items.length)cur=toMin(items[0].pin)!=null?toMin(items[0].pin):toMin(items[0].hint);
    if(cur==null)return {rows:items.map(function(it){return{id:it.id,start:'',end:'',pinned:!!it.pin}}),done:'',overLeave:0,issues:[],fits:[],noTimes:true};
    var R=[];
    items.forEach(function(it,i){
      var p=toMin(it.pin),prev=R[R.length-1],row={id:it.id,min:it.min,pinned:p!=null,freeBefore:0,late:0},start;
      if(prev&&it.grp&&items[i-1].grp===it.grp){start=prev.s;row.withPrev=true}
      else if(p!=null){
        if(cur<=p){row.freeBefore=p-cur;start=p}
        else{start=p;row.late=cur-p;issues.push({type:'pin',id:it.id,pin:it.pin,overBy:cur-p,prevId:prev?prev.id:''})}
      } else start=cur;
      row.s=start;row.e=start+(+it.min||0);
      cur=row.withPrev?Math.max(cur,row.e+gap):row.e+gap;
      R.push(row)});
    var done=R.length?Math.max.apply(null,R.map(function(r){return r.e})):null,lv=toMin(o.leave),over=lv!=null&&done!=null&&done>lv?done-lv:0;
    if(over)issues.push({type:'leave',overBy:over});
    rows=R.map(function(r){return{id:r.id,start:toTime(r.s),end:toTime(r.e),pinned:r.pinned,freeBefore:r.freeBefore,late:r.late,withPrev:!!r.withPrev}});
    var res={rows:rows,done:toTime(done),overLeave:over,issues:issues,fits:[]};
    /* Free time before a pin: suggest the longest later, unpinned, ungrouped student who fits with the gap before the pin. */
    R.forEach(function(r,i){if(!r.pinned||r.freeBefore<=0)return;
      var best=null;
      for(var j=i+1;j<items.length;j++){var it=items[j];
        if(it.pin||it.grp)continue;
        if((+it.min||0)+gap<=r.freeBefore&&(!best||(+it.min)>(+best.min)))best=it}
      if(best)res.fits.push({beforeId:r.id,id:best.id,free:r.freeBefore,min:+best.min})});
    return res}

  /* Move one id to sit just before another id (or to the end when beforeId is ''). Returns a new list. */
  function moveBefore(order,id,beforeId){var o=order.filter(function(x){return x!==id}),k=beforeId?o.indexOf(beforeId):-1;
    if(k<0)o.push(id);else o.splice(k,0,id);return o}
  function moveAfter(order,id,afterId){var o=order.filter(function(x){return x!==id}),k=o.indexOf(afterId);
    if(k<0)o.push(id);else o.splice(k+1,0,id);return o}

  /* A one-tap fix for a pin collision: move the nearest unpinned, ungrouped student before the pin to just after it,
     but only when that actually clears this collision. Returns {id, afterId, order} or null. */
  function fixFor(o,issue){
    if(issue.type!=='pin')return null;
    var items=o.items,ids=items.map(function(it){return it.id}),k=ids.indexOf(issue.id),byId={};items.forEach(function(it){byId[it.id]=it});
    for(var j=k-1;j>=0;j--){var it=items[j];if(it.pin||it.grp)continue;
      var order=moveAfter(ids,it.id,issue.id),again=lineUp(Object.assign({},o,{items:order.map(function(x){return byId[x]})}));
      var still=again.issues.some(function(x){return x.type==='pin'&&x.id===issue.id});
      if(!still)return {id:it.id,afterId:issue.id,order:order}}
    return null}

  /* Starting order for a school day: the order she used last time (ids not seen then go after, by their usual time),
     otherwise by pinned or usual time, otherwise as given. */
  function startOrder(items,prev){var idx={};(prev||[]).forEach(function(id,i){idx[id]=i});
    function t(it){var v=toMin(it.pin);if(v==null)v=toMin(it.hint);return v==null?99999:v}
    return items.map(function(it,i){return{it:it,i:i}}).sort(function(a,b){
      var ia=a.it.id in idx?idx[a.it.id]:null,ib=b.it.id in idx?idx[b.it.id]:null;
      if(ia!=null&&ib!=null)return ia-ib;
      if(ia!=null)return -1;if(ib!=null)return 1;
      return t(a.it)-t(b.it)||a.i-b.i}).map(function(x){return x.it})}

  /* Minutes of an entry (start, min) that fall outside her time on site (arrive to leave). Used for indirect time and meetings
     at a school whose agency pays for time on site: minutes inside are already paid, minutes outside are billable.
     With no start time, or no arrive and leave times, all of it counts as outside. */
  function outsideMin(start,min,arrive,leave){var s=toMin(start),a=toMin(arrive),l=toMin(leave);min=+min||0;
    if(s==null||a==null||l==null||l<=a)return min;
    var over=Math.max(0,Math.min(s+min,l)-Math.max(s,a));return min-over}

  /* ---------- schedule patterns ----------
     A schedule line (slot) says which days a student is seen:
       every 1 (or missing): every week on sl.day
       every 2: every other week on sl.day, counting from sl.anchor
       every 'month': on sl.day in certain weeks of the month, sl.weeks = [1,2,3,4] and/or 5 for "last"
       every 'dates': on each date in sl.dates (YYYY-MM-DD), any weekday
     Week of the month: days 1-7 are the 1st, 8-14 the 2nd, and so on; "last" is the final one in the month. */
  function ymd(s){var a=String(s).split('-');return[+a[0],+a[1],+a[2]]}
  function dowOf(s){var a=ymd(s);return new Date(a[0],a[1]-1,a[2]).getDay()}
  function weekNo(s){var a=ymd(s);return Math.floor((Date.UTC(a[0],a[1]-1,a[2])/864e5+4)/7)}
  function daysIn(y,m){return new Date(y,m,0).getDate()}
  function slotMatches(sl,date){if(!sl)return false;
    if(sl.every==='dates')return (sl.dates||[]).indexOf(date)>=0;
    if(sl.day!==dowOf(date))return false;
    if(sl.every===2)return !sl.anchor||(weekNo(date)-weekNo(sl.anchor))%2===0;
    if(sl.every==='month'){var a=ymd(date),n=Math.ceil(a[2]/7),last=a[2]+7>daysIn(a[0],a[1]),w=sl.weeks||[];
      return w.indexOf(n)>=0||(last&&w.indexOf(5)>=0)}
    return true}
  /* The next n dates a slot falls on, starting from (and including) a date. */
  function nextDates(sl,from,n){var out=[],a=ymd(from),d=new Date(a[0],a[1]-1,a[2]),i;
    for(i=0;i<400&&out.length<n;i++){var s=d.getFullYear()+'-'+(d.getMonth()<9?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();
      if(slotMatches(sl,s))out.push(s);d.setDate(d.getDate()+1)}
    return out}

  var API={slotMatches:slotMatches,nextDates:nextDates,outsideMin:outsideMin,toMin:toMin,toTime:toTime,lineUp:lineUp,moveBefore:moveBefore,moveAfter:moveAfter,fixFor:fixFor,startOrder:startOrder};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.DAPE_PLAN=API;
})(this);
