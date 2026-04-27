# nginx changes required after this batch

After deploying the new SSR routers + player-image self-host, the nginx
config on `72.61.115.5` needs the following blocks added. **Order matters** —
`location ^~` must appear above the `location ~` regex blocks for static assets.

## 1. Static assets — local player photos

```nginx
# Local player photos (download via scripts/download-player-images.js).
# Same pattern as /coach-images and /og/match — must appear BEFORE the
# generic `location ~ \.(jpg|png|webp|...)` regex so it wins precedence.
location ^~ /player-images/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_cache_valid 200 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    add_header X-Player-Image "1";
}
```

## 2. Bot SSR routing for new data-layer routes

The site already has `$is_bot` map + `/ssr-proxy` internal location. We just
need to add `try_files $uri @ssr_or_spa;` (or equivalent) for the new URL
patterns so bot UAs hit the backend SSR while browsers fall through to the
SPA. Pattern matches the existing `/huan-luyen-vien` block.

```nginx
# Standings hub + per-league
location ~ ^/bang-xep-hang(/.*)?$ {
    if ($is_bot = 1) { rewrite ^ /ssr-proxy last; }
    try_files $uri /index.html;
}

# Fixtures + results — both share routing because the SPA component is the
# same per-league dynamic page.
location ~ ^/lich-thi-dau(/.*)?$ {
    if ($is_bot = 1) { rewrite ^ /ssr-proxy last; }
    try_files $uri /index.html;
}
location ~ ^/ket-qua-bong-da(/.*)?$ {
    if ($is_bot = 1) { rewrite ^ /ssr-proxy last; }
    try_files $uri /index.html;
}

# Team pages
location ~ ^/doi-bong(/.*)?$ {
    if ($is_bot = 1) { rewrite ^ /ssr-proxy last; }
    try_files $uri /index.html;
}

# Top scorers
location ~ ^/top-ghi-ban(/.*)?$ {
    if ($is_bot = 1) { rewrite ^ /ssr-proxy last; }
    try_files $uri /index.html;
}

# League hub
location ~ ^/giai-dau(/.*)?$ {
    if ($is_bot = 1) { rewrite ^ /ssr-proxy last; }
    try_files $uri /index.html;
}

# Cross-league stats overview
location = /thong-ke {
    if ($is_bot = 1) { rewrite ^ /ssr-proxy last; }
    try_files $uri /index.html;
}
```

## 3. /cau-thu already wired

`vietnamesePlayers.js` already serves `/cau-thu` and `/cau-thu/:slug` as SSR.
Existing nginx block for `/cau-thu` should already be in place — verify by
hitting with a Googlebot UA:

```bash
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  https://scoreline.io/cau-thu/quang-hai | head -40
```

If the response starts with `<!DOCTYPE html><html lang="vi"><head><title>Nguyễn Quang Hải...`,
SSR is live. If it shows the `<div id="root"></div>` shell, the nginx fork
isn't catching this path and needs the block added.

## 4. After deploying

```bash
# Backend
ssh root@72.61.115.5
cd /opt/football-api-backend
git pull
node scripts/download-player-images.js   # populate /public/player-images
pm2 reload football-api

# nginx
nano /etc/nginx/sites-available/scoreline.io  # paste blocks from sections 1-2
nginx -t && systemctl reload nginx

# Verify SSR each new route (bot UA)
for path in /bang-xep-hang/premier-league /doi-bong/manchester-city \
            /lich-thi-dau/la-liga /ket-qua-bong-da/serie-a \
            /top-ghi-ban/bundesliga /giai-dau/ligue-1 /thong-ke; do
  echo "=== $path ==="
  curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
    "https://scoreline.io$path" | grep -oP '<title>[^<]+</title>' | head -1
done

# Verify browser still gets SPA
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36" \
  https://scoreline.io/bang-xep-hang/premier-league | head -20
```

Browser response must be the SPA shell (`<div id="root"></div>` near top).
Googlebot response must be full HTML with `<h1>` and `<table class="standings">`
visible without JS.

## 5. Submit reindex in GSC

After verification, request reindex in Google Search Console for at least
one URL from each pattern so Google re-crawls them with the new SSR HTML
instead of the old empty shell:

- `/bang-xep-hang/premier-league`
- `/doi-bong/manchester-united` (or whichever team has highest traffic)
- `/lich-thi-dau/la-liga`
- `/ket-qua-bong-da/serie-a`
- `/top-ghi-ban/bundesliga`
- `/giai-dau/champions-league`
- `/thong-ke`

The full sitemap will pick up the rest within Google's normal crawl cycle.
