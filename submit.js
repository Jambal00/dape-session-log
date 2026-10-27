/* DAPE Session Log: submitting hours to each agency. Plain functions with no page or storage access, so
   tests/submit.test.js can check them directly.
   Rules (decided with Pete, 2026-10-27):
   - An agency can list the systems she enters her time into (Designs has two, Reno has one). Each worked day
     gets one checkbox per system.
   - Due: 'same' (the day she worked), 'next' (the day after), or 'week' (one set of checkboxes for the whole
     Monday-to-Sunday week, due the following Monday).
   - A reminder shows from the morning after it was due, until every box is ticked.
   - Only days she worked for that agency count, only from the day she turned this on, and only for the last
     14 days (weekly: weeks that ended in the last 14 days). */
(function(root){
  function p2(n){return (n<10?'0':'')+n}
  function ymd(s){var a=String(s).split('-');return[+a[0],+a[1],+a[2]]}
  function shift(s,n){var a=ymd(s),d=new Date(a[0],a[1]-1,a[2]+n);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
  function dow(s){var a=ymd(s);return new Date(a[0],a[1]-1,a[2]).getDay()}
  /* Monday of the week a date is in (weeks run Monday to Sunday). */
  function monday(s){return shift(s,-((dow(s)+6)%7))}

  /* The agency's settings, cleaned up: null when it does not use submitting. */
  function setup(a){var x=a&&a.submit;if(!x||!x.on)return null;
    var sys=(x.systems||[]).filter(function(y){return y&&String(y.name||'').trim()});
    if(!sys.length)return null;
    return{due:x.due==='next'||x.due==='week'?x.due:'same',systems:sys,since:x.since||''}}

  /* The period a worked date belongs to: its key (where the ticks are kept), the dates it covers, and the
     first day the reminder shows (the day after it was due). */
  function periodFor(due,date){
    if(due==='week'){var m=monday(date);return{key:m,from:m,to:shift(m,6),remind:shift(m,8)}}
    return{key:date,from:date,to:date,remind:shift(date,due==='next'?2:1)}}

  /* How far along a period is. ticks: {systemId: ISO time}. */
  function progress(st,ticks){ticks=ticks||{};var done=st.systems.filter(function(y){return ticks[y.id]}).length;
    return{done:done,total:st.systems.length,complete:done===st.systems.length,missing:st.systems.filter(function(y){return !ticks[y.id]})}}

  /* Everything left to submit that should be nagged about today.
     o: {agencies:[...], worked:{date:[agencyId,...]}, ticks:function(key,agencyId)->{sysId:iso}, today, lookback (days, default 14)}
     Returns [{agencyId, key, from, to, due, done, total, missing:[systems]}], oldest first. */
  function owed(o){var lb=o.lookback==null?14:o.lookback,t=o.today,start=shift(t,-lb),seen={},out=[];
    var ags={};(o.agencies||[]).forEach(function(a){var st=setup(a);if(st)ags[a.id]={a:a,st:st}});
    Object.keys(o.worked||{}).sort().forEach(function(date){
      (o.worked[date]||[]).forEach(function(id){var g=ags[id];if(!g)return;
        if(g.st.since&&date<g.st.since)return;
        var p=periodFor(g.st.due,date);
        if(p.to<start)return;            /* too long ago */
        if(t<p.remind)return;            /* not late yet */
        var k=id+'|'+p.key;if(seen[k])return;seen[k]=1;
        var pr=progress(g.st,o.ticks(p.key,id));if(pr.complete)return;
        out.push({agencyId:id,key:p.key,from:p.from,to:p.to,due:g.st.due,done:pr.done,total:pr.total,missing:pr.missing})})});
    return out.sort(function(x,y){return x.key<y.key?-1:x.key>y.key?1:x.agencyId<y.agencyId?-1:1})}

  var API={setup:setup,periodFor:periodFor,progress:progress,owed:owed,monday:monday};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.DAPE_SUBMIT=API;
})(this);
