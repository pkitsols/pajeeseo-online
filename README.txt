PAJEESEO.ONLINE - COMPLETE REAL STATS SEO TOOL FOLDER
========================================================

Folder structure:

pajeeseo-online-complete-folder/
├── index.html
├── api.php
├── .htaccess
├── assets/
│   ├── pajeeseo-logo.svg
│   ├── pajeeseo-logo.png
│   ├── pajeeseo-favicon.svg
│   └── pajeeseo-favicon.png
└── docs/
    └── api-setup.txt

UPLOAD STEPS / KAISAY USE KARNA HAI
-----------------------------------
1. ZIP extract karo.
2. Folder ke andar wali files ko apne hosting/cPanel public_html ya subdomain folder me upload karo.
3. Example: agar tool subdomain par chahiye, to subdomain folder me ye files upload karo:
   - index.html
   - api.php
   - .htaccess
   - assets folder
4. Browser me domain open karo, e.g. https://pajeeseo.online/

API KEYS SETUP
--------------
api.php open karo aur ye constants fill karo:

const PAGESPEED_API_KEY = 'YOUR_GOOGLE_PAGESPEED_KEY';
const GOOGLE_CSE_API_KEY = 'YOUR_GOOGLE_CUSTOM_SEARCH_API_KEY';
const GOOGLE_CSE_ID = 'YOUR_GOOGLE_SEARCH_ENGINE_ID';

Real stats explanation:
- PageSpeed: Google PageSpeed Insights API se real performance, SEO, accessibility, best-practices score.
- Website Audit: api.php server-side target website ka HTML fetch karta hai and title, meta, H1, canonical, schema, images, robots, sitemap, mixed content check karta hai.
- Keyword/SERP: Google Custom Search API se live Google-style search results, total result count, and domain top-10 position.
- Search volume / CPC: Google Custom Search se available nahi hota. Is ke liye DataForSEO, Semrush, Ahrefs, or Google Ads API connect karni hogi. Dashboard fake numbers show nahi karta.

IMPORTANT SECURITY NOTE
-----------------------
API keys ko index.html me mat rakho. api.php server-side file me rakho. Front-end JS me key rakhne se key public ho jati hai.

WHATSAPP NUMBER CHANGE
----------------------
index.html me search karo: 923001234567
Apna real WhatsApp number add kar do.

LOGO / FAVICON
--------------
Logo files assets folder me included hain:
- assets/pajeeseo-logo.svg
- assets/pajeeseo-logo.png
- assets/pajeeseo-favicon.svg
- assets/pajeeseo-favicon.png

TROUBLESHOOTING
---------------
1. PageSpeed working but SERP not working:
   Google CSE API key and CSE ID missing hain.

2. On-page audit not working:
   Ensure api.php same folder me uploaded hai, PHP/cURL hosting me enabled hai.

3. Backend status missing:
   Visit: https://yourdomain.com/api.php?action=health
   Agar JSON response aaye to backend connected hai.

4. Some websites audit nahi hoti:
   Kuch websites bots/cURL block kar deti hain. Ye hosting/server restriction hoti hai.
