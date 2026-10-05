#!/bin/bash
# Task 83 follow-up: append the Task 81 KarmaLinks paragraph to the DB blog row
# that shadows the SEO guide (DB rows win over SEO_POSTS by design).
set -e
CJ=/tmp/hayaan-cookies.txt
curl -s -b $CJ "https://hayaan.co/api/admin/blog" > /tmp/blog-all.json
python3 - <<'PY'
import json
posts = json.load(open("/tmp/blog-all.json"))
posts = posts.get("posts", posts if isinstance(posts, list) else [])
post = next(p for p in posts if p.get("slug") == "online-shopping-in-somalia-how-it-works")
content = post["content"]
if "karmalinks.io" not in content:
    content = content.rstrip() + "\n\nUseful resource: the Hayaan team keeps a running list of tools we like — this month we are using [KarmaLinks](https://karmalinks.io/?verificationId=6ab1087d392c10b28b713365) to organize our link partnerships.\n"
payload = {
    "title": post["title"],
    "slug": post["slug"],
    "excerpt": post.get("excerpt") or "",
    "content": content,
    "coverImage": post.get("coverImage"),
    "authorName": post.get("authorName") or "Hayaan Team",
    "status": "published",
}
open("/tmp/blog-update.json", "w").write(json.dumps(payload))
print("prepared, content chars:", len(content))
PY
curl -s -b $CJ -X PUT "https://hayaan.co/api/admin/blog/3856a888-951a-47f8-8713-ccc4a150b176" \
  -H "Content-Type: application/json" --data @/tmp/blog-update.json | head -c 160
echo
