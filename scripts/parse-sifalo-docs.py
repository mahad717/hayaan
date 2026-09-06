#!/usr/bin/env python3
"""Parse Sifalo Pay docs HTML: extract nav links + main text content."""
import json
import re
import sys
import html as html_mod


def load(path):
    d = json.load(open(path))
    data = d.get('data', d)
    return data.get('html') or '', data.get('title') or ''


def extract_links(html):
    """Find all internal links with anchor text."""
    links = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S)
    out = []
    seen = set()
    for href, text in links:
        text = re.sub(r'<[^>]+>', '', text)
        text = html_mod.unescape(text).strip()
        if not text or len(text) > 80:
            continue
        if href in seen:
            continue
        seen.add(href)
        out.append((href, text))
    return out


def strip_html(html):
    html = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.S)
    html = re.sub(r'<style[^>]*>.*?</style>', ' ', html, flags=re.S)
    html = re.sub(r'<svg[^>]*>.*?</svg>', ' ', html, flags=re.S)
    # code blocks keep spacing
    html = re.sub(r'<(pre|code)[^>]*>', '\n```\n', html)
    html = re.sub(r'</(pre|code)>', '\n```\n', html)
    html = re.sub(r'<(h[1-6])[^>]*>', '\n\n## ', html)
    html = re.sub(r'</h[1-6]>', '\n', html)
    html = re.sub(r'<(p|div|li|tr|br)[^>]*>', '\n', html)
    html = re.sub(r'<td[^>]*>', ' | ', html)
    text = re.sub(r'<[^>]+>', '', html)
    text = html_mod.unescape(text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n\n', text)
    return text.strip()


if __name__ == '__main__':
    path = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else 'text'
    html, title = load(path)
    if mode == 'links':
        for href, text in extract_links(html):
            print(f'{href} :: {text}')
    else:
        print(f'# {title}\n')
        print(strip_html(html)[: int(sys.argv[3]) if len(sys.argv) > 3 else 12000])
