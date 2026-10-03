update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'audio/mp4', 'audio/m4a', 'audio/mpeg'
]
where id = 'entry-media';
