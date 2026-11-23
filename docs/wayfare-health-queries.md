# Wayfare: reading usage counts, crash reports and feedback

Open the Supabase SQL editor for the **wayfare** project and run any of these.

**Are people coming back? (the launch rule: 1 in 4 still active in week 2)**
```sql
select cohort_week, new_devices, active_in_week_2,
       round(100.0 * active_in_week_2 / nullif(new_devices, 0)) as pct_back
from public.app_retention_weekly;
```

**What people do (last 7 days)**
```sql
select name, count(*) as times, count(distinct device_id) as devices
from public.app_events
where kind = 'event' and created_at > now() - interval '7 days'
group by name order by times desc;
```

**Crashes and errors (last 7 days), most common first**
```sql
select name, left(detail, 160) as where_it_failed, app_version, count(*) as times
from public.app_events
where kind = 'error' and created_at > now() - interval '7 days'
group by 1, 2, 3 order by times desc limit 30;
```

**Feedback, newest first**
```sql
select created_at, message, contact, app_version, platform
from public.app_feedback order by created_at desc limit 50;
```
