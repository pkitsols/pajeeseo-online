// Pajeeseo.online Vercel Serverless API
// Environment variables required in Vercel Project Settings:
// PAGESPEED_API_KEY       optional but recommended
// GOOGLE_CSE_API_KEY      required for live SERP data
// GOOGLE_CSE_ID           required for live SERP data

const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY || '';
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY || '';
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || '';

const UA = 'PajeeseoBot/1.0 (+https://pajeeseo.online/)';

function json(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

function fail(res, message, code = 400, extra = {}) {
  json(res, code, { ok: false, message, ...extra });
}

function cleanUrl(input) {
  let url = String(input || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function domainFromUrl(input) {
  try {
    return new URL(input).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function originFromUrl(input) {
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return '';
  }
}

function stripTags(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(html, regex) {
  const m = String(html || '').match(regex);
  return m ? stripTags(m[1] || '') : '';
}

function extractAttr(html, regex) {
  const m = String(html || '').match(regex);
  return m ? String(m[1] || '').trim() : '';
}

function addCheck(arr, name, status, detail, value = '') {
  arr.push({ name, status, detail, value });
}

async function fetchText(url, timeoutMs = 20000, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...headers,
      },
    });
    const text = await response.text();
    const headerObj = Object.fromEntries(response.headers.entries());
    return {
      ok: true,
      status: response.status,
      url: response.url || url,
      body: text,
      headers: headerObj,
      totalTime: (Date.now() - started) / 1000,
    };
  } catch (error) {
    return { ok: false, error: error.message || 'Fetch failed', status: 0, url, body: '', headers: {}, totalTime: (Date.now() - started) / 1000 };
  } finally {
    clearTimeout(timer);
  }
}

async function handleHealth(req, res) {
  json(res, 200, {
    ok: true,
    backend: true,
    runtime: 'vercel_serverless_node',
    pagespeed_key_configured: Boolean(PAGESPEED_API_KEY),
    google_cse_configured: Boolean(GOOGLE_CSE_API_KEY && GOOGLE_CSE_ID),
  });
}

async function handlePageSpeed(req, res, query) {
  const url = cleanUrl(query.url);
  const strategy = query.strategy === 'desktop' ? 'desktop' : 'mobile';
  if (!url) return fail(res, 'Valid URL is required.');

  const params = new URLSearchParams();
  params.set('url', url);
  params.set('strategy', strategy);
  ['performance', 'seo', 'accessibility', 'best-practices'].forEach(cat => params.append('category', cat));
  if (PAGESPEED_API_KEY) params.set('key', PAGESPEED_API_KEY);

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
  const r = await fetchText(apiUrl, 45000, { Accept: 'application/json' });
  if (!r.ok) return fail(res, `PageSpeed API request failed: ${r.error}`, 502);

  let data;
  try { data = JSON.parse(r.body); } catch { return fail(res, 'Invalid PageSpeed API response.', 502, { raw: r.body.slice(0, 500) }); }
  if (data.error) return fail(res, data.error.message || 'PageSpeed API error.', 200, { api_error: data.error });
  json(res, 200, { ok: true, source: 'google_pagespeed', data });
}

async function handleSuggest(req, res, query) {
  const keyword = String(query.keyword || '').trim();
  if (!keyword) return fail(res, 'Keyword is required.');
  const country = String(query.country || 'PK').replace(/[^A-Za-z]/g, '').slice(0, 2).toLowerCase() || 'pk';
  const lang = String(query.lang || 'en').replace(/[^A-Za-z]/g, '').slice(0, 2).toLowerCase() || 'en';
  const apiUrl = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${encodeURIComponent(lang)}&gl=${encodeURIComponent(country)}&q=${encodeURIComponent(keyword)}`;
  const r = await fetchText(apiUrl, 15000, { Accept: 'application/json' });
  if (!r.ok) return fail(res, 'Google Suggest request failed.', 502);
  let data;
  try { data = JSON.parse(r.body); } catch { data = []; }
  const suggestions = Array.isArray(data?.[1]) ? [...new Set(data[1])].slice(0, 20) : [];
  json(res, 200, { ok: true, source: 'google_suggest', suggestions });
}

async function handleSerp(req, res, query) {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    return fail(res, 'Google Custom Search API key and Search Engine ID are required in Vercel Environment Variables.', 200, { requires_config: true });
  }
  const keyword = String(query.keyword || '').trim();
  const url = cleanUrl(query.url);
  if (!keyword) return fail(res, 'Keyword is required.');

  const country = String(query.country || 'PK').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'PK';
  const lang = String(query.lang || 'en').replace(/[^A-Za-z]/g, '').slice(0, 2).toLowerCase() || 'en';
  const params = new URLSearchParams({
    q: keyword,
    cx: GOOGLE_CSE_ID,
    key: GOOGLE_CSE_API_KEY,
    num: '10',
    gl: country,
    hl: lang,
  });

  const apiUrl = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
  const r = await fetchText(apiUrl, 25000, { Accept: 'application/json' });
  if (!r.ok) return fail(res, `Google CSE request failed: ${r.error}`, 502);
  let data;
  try { data = JSON.parse(r.body); } catch { return fail(res, 'Invalid Google CSE response.', 502, { raw: r.body.slice(0, 500) }); }
  if (data.error) return fail(res, data.error.message || 'Google CSE API error.', 200, { api_error: data.error });

  const targetDomain = url ? domainFromUrl(url) : '';
  let position = null;
  const items = Array.isArray(data.items) ? data.items : [];
  if (targetDomain) {
    for (let i = 0; i < items.length; i++) {
      if (domainFromUrl(items[i].link || '') === targetDomain) {
        position = i + 1;
        break;
      }
    }
  }

  json(res, 200, {
    ok: true,
    source: 'google_custom_search',
    search_information: {
      total_results: data.searchInformation?.totalResults || null,
      search_time: data.searchInformation?.searchTime || null,
    },
    domain_position: position,
    items,
  });
}

async function handleAudit(req, res, query) {
  const url = cleanUrl(query.url);
  if (!url) return fail(res, 'Valid URL is required.');

  const r = await fetchText(url, 30000);
  if (!r.ok) return fail(res, `Unable to fetch target URL: ${r.error}`, 502);

  const html = r.body || '';
  const finalUrl = r.url || url;
  const onpage = [];
  const technical = [];

  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  let desc = extractAttr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i);
  if (!desc) desc = extractAttr(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);

  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => stripTags(m[1])).filter(Boolean);
  let canonical = extractAttr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
  if (!canonical) canonical = extractAttr(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const robotsMeta = extractAttr(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const schemaCount = (html.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []).length;
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const missingAlt = imgTags.filter(img => !/\salt=["'][^"']+["']/i.test(img)).length;
  const host = domainFromUrl(finalUrl);
  const links = [...html.matchAll(/<a\b[^>]+href=["']([^"']+)/gi)].map(m => m[1]);
  let internalLinks = 0;
  let externalLinks = 0;
  for (const href of links) {
    if (/^https?:\/\//i.test(href)) {
      domainFromUrl(href) === host ? internalLinks++ : externalLinks++;
    } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      internalLinks++;
    }
  }

  const finalParsed = new URL(finalUrl);
  const isHttps = finalParsed.protocol === 'https:';
  const mixedContent = isHttps ? (html.match(/(?:src|href)=["']http:\/\//gi) || []).length : 0;
  const xRobots = r.headers['x-robots-tag'] || '';
  const origin = originFromUrl(finalUrl);
  const [robotsCheck, sitemapCheck] = await Promise.allSettled([
    fetchText(`${origin}/robots.txt`, 10000, { Accept: 'text/plain,*/*' }),
    fetchText(`${origin}/sitemap.xml`, 10000, { Accept: 'application/xml,text/xml,*/*' }),
  ]);
  const robotsStatus = robotsCheck.status === 'fulfilled' ? robotsCheck.value.status : 0;
  const sitemapStatus = sitemapCheck.status === 'fulfilled' ? sitemapCheck.value.status : 0;

  const titleLen = title.length;
  addCheck(onpage, 'Title tag', titleLen >= 30 && titleLen <= 65 ? 'pass' : (titleLen ? 'warn' : 'fail'), title ? `Title length is ${titleLen} characters.` : 'Missing title tag.', title);
  const descLen = desc.length;
  addCheck(onpage, 'Meta description', descLen >= 80 && descLen <= 165 ? 'pass' : (descLen ? 'warn' : 'fail'), desc ? `Description length is ${descLen} characters.` : 'Missing meta description.', desc);
  addCheck(onpage, 'H1 heading', h1s.length === 1 ? 'pass' : (h1s.length > 1 ? 'warn' : 'fail'), `${h1s.length} H1 heading(s) found.`, h1s.slice(0, 3).join(' | '));
  addCheck(onpage, 'Canonical URL', canonical ? 'pass' : 'warn', canonical ? 'Canonical tag found.' : 'Canonical tag missing or not readable.', canonical);
  addCheck(onpage, 'Structured data', schemaCount > 0 ? 'pass' : 'warn', `${schemaCount} JSON-LD block(s) found.`, `${schemaCount} schema blocks`);
  addCheck(onpage, 'Image alt text', missingAlt === 0 ? 'pass' : (missingAlt <= 3 ? 'warn' : 'fail'), `${imgTags.length} image(s) found; ${missingAlt} missing alt text.`, `${missingAlt} missing alt`);
  addCheck(onpage, 'Internal links', internalLinks >= 5 ? 'pass' : 'warn', `${internalLinks} internal link(s), ${externalLinks} external link(s) found.`, `${internalLinks} internal / ${externalLinks} external`);

  addCheck(technical, 'HTTP status', r.status >= 200 && r.status < 400 ? 'pass' : 'fail', `HTTP status code: ${r.status}`, String(r.status));
  addCheck(technical, 'HTTPS', isHttps ? 'pass' : 'fail', isHttps ? 'Secure HTTPS URL detected.' : 'URL is not HTTPS.', finalUrl);
  addCheck(technical, 'Mobile viewport', viewport ? 'pass' : 'fail', viewport ? 'Viewport meta tag found.' : 'Viewport meta tag missing.', viewport ? 'viewport present' : 'missing');
  addCheck(technical, 'Robots meta / X-Robots', !/noindex/i.test(`${robotsMeta} ${xRobots}`) ? 'pass' : 'fail', (robotsMeta || xRobots) ? 'Robots directives detected.' : 'No blocking robots directives detected.', `${robotsMeta} ${xRobots}`.trim());
  addCheck(technical, 'robots.txt', robotsStatus >= 200 && robotsStatus < 400 ? 'pass' : 'warn', `robots.txt status: ${robotsStatus || 'N/A'}`, `${origin}/robots.txt`);
  addCheck(technical, 'sitemap.xml', sitemapStatus >= 200 && sitemapStatus < 400 ? 'pass' : 'warn', `sitemap.xml status: ${sitemapStatus || 'N/A'}`, `${origin}/sitemap.xml`);
  addCheck(technical, 'Mixed content', mixedContent === 0 ? 'pass' : 'fail', mixedContent === 0 ? 'No obvious http:// assets found on HTTPS page.' : `${mixedContent} insecure http:// asset reference(s) found.`, `${mixedContent} mixed refs`);
  addCheck(technical, 'Response time', r.totalTime <= 2.5 ? 'pass' : 'warn', `Server fetch time: ${r.totalTime.toFixed(2)}s`, `${r.totalTime.toFixed(2)}s`);

  json(res, 200, {
    ok: true,
    source: 'server_html_audit',
    url,
    final_url: finalUrl,
    http_code: r.status,
    onpage,
    technical,
    counts: {
      images: imgTags.length,
      missing_alt: missingAlt,
      internal_links: internalLinks,
      external_links: externalLinks,
      schema: schemaCount,
    },
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.end();
    return;
  }

  if (req.method !== 'GET') return fail(res, 'Only GET method is supported.', 405);

  const query = req.query || {};
  const action = query.action || 'health';
  try {
    if (action === 'health') return await handleHealth(req, res);
    if (action === 'pagespeed') return await handlePageSpeed(req, res, query);
    if (action === 'suggest') return await handleSuggest(req, res, query);
    if (action === 'serp') return await handleSerp(req, res, query);
    if (action === 'audit') return await handleAudit(req, res, query);
    return fail(res, 'Unknown action.');
  } catch (error) {
    return fail(res, error.message || 'Unexpected server error.', 500);
  }
}
