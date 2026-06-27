<?php
/**
 * Pajeeseo.online API proxy
 * Upload this file in the same folder as index.html.
 * Add your API keys below. Keep this file server-side only.
 */
const PAGESPEED_API_KEY = 'AIzaSyD3_dS86LGWdCZmibPj2mo2glg3tWGUX44';      // Optional but recommended
const GOOGLE_CSE_API_KEY = 'AIzaSyD3_dS86LGWdCZmibPj2mo2glg3tWGUX44';     // Required for SERP preview
const GOOGLE_CSE_ID = 'b382c0e302f1c4c32';          // Required for SERP preview

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

function out($data, $code = 200) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
function fail($message, $code = 400, $extra = []) { out(array_merge(['ok' => false, 'message' => $message], $extra), $code); }
function clean_url($url) {
    $url = trim((string)$url);
    if ($url === '') return '';
    if (!preg_match('~^https?://~i', $url)) $url = 'https://' . $url;
    if (!filter_var($url, FILTER_VALIDATE_URL)) return '';
    return $url;
}
function http_get($url, $timeout = 20, $headers = []) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_USERAGENT => 'PajeeseoBot/1.0 (+https://pajeeseo.online/)',
        CURLOPT_HEADER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => $headers
    ]);
    $response = curl_exec($ch);
    $error = curl_error($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    if ($response === false) return ['ok' => false, 'error' => $error, 'info' => $info, 'headers' => '', 'body' => ''];
    $headerSize = $info['header_size'] ?? 0;
    return ['ok' => true, 'error' => '', 'info' => $info, 'headers' => substr($response, 0, $headerSize), 'body' => substr($response, $headerSize)];
}
function extract_tag($html, $pattern) { return preg_match($pattern, $html, $m) ? trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8')) : ''; }
function extract_attr($html, $pattern) { return preg_match($pattern, $html, $m) ? trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8')) : ''; }
function add_check(&$arr, $name, $status, $detail, $value = '') { $arr[] = ['name' => $name, 'status' => $status, 'detail' => $detail, 'value' => $value]; }
function origin_from_url($url) { $p = parse_url($url); return ($p['scheme'] ?? 'https') . '://' . ($p['host'] ?? ''); }
function domain_from_url($url) { $h = parse_url($url, PHP_URL_HOST); return strtolower(preg_replace('/^www\./i', '', $h ?: '')); }

$action = $_GET['action'] ?? 'health';
if ($action === 'health') {
    out(['ok' => true, 'backend' => true, 'pagespeed_key_configured' => PAGESPEED_API_KEY !== '', 'google_cse_configured' => GOOGLE_CSE_API_KEY !== '' && GOOGLE_CSE_ID !== '']);
}

if ($action === 'pagespeed') {
    $url = clean_url($_GET['url'] ?? '');
    $strategy = ($_GET['strategy'] ?? 'mobile') === 'desktop' ? 'desktop' : 'mobile';
    if (!$url) fail('Valid URL is required.');
    $params = ['url' => $url, 'strategy' => $strategy, 'category' => ['performance', 'seo', 'accessibility', 'best-practices']];
    $query = 'url=' . urlencode($url) . '&strategy=' . urlencode($strategy);
    foreach ($params['category'] as $cat) $query .= '&category=' . urlencode($cat);
    if (PAGESPEED_API_KEY !== '') $query .= '&key=' . urlencode(PAGESPEED_API_KEY);
    $api = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' . $query;
    $r = http_get($api, 35);
    if (!$r['ok']) fail('PageSpeed API request failed: ' . $r['error'], 502);
    $json = json_decode($r['body'], true);
    if (!is_array($json)) fail('Invalid PageSpeed API response.', 502, ['raw' => substr($r['body'], 0, 500)]);
    out(['ok' => true, 'source' => 'google_pagespeed', 'data' => $json]);
}

if ($action === 'suggest') {
    $keyword = trim((string)($_GET['keyword'] ?? ''));
    if ($keyword === '') fail('Keyword is required.');
    $country = strtolower(substr(preg_replace('/[^A-Za-z]/', '', $_GET['country'] ?? 'PK'), 0, 2)) ?: 'pk';
    $lang = strtolower(substr(preg_replace('/[^A-Za-z]/', '', $_GET['lang'] ?? 'en'), 0, 2)) ?: 'en';
    $api = 'https://suggestqueries.google.com/complete/search?client=firefox&hl=' . urlencode($lang) . '&gl=' . urlencode($country) . '&q=' . urlencode($keyword);
    $r = http_get($api, 12);
    if (!$r['ok']) fail('Google Suggest request failed.', 502);
    $json = json_decode($r['body'], true);
    $suggestions = is_array($json) && isset($json[1]) && is_array($json[1]) ? array_values(array_unique(array_slice($json[1], 0, 15))) : [];
    out(['ok' => true, 'source' => 'google_suggest', 'suggestions' => $suggestions]);
}

if ($action === 'serp') {
    if (GOOGLE_CSE_API_KEY === '' || GOOGLE_CSE_ID === '') fail('Google Custom Search API key and Search Engine ID are required in api.php.', 200, ['requires_config' => true]);
    $keyword = trim((string)($_GET['keyword'] ?? ''));
    $url = clean_url($_GET['url'] ?? '');
    if ($keyword === '') fail('Keyword is required.');
    $country = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $_GET['country'] ?? 'PK'), 0, 2)) ?: 'PK';
    $lang = strtolower(substr(preg_replace('/[^A-Za-z]/', '', $_GET['lang'] ?? 'en'), 0, 2)) ?: 'en';
    $api = 'https://www.googleapis.com/customsearch/v1?q=' . urlencode($keyword) . '&cx=' . urlencode(GOOGLE_CSE_ID) . '&key=' . urlencode(GOOGLE_CSE_API_KEY) . '&num=10&gl=' . urlencode($country) . '&hl=' . urlencode($lang);
    $r = http_get($api, 20);
    if (!$r['ok']) fail('Google CSE request failed: ' . $r['error'], 502);
    $json = json_decode($r['body'], true);
    if (!is_array($json)) fail('Invalid Google CSE response.', 502, ['raw' => substr($r['body'], 0, 500)]);
    $targetDomain = $url ? domain_from_url($url) : '';
    $position = null;
    if ($targetDomain && !empty($json['items'])) {
        foreach ($json['items'] as $i => $item) {
            $itemDomain = domain_from_url($item['link'] ?? '');
            if ($itemDomain === $targetDomain) { $position = $i + 1; break; }
        }
    }
    out(['ok' => true, 'source' => 'google_custom_search', 'search_information' => ['total_results' => $json['searchInformation']['totalResults'] ?? null, 'search_time' => $json['searchInformation']['searchTime'] ?? null], 'domain_position' => $position, 'items' => $json['items'] ?? []]);
}

if ($action === 'audit') {
    $url = clean_url($_GET['url'] ?? '');
    if (!$url) fail('Valid URL is required.');
    $r = http_get($url, 25, ['Accept: text/html,application/xhtml+xml']);
    if (!$r['ok']) fail('Unable to fetch target URL: ' . $r['error'], 502);
    $html = $r['body'];
    $info = $r['info'];
    $headers = $r['headers'];
    $finalUrl = $info['url'] ?? $url;
    $onpage = []; $technical = [];

    $title = extract_tag($html, '~<title[^>]*>(.*?)</title>~is');
    $desc = extract_attr($html, '~<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\'][^>]*>~is');
    if ($desc === '') $desc = extract_attr($html, '~<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description["\'][^>]*>~is');
    preg_match_all('~<h1\b[^>]*>(.*?)</h1>~is', $html, $h1m);
    $h1s = array_map(fn($x) => trim(html_entity_decode(strip_tags($x), ENT_QUOTES | ENT_HTML5, 'UTF-8')), $h1m[1] ?? []);
    $canonical = extract_attr($html, '~<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)~is');
    if ($canonical === '') $canonical = extract_attr($html, '~<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']canonical["\']~is');
    $robotsMeta = extract_attr($html, '~<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']*)~is');
    $viewport = preg_match('~<meta[^>]+name=["\']viewport["\']~i', $html) === 1;
    $schemaCount = preg_match_all('~<script[^>]+type=["\']application/ld\+json["\']~i', $html);
    $imgCount = preg_match_all('~<img\b[^>]*>~i', $html, $imgs);
    $missingAlt = 0;
    foreach (($imgs[0] ?? []) as $img) if (!preg_match('~\salt=["\'][^"\']+["\']~i', $img)) $missingAlt++;
    $internalLinks = 0; $externalLinks = 0;
    preg_match_all('~<a\b[^>]+href=["\']([^"\']+)~i', $html, $links);
    $host = domain_from_url($finalUrl);
    foreach ($links[1] ?? [] as $href) {
        if (strpos($href, 'http') === 0) { domain_from_url($href) === $host ? $internalLinks++ : $externalLinks++; }
        elseif (strpos($href, '#') !== 0 && strpos($href, 'mailto:') !== 0 && strpos($href, 'tel:') !== 0) $internalLinks++;
    }
    $isHttps = parse_url($finalUrl, PHP_URL_SCHEME) === 'https';
    $mixedContent = $isHttps ? preg_match_all('~(?:src|href)=["\']http://~i', $html) : 0;
    $xRobots = preg_match('~x-robots-tag:\s*([^\r\n]+)~i', $headers, $xm) ? trim($xm[1]) : '';
    $origin = origin_from_url($finalUrl);
    $robotsCheck = http_get($origin . '/robots.txt', 8);
    $sitemapCheck = http_get($origin . '/sitemap.xml', 8);

    $titleLen = mb_strlen($title);
    add_check($onpage, 'Title tag', $titleLen >= 30 && $titleLen <= 65 ? 'pass' : ($titleLen ? 'warn' : 'fail'), $title ? "Title length is {$titleLen} characters." : 'Missing title tag.', $title);
    $descLen = mb_strlen($desc);
    add_check($onpage, 'Meta description', $descLen >= 80 && $descLen <= 165 ? 'pass' : ($descLen ? 'warn' : 'fail'), $desc ? "Description length is {$descLen} characters." : 'Missing meta description.', $desc);
    add_check($onpage, 'H1 heading', count($h1s) === 1 ? 'pass' : (count($h1s) > 1 ? 'warn' : 'fail'), count($h1s) . ' H1 heading(s) found.', implode(' | ', array_slice($h1s, 0, 3)));
    add_check($onpage, 'Canonical URL', $canonical ? 'pass' : 'warn', $canonical ? 'Canonical tag found.' : 'Canonical tag missing or not readable.', $canonical);
    add_check($onpage, 'Structured data', $schemaCount > 0 ? 'pass' : 'warn', $schemaCount . ' JSON-LD block(s) found.', $schemaCount . ' schema blocks');
    add_check($onpage, 'Image alt text', $missingAlt === 0 ? 'pass' : ($missingAlt <= 3 ? 'warn' : 'fail'), "$imgCount image(s) found; $missingAlt missing alt text.", "$missingAlt missing alt");
    add_check($onpage, 'Internal links', $internalLinks >= 5 ? 'pass' : 'warn', "$internalLinks internal link(s), $externalLinks external link(s) found.", "$internalLinks internal / $externalLinks external");

    $status = (int)($info['http_code'] ?? 0);
    add_check($technical, 'HTTP status', $status >= 200 && $status < 400 ? 'pass' : 'fail', "HTTP status code: $status", (string)$status);
    add_check($technical, 'HTTPS', $isHttps ? 'pass' : 'fail', $isHttps ? 'Secure HTTPS URL detected.' : 'URL is not HTTPS.', $finalUrl);
    add_check($technical, 'Mobile viewport', $viewport ? 'pass' : 'fail', $viewport ? 'Viewport meta tag found.' : 'Viewport meta tag missing.', $viewport ? 'viewport present' : 'missing');
    add_check($technical, 'Robots meta / X-Robots', (stripos($robotsMeta . ' ' . $xRobots, 'noindex') === false) ? 'pass' : 'fail', ($robotsMeta || $xRobots) ? 'Robots directives detected.' : 'No blocking robots directives detected.', trim($robotsMeta . ' ' . $xRobots));
    add_check($technical, 'robots.txt', ($robotsCheck['info']['http_code'] ?? 0) >= 200 && ($robotsCheck['info']['http_code'] ?? 0) < 400 ? 'pass' : 'warn', 'robots.txt status: ' . (($robotsCheck['info']['http_code'] ?? 0) ?: 'N/A'), $origin . '/robots.txt');
    add_check($technical, 'sitemap.xml', ($sitemapCheck['info']['http_code'] ?? 0) >= 200 && ($sitemapCheck['info']['http_code'] ?? 0) < 400 ? 'pass' : 'warn', 'sitemap.xml status: ' . (($sitemapCheck['info']['http_code'] ?? 0) ?: 'N/A'), $origin . '/sitemap.xml');
    add_check($technical, 'Mixed content', $mixedContent === 0 ? 'pass' : 'fail', $mixedContent === 0 ? 'No obvious http:// assets found on HTTPS page.' : "$mixedContent insecure http:// asset reference(s) found.", "$mixedContent mixed refs");
    add_check($technical, 'Response time', ($info['total_time'] ?? 99) <= 2.5 ? 'pass' : 'warn', 'Server fetch time: ' . round($info['total_time'] ?? 0, 2) . 's', round($info['total_time'] ?? 0, 2) . 's');

    out(['ok' => true, 'source' => 'server_html_audit', 'url' => $url, 'final_url' => $finalUrl, 'http_code' => $status, 'onpage' => $onpage, 'technical' => $technical, 'counts' => ['images' => $imgCount, 'missing_alt' => $missingAlt, 'internal_links' => $internalLinks, 'external_links' => $externalLinks, 'schema' => $schemaCount]]);
}

fail('Unknown action.');
