import Parser from 'rss-parser';
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

function extractImage(item: any): string | null {
    // Try media:content
    if (item['media:content']?.$.url) return item['media:content'].$.url;
    // Try media:thumbnail
    if (item['media:thumbnail']?.$.url) return item['media:thumbnail'].$.url;
    // Try enclosure
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image')) return item.enclosure.url;
    // Try content:encoded or content for <img> tag
    const content = item['content:encoded'] || item.content || '';
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch?.[1]) return imgMatch[1];
    // Try itunes:image
    if (item['itunes:image']?.$.href) return item['itunes:image'].$.href;
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
        .replace(/\s+/g, ' ')
        .trim();
}

function createExcerpt(item: any): string {
    const raw = item.contentSnippet || item['content:encodedSnippet'] || item.content || item.summary || '';
    const clean = stripHtml(raw);
    if (clean.length <= 160) return clean;
    return clean.substring(0, 157).replace(/\s+\S*$/, '') + '...';
}

async function fetchFeed(feed: FeedConfig): Promise<FeedItem[]> {
    const parser = new Parser({
        timeout: FETCH_TIMEOUT,
        customFields: {
            item: [
                ['media:content', 'media:content'],
                ['media:thumbnail', 'media:thumbnail'],
                ['content:encoded', 'content:encoded'],
            ],
        },
    });

    try {
        const parsed = await parser.parseURL(feed.url);
        return (parsed.items || []).map((item: any) => ({
            title: item.title?.trim() || 'Untitled',
            link: item.link || '#',
            pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
            isoDate: item.isoDate || new Date(item.pubDate || Date.now()).toISOString(),
            excerpt: createExcerpt(item),
            image: extractImage(item),
            source: feed.label,
            sourceUrl: new URL(feed.url).origin,
        }));
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
