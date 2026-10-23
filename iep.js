/* DAPE Session Log: reading pasted IEP text. Runs only in her browser; the pasted text is never saved or sent anywhere.
   tests/iep.test.js checks it against sample goal pages.
   - Splits a pasted goal page into the goal number, the annual goal wording, and numbered objectives
     ("Objective 1", "Short-term Objective 2", "Benchmark 3").
   - For each objective, makes a first guess at the short name, unit, target, progression levels and mastery rule.
     Every guess is shown to her to check; anything it can't tell is left blank.
   - Finds names: capitalized words right before "will" or "'s" that aren't the student's initials, so she can swap
     in the initials before anything is kept. */
(function(root){
  function clean(t){return String(t||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n').split('\n').filter(function(l){return !JUNK.test(l.trim())}).join('\n').trim()}
  function oneLine(t){return clean(t).replace(/\n+/g,' ').trim()}
  /* "Objective 1", "Short-term Objective 2", "Benchmark 3" - but not a standards number like "Benchmark 1.3.2.1" */
  var MARK=/(?:short[\s-]*term\s+)?(?:objective|benchmark)\s*#?\s*(\d+)(?![.\d]\d|\d)\s*[:.)\u2013\u2014-]?\s*/gi;
  /* SpEd Forms screen words that come along when a page is copied: buttons and section headings */
  var JUNK=/^(?:ESY|Pick|Measure|Delete|\+\s*Objective|Benchmarks? or short[\s-]term objectives|How will progress toward meeting this annual goal be measured\??)$/i;

  var LABELS=[[/before needing (?:a |any )?(?:verbal |physical )?(?:redirect|prompt|cue)/i,'Reps before redirection'],[/push[\s-]?ups?/i,'Push-ups'],[/plank/i,'Plank hold'],[/on[\s-]task/i,'On-task time'],[/dribbl/i,'Dribbling'],
    [/throw/i,'Throws'],[/catch/i,'Catching'],[/kick/i,'Kicking'],[/balanc/i,'Balance'],[/jump/i,'Jumping'],[/(sit|curl)[\s-]?ups?/i,'Sit-ups'],
    [/\b(lap|run|running)\b/i,'Running'],[/skip/i,'Skipping'],[/hop/i,'Hopping'],[/strik|\bhit/i,'Striking']];
  var UNITS=[[/\b(repetitions?|reps?)\b/i,'reps'],[/\b(seconds?|secs?)\b/i,'sec'],[/\b(minutes?|mins?)\b/i,'min'],[/\b(laps?)\b/i,'laps'],
    [/\b(dribbles)\b/i,'dribbles'],[/\b(feet|ft)\b/i,'ft']];
  var LEVELS=['wall','incline','knee','modified','toe','assisted','independent'];
  var NOTNAMES=/^(The|This|Student|He|She|They|It|Goal|Objective|Benchmark|Measurable|Annual|Teacher|Staff|Adult|Peers?|Short|In|By|When|Given|With|During|Using|After|Before)$/;

  function guessObjective(t){
    var o={label:'',unit:'',target:'',dir:'min',kind:'count',variants:'',mastery:''},i;
    for(i=0;i<LABELS.length;i++)if(LABELS[i][0].test(t)){o.label=LABELS[i][1];break}
    for(i=0;i<UNITS.length;i++)if(UNITS[i][0].test(t)){o.unit=UNITS[i][1];break}
    var ratio=/(\d+)\s*(?:out of|of)\s*(\d+)\s*(?:trials|attempts|tries|throws|kicks|catches|opportunities)\b/i.exec(t);
    if(ratio&&!o.unit){o.kind='ratio';o.unit='of '+ratio[2];o.target=ratio[1]}
    /* target: the first number in front of the unit, unless the goal is an increase "by" an amount */
    if(o.unit&&o.kind==='count'&&!/\bincrease\b[^.]*?\bby\b/i.test(t)){
      var re=new RegExp('(\\d+)(?:\\s*[-\\u2013]\\s*\\d+)?\\s*'+UNITS.filter(function(u){return u[1]===o.unit})[0][0].source,'i'),m=re.exec(t);
      if(m)o.target=m[1];
      if(/\b(no more than|at most|fewer than|less than)\s+\d+\s*(repetitions|reps|seconds|minutes)/i.test(t))o.dir='max'}
    var lv=LEVELS.filter(function(w){return new RegExp('\\b'+w+'\\b','i').test(t)});
    if(lv.length>=2||(lv.length&&/progression/i.test(t)))o.variants=lv.map(function(w){return w[0].toUpperCase()+w.slice(1)}).join(', ');
    /* mastery: how often (in 3 of 4 sessions, 50% of the time), and by when (within 8 weeks, by March 2026) */
    var how=/\b((?:on|in)\s+\d+\s+(?:out of|of)\s+\d+\s+[^.;,]*)/i.exec(t)||/\b(\d+\s*%\s*of\s+(?:the\s+)?(?:time|trials|opportunities|sessions))/i.exec(t);
    var when=/\b(within\s+\d+\s+(?:weeks?|months?|days?))/i.exec(t)||/\b(by\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i.exec(t);
    o.mastery=[how&&how[1].replace(/\s+$/,''),when&&when[1]].filter(Boolean).join(', ');
    return o}

  /* Names in the text that are not the student's initials, with how often each appears. */
  function findNames(text,alias){var seen={},order=[],re=/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?=(?:'|\u2019)s\b|\s+will\b|\s+would\b|\s+can\b)/g,m;
    while((m=re.exec(text))){var n=m[1];var first=n.split(' ')[0];if(NOTNAMES.test(first))continue;if(alias&&n.toLowerCase()===String(alias).toLowerCase())continue;
      if(!seen[n]){seen[n]=1;order.push(n)}}
    /* "Maria" and "Maria Lopez" are the same person: keep the full name */
    order=order.filter(function(n){return n.indexOf(' ')>0||!order.some(function(o){return o!==n&&o.split(' ')[0]===n})});
    /* how often she'll see it: every use of the first name, which also covers the full name */
    return order.map(function(n){var first=n.split(' ')[0];return{name:n,count:(text.match(new RegExp('\\b'+first+'\\b','g'))||[]).length}})}
  /* Swap a name for the initials everywhere: the full name first, then the first name alone. */
  function replaceName(text,name,alias){var esc=function(x){return x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')};
    text=text.replace(new RegExp('\\b'+esc(name)+'\\b','g'),alias);
    var first=name.split(' ')[0];if(first!==name)text=text.replace(new RegExp('\\b'+esc(first)+'\\b','g'),alias);
    return text}

  function parse(text,alias){
    var t=clean(text),marks=[],m;MARK.lastIndex=0;
    while((m=MARK.exec(t)))marks.push({i:m.index,end:MARK.lastIndex,num:m[1]});
    var goalPart=marks.length?t.slice(0,marks[0].i):t,gn=/\bgoal\s*#?\s*(\d+)/i.exec(goalPart);
    var goalText=oneLine(goalPart);
    var lab=/\b(?:measurable\s+)?annual\s+goal\s*(?:#?\s*\d+)?\s*[:.\u2013\u2014-]?\s*/i.exec(goalText);
    if(lab)goalText=goalText.slice(lab.index+lab[0].length);else goalText=goalText.replace(/^goal\s*#?\s*\d+\s*[:.\u2013\u2014-]?\s*/i,'');
    var objs=marks.map(function(k,j){var body=oneLine(t.slice(k.end,j+1<marks.length?marks[j+1].i:t.length));
      return Object.assign({num:k.num,text:body},guessObjective(body))}).filter(function(o){return o.text});
    return{goalNum:gn?gn[1]:'',goalText:goalText.trim(),objectives:objs,names:findNames(t,alias)}}

  var API={parse:parse,findNames:findNames,replaceName:replaceName,guessObjective:guessObjective};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.DAPE_IEP=API;
})(this);
