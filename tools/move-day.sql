-- DAPE Session Log: move one school's entries from one date to another.
-- For when the day was logged on the wrong date (2026-11-01: Midway logged on 9/14, should be 9/15).
--
-- Run in the Supabase SQL Editor, in two steps:
--   1. Set the four values in the "settings" block of BOTH steps (they must match).
--   2. Run STEP 1 on its own. It only reads. Check the list: these are the rows that will move.
--      If any line says CLASH, that student already has a session on the new date; sort that out first.
--   3. Run STEP 2 on its own. It moves everything in one go, and changes nothing if anything is wrong.
--   4. Trisha reloads the app.
--
-- What moves, for students at the matching school(s) only:
--   - each session (results, minutes, notes), renamed to the new date
--   - meetings and indirect time at that school or for those students
--   - that school's arrive/leave times, line-up order and planned arrival from the day,
--     plus any pins, "not today" marks and one-day additions for those students
-- Other schools' entries on the same date are left alone.

-- ======================= STEP 1: preview (reads only) =======================
with settings as (
  select 'TRISHA_EMAIL_HERE'::text as who,     -- the email Trisha signs in with
         '%midway%'::text          as school,  -- school name or nickname to match
         '2026-09-14'::text        as from_date,
         '2026-09-15'::text        as to_date
),
u as (select users.id as uid from auth.users, settings where lower(users.email) = lower(settings.who)),
sc as (select d.id from public.dape_docs d, u, settings
       where d.user_id = u.uid and d.coll = 'schools'
         and (d.data->>'name' ilike settings.school or d.data->>'alias' ilike settings.school)),
st as (select d.id, d.data->>'name' as name from public.dape_docs d, u
       where d.user_id = u.uid and d.coll = 'students' and d.data->>'schoolId' in (select id from sc))
select 'school' as what, d.id, coalesce(d.data->>'alias', d.data->>'name') as detail
  from public.dape_docs d, u where d.user_id = u.uid and d.coll = 'schools' and d.id in (select id from sc)
union all
select case when exists (select 1 from public.dape_docs x, settings
                         where x.user_id = u.uid and x.coll = 'sessions'
                           and x.id = (d.data->>'studentId') || '_' || settings.to_date)
            then 'CLASH session' else 'session' end,
       d.id, st.name || ' · ' || coalesce(d.data->>'min', '0') || ' min' || case when (d.data->>'absent')::boolean then ' · absent' else '' end
  from public.dape_docs d, u, settings, st
 where d.user_id = u.uid and d.coll = 'sessions' and d.data->>'date' = settings.from_date and d.data->>'studentId' = st.id
union all
select 'meeting/indirect', d.id, coalesce(d.data->>'min', '0') || ' min · ' || coalesce(d.data->>'note', '')
  from public.dape_docs d, u, settings
 where d.user_id = u.uid and d.coll = 'indirect' and d.data->>'date' = settings.from_date
   and (d.data->>'schoolId' in (select id from sc) or d.data->>'studentId' in (select id from st))
union all
select 'day', d.id, 'school times, order and line-up bits for the matching school move to the new date'
  from public.dape_docs d, u, settings
 where d.user_id = u.uid and d.coll = 'days' and d.id = settings.from_date
order by 1, 2;


-- ======================= STEP 2: move (run after checking step 1) =======================
do $$
declare
  -- settings: keep these the same as step 1
  v_email  text := 'TRISHA_EMAIL_HERE';
  v_school text := '%midway%';
  v_from   text := '2026-09-14';
  v_to     text := '2026-09-15';

  v_uid uuid; v_sc text[]; v_st text[]; n_sess int; n_ind int; n_clash int;
  d_from jsonb; d_to jsonb; k text; f text;
begin
  select id into v_uid from auth.users where lower(email) = lower(v_email);
  if v_uid is null then raise exception 'No account with the email %', v_email; end if;

  select array_agg(id) into v_sc from public.dape_docs
   where user_id = v_uid and coll = 'schools' and (data->>'name' ilike v_school or data->>'alias' ilike v_school);
  if v_sc is null then raise exception 'No school matches %', v_school; end if;
  select coalesce(array_agg(id), '{}') into v_st from public.dape_docs
   where user_id = v_uid and coll = 'students' and data->>'schoolId' = any(v_sc);

  -- stop if any of these students already has a session on the new date
  select count(*) into n_clash from public.dape_docs a
   where a.user_id = v_uid and a.coll = 'sessions' and a.data->>'date' = v_from and a.data->>'studentId' = any(v_st)
     and exists (select 1 from public.dape_docs b where b.user_id = v_uid and b.coll = 'sessions'
                  and b.id = (a.data->>'studentId') || '_' || v_to);
  if n_clash > 0 then raise exception '% student(s) already have a session on %. Nothing was changed.', n_clash, v_to; end if;

  -- sessions: new row under the new date, then remove the old one
  insert into public.dape_docs (user_id, coll, id, data, updated_at)
  select user_id, coll, (data->>'studentId') || '_' || v_to, jsonb_set(data, '{date}', to_jsonb(v_to)), now()
    from public.dape_docs
   where user_id = v_uid and coll = 'sessions' and data->>'date' = v_from and data->>'studentId' = any(v_st);
  get diagnostics n_sess = row_count;
  delete from public.dape_docs
   where user_id = v_uid and coll = 'sessions' and data->>'date' = v_from and data->>'studentId' = any(v_st);

  -- meetings and indirect time keep their id; only the date changes
  update public.dape_docs set data = jsonb_set(data, '{date}', to_jsonb(v_to)), updated_at = now()
   where user_id = v_uid and coll = 'indirect' and data->>'date' = v_from
     and (data->>'schoolId' = any(v_sc) or data->>'studentId' = any(v_st));
  get diagnostics n_ind = row_count;

  -- the day: move this school's pieces; keep anything already set on the new date
  select data into d_from from public.dape_docs where user_id = v_uid and coll = 'days' and id = v_from;
  if d_from is not null then
    select coalesce((select data from public.dape_docs where user_id = v_uid and coll = 'days' and id = v_to), '{}'::jsonb) into d_to;
    foreach f in array array['at', 'arrive', 'order'] loop          -- keyed by school
      foreach k in array v_sc loop
        if d_from->f ? k then
          if not coalesce(d_to->f ? k, false) then
            d_to := jsonb_set(d_to, array[f], coalesce(d_to->f, '{}'::jsonb) || jsonb_build_object(k, d_from->f->k));
          end if;
          d_from := jsonb_set(d_from, array[f], (d_from->f) - k);
        end if;
      end loop;
    end loop;
    foreach k in array v_st loop                                     -- pins, keyed by student
      if d_from->'pins' ? k then
        if not coalesce(d_to->'pins' ? k, false) then
          d_to := jsonb_set(d_to, '{pins}', coalesce(d_to->'pins', '{}'::jsonb) || jsonb_build_object(k, d_from->'pins'->k));
        end if;
        d_from := jsonb_set(d_from, '{pins}', (d_from->'pins') - k);
      end if;
    end loop;
    if jsonb_typeof(d_from->'skip') = 'array' then                   -- "not today", a list of students
      d_to := jsonb_set(d_to, '{skip}', coalesce(d_to->'skip', '[]'::jsonb) ||
                coalesce((select jsonb_agg(x) from jsonb_array_elements(d_from->'skip') x where x #>> '{}' = any(v_st)
                          and not coalesce(d_to->'skip', '[]'::jsonb) @> jsonb_build_array(x)), '[]'::jsonb));
      d_from := jsonb_set(d_from, '{skip}', coalesce((select jsonb_agg(x) from jsonb_array_elements(d_from->'skip') x where not (x #>> '{}' = any(v_st))), '[]'::jsonb));
    end if;
    if jsonb_typeof(d_from->'adds') = 'array' then                   -- one-day additions, a list of {id, ...}
      d_to := jsonb_set(d_to, '{adds}', coalesce(d_to->'adds', '[]'::jsonb) ||
                coalesce((select jsonb_agg(x) from jsonb_array_elements(d_from->'adds') x where x->>'id' = any(v_st)
                          and not exists (select 1 from jsonb_array_elements(coalesce(d_to->'adds', '[]'::jsonb)) y where y->>'id' = x->>'id')), '[]'::jsonb));
      d_from := jsonb_set(d_from, '{adds}', coalesce((select jsonb_agg(x) from jsonb_array_elements(d_from->'adds') x where not (x->>'id' = any(v_st))), '[]'::jsonb));
    end if;
    update public.dape_docs set data = d_from, updated_at = now() where user_id = v_uid and coll = 'days' and id = v_from;
    insert into public.dape_docs (user_id, coll, id, data, updated_at) values (v_uid, 'days', v_to, d_to, now())
      on conflict (user_id, coll, id) do update set data = excluded.data, updated_at = now();
  end if;

  raise notice 'Moved % session(s) and % meeting/indirect entr(ies) from % to %.', n_sess, n_ind, v_from, v_to;
end $$;
