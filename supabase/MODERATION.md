# Wayfare moderation runbook

App Store guideline 1.2 requires acting on reports of objectionable content **within 24 hours**
(remove the content and eject the user who posted it). Wayfare already:

- screens text on device (slurs, payment-scam phrasing) before anything is posted;
- lets travellers **report** posts, comments, messages, tips, board posts, rooms and profiles, and **block** anyone;
- hides posts, comments, messages, tips and board posts automatically after **3 reports** from different travellers.

A person still has to review reports. Run these in the Supabase SQL editor (as `postgres`) at least daily.

## 1. Open reports with the reported content

```sql
select r.created_at, r.target_type, r.reason, r.details, r.target_id,
       rp.username as reporter,
       coalesce(p.body, c.body, m.body, t.body, b.title || ' — ' || coalesce(b.body, ''), pr.bio, cv.title) as content,
       coalesce(p.user_id, c.user_id, m.sender_id, t.user_id, b.user_id, pr.id) as author_id
from public.reports r
join public.profiles rp on rp.id = r.reporter_id
left join public.posts p on r.target_type = 'post' and p.id = r.target_id
left join public.post_comments c on r.target_type = 'comment' and c.id = r.target_id
left join public.messages m on r.target_type = 'message' and m.id = r.target_id
left join public.place_tips t on r.target_type = 'tip' and t.id = r.target_id
left join public.board_posts b on r.target_type = 'board_post' and b.id = r.target_id
left join public.profiles pr on r.target_type = 'profile' and pr.id = r.target_id
left join public.conversations cv on r.target_type = 'conversation' and cv.id = r.target_id
where r.status = 'open'
order by r.created_at;
```

## 2. Remove content

```sql
-- Hide (keeps evidence) …
update public.posts set hidden = true where id = '<post id>';
update public.post_comments set hidden = true where id = '<comment id>';
update public.messages set hidden = true where id = '<message id>';
update public.place_tips set hidden = true where id = '<tip id>';
update public.board_posts set hidden = true where id = '<board post id>';
-- … or delete outright.
delete from public.posts where id = '<post id>';
```

Unhide content that was auto-hidden by mistake with `hidden = false`.

## 3. Eject an abusive user

Deleting the auth user removes the account and everything it created (all tables cascade):

```sql
delete from auth.users where id = '<author id>';
```

(Or Dashboard → Authentication → Users → … → Delete user.) Storage files under `<author id>/` in the
`avatars` and `post-media` buckets can be removed in Dashboard → Storage.

## 4. Close the reports

```sql
update public.reports set status = 'actioned' where target_id = '<target id>';   -- content removed / user ejected
update public.reports set status = 'dismissed' where target_id = '<target id>';  -- no violation
```

## 5. Spot-check activity

```sql
-- Accounts with many reports against their content in the last week.
select coalesce(p.user_id, c.user_id, m.sender_id, b.user_id) as author, count(*) as reports
from public.reports r
left join public.posts p on r.target_type = 'post' and p.id = r.target_id
left join public.post_comments c on r.target_type = 'comment' and c.id = r.target_id
left join public.messages m on r.target_type = 'message' and m.id = r.target_id
left join public.board_posts b on r.target_type = 'board_post' and b.id = r.target_id
where r.created_at > now() - interval '7 days'
group by 1 order by 2 desc limit 20;
```

Contact for escalations and law-enforcement requests: privacy@ariyoo.app.
