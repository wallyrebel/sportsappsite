import feedsData from '../data/feeds.json';

export interface FeedItem {
    title: string;
    link: string;
    pubDate: string;
    isoDate: string;
    excerpt: string;
    image: string | null;
    source: string;
    sourceUrl: string;
}

interface FeedConfig {
    name: string;
    url: string;
    label: string;
}

const DEFAULT_IMAGE = '/default-article.jpg';
const FETCH_TIMEOUT = 8000;

function getTagContent(xml: string, tag: string): string {
    // Handle CDATA sections
    const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
    const cdataMatch = xml.match(cdataRegex);
    if (cdataMatch) return cdataMatch[1].trim();

    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
}

function getAttr(xml: string, tag: string, attr: string): string {
    const tagRegex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*/?>`, 'i');
    const match = xml.match(tagRegex);
    return match ? match[1] : '';
}

function extractImage(itemXml: string): string | null {
    // media:content url
    const mediaContent = getAttr(itemXml, 'media:content', 'url');
    if (mediaContent) return mediaContent;

    // media:thumbnail url
    const mediaThumbnail = getAttr(itemXml, 'media:thumbnail', 'url');
    if (mediaThumbnail) return mediaThumbnail;

    // enclosure with image type
    const enclosureType = getAttr(itemXml, 'enclosure', 'type');
    if (enclosureType.startsWith('image')) {
        const enclosureUrl = getAttr(itemXml, 'enclosure', 'url');
        if (enclosureUrl) return enclosureUrl;
    }

    // img tag in content:encoded or description
    const content = getTagContent(itemXml, 'content:encoded') || getTagContent(itemXml, 'description');
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch?.[1]) return imgMatch[1];

    return null;
}

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&hellip;/g, '…')
        .replace(/\s+/g, ' ')
        .trim();
}

function createExcerpt(itemXml: string): string {
    const description = getTagContent(itemXml, 'description');
    const content = getTagContent(itemXml, 'content:encoded');
    const raw = description || content || '';
    const clean = stripHtml(raw);
    if (clean.length <= 160) return clean;
    return clean.substring(0, 157).replace(/\s+\S*$/, '') + '...';
}

function parseItems(xml: string, feed: FeedConfig): FeedItem[] {
    const items: FeedItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        const title = stripHtml(getTagContent(itemXml, 'title')) || 'Untitled';
        const link = getTagContent(itemXml, 'link') || '#';
        const pubDate = getTagContent(itemXml, 'pubDate') || '';
        let isoDate: string;

        try {
            isoDate = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
        } catch {
            isoDate = new Date().toISOString();
        }

        items.push({
            title,
            link,
            pubDate,
            isoDate,
            excerpt: createExcerpt(itemXml),
            image: extractImage(itemXml),
            source: feed.label,
            sourceUrl: new URL(feed.url).origin,
        });
    }

    return items;
}

async function fetchFeed(feed: FeedConfig): Promise<FeedItem[]> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(feed.url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'MississippiSportsApp/1.0',
                'Accept': 'application/rss+xml, application/xml, text/xml',
            },
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.warn(`⚠ Feed returned ${response.status}: ${feed.name}`);
            return [];
        }

        const xml = await response.text();
        return parseItems(xml, feed);
    } catch (error) {
        console.warn(`⚠ Failed to fetch feed: ${feed.name} (${feed.url})`, error);
        return [];
    }
}

export async function getAllFeedItems(): Promise<FeedItem[]> {
    const feeds = feedsData as FeedConfig[];
    const results = await Promise.allSettled(feeds.map(fetchFeed));
    const items: FeedItem[] = [];

    for (const result of results) {
        if (result.status === 'fulfilled') {
            items.push(...result.value);
        }
    }

    // Deduplicate by link
    const seen = new Set<string>();
    const unique = items.filter((item) => {
        const key = item.link.replace(/\/$/, '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort newest first
    unique.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());

    return unique;
}

export function applyDefaultImages(items: FeedItem[]): FeedItem[] {
    return items.map((item) => ({
        ...item,
        image: item.image || DEFAULT_IMAGE,
    }));
}
