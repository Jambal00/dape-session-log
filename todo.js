/* DAPE Session Log to-dos: grouping and sorting. Plain functions with no page or storage access, so
   tests/todo.test.js can check them directly.
   Rules (decided with Pete, 2026-11-11):
   - Open to-dos are grouped by due date: Overdue (before today), Today, This week (the next 6 days),
     Later, and No date. Done ones go last, newest first.
   - Within a group: important first, then by due date, then oldest added first.
   - A filter by category, and a search over the title and notes, apply to every group. */
(function(root){
  function p2(n){return (n<10?'0':'')+n}
  function shift(s,n){var a=String(s).split('-'),d=new Date(+a[0],+a[1]-1,+a[2]+n);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
  var ORDER=['overdue','today','week','later','nodate','done'];
  var LABEL={overdue:'Overdue',today:'Today',week:'This week',later:'Later',nodate:'No date',done:'Done'};
  function bucket(t,today){if(t.done)return 'done';var d=t.due||'';if(!d)return 'nodate';
    if(d<today)return 'overdue';if(d===today)return 'today';if(d<=shift(today,6))return 'week';return 'later'}
  function cmp(a,b){
    if(!!a.star!==!!b.star)return a.star?-1:1;
    var da=a.due||'9999',db=b.due||'9999';if(da!==db)return da<db?-1:1;
    var ca=a.created||'',cb=b.created||'';return ca<cb?-1:ca>cb?1:0}
  function matches(t,o){
    if(o.cat&&t.cat!==o.cat)return false;
    var q=String(o.q||'').trim().toLowerCase();
    if(q&&(String(t.title||'')+' '+String(t.notes||'')).toLowerCase().indexOf(q)<0)return false;
    return true}
  /* o: {today, cat, q}. Returns [{key, label, items}] for the groups that have something, in order. */
  function groups(list,o){var by={};
    (list||[]).forEach(function(t){if(!matches(t,o))return;var k=bucket(t,o.today);(by[k]=by[k]||[]).push(t)});
    return ORDER.filter(function(k){return by[k]}).map(function(k){
      var items=by[k].slice().sort(k==='done'?function(a,b){return String(b.done)<String(a.done)?-1:String(b.done)>String(a.done)?1:0}:cmp);
      return{key:k,label:LABEL[k],items:items}})}
  /* For Home: how many are overdue, due today, and open in all. */
  function counts(list,today){var c={overdue:0,today:0,open:0};
    (list||[]).forEach(function(t){if(t.done)return;c.open++;var k=bucket(t,today);if(k==='overdue')c.overdue++;else if(k==='today')c.today++});
    return c}
  var API={bucket:bucket,groups:groups,counts:counts,shift:shift};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.DAPE_TODO=API;
})(this);
