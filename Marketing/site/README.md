# stayondriving.com

Static marketing site for the Stay On iPhone game. No build step — plain HTML/CSS + a few compressed assets.

## Structure

| File | Purpose |
|---|---|
| `index.html` | Landing page |
| `privacy.html` → `/privacy` | Privacy Policy (App Store Connect "Privacy Policy URL") |
| `support.html` → `/support` | Support page (App Store Connect "Support URL") |
| `style.css` | Shared styles |
| `vercel.json` | `cleanUrls`, cache headers, `.html` → clean-path redirects |
| `assets/` | Icon sizes, OG image, compressed hero/gallery clips + poster stills |

Source clips live in `../Shorts/` (1080×1920 originals). Regenerate `assets/` with ffmpeg:

```bash
# from Marketing/
ffmpeg -y -i Shorts/3_hold_left_release_right.mp4 -an -vf scale=-2:1280 \
  -c:v libx264 -crf 30 -preset veryslow -movflags +faststart -pix_fmt yuv420p site/assets/hero.mp4
```

## Deploy (Vercel)

```bash
cd Marketing/site
vercel --prod            # first run links/creates the project
```

Then in the Vercel project: add domains `stayondriving.com` and `www.stayondriving.com`, and set the
DNS records it shows at Porkbun (registrar + DNS host for this domain).

## Before launch — checklist

- [x] Swap the App Store link: done 2026-11-05 in PR #10. The `id6801365584` link resolves to the live "Stay On Driving" listing, and the "coming soon" caption is gone.
- [ ] Set up `support@stayondriving.com` (Porkbun free email forwarding) — it's the contact address on `/privacy` and `/support`.
- [ ] Paste the `/privacy` URL into App Store Connect → App Privacy, and `/support` into App Information → Support URL. Marketing URL = `https://stayondriving.com/`.
