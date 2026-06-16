const PARAGRAPH_STYLE = [
    'margin: 0 0 18px',
    'line-height: 1.9',
    'font-size: 16px',
    'letter-spacing: 0',
    'color: #2b2f36',
    'text-align: left'
].join('; ');

const SECTION_STYLE = [
    'margin: 30px 0 16px',
    'padding: 10px 12px',
    'background: #f5f8ff',
    'border-left: 4px solid #2f80ed',
    'border-radius: 4px'
].join('; ');

const SECTION_INDEX_STYLE = [
    'display: inline-block',
    'margin-right: 8px',
    'font-size: 13px',
    'font-weight: 700',
    'color: #2f80ed'
].join('; ');

const SECTION_TEXT_STYLE = [
    'font-size: 17px',
    'font-weight: 700',
    'line-height: 1.6',
    'color: #1f2937'
].join('; ');

const IMAGE_SECTION_STYLE = [
    'margin: 22px 0 18px',
    'text-align: center'
].join('; ');

const IMAGE_STYLE = [
    'max-width: 100%',
    'height: auto',
    'display: block',
    'margin: 0 auto'
].join('; ');

const CAPTION_STYLE = [
    'margin: 8px 0 18px',
    'line-height: 1.7',
    'font-size: 14px',
    'color: #6b7280',
    'text-align: center',
    'font-style: italic'
].join('; ');

const LIST_STYLE = [
    'margin: 0 0 18px',
    'padding-left: 22px',
    'line-height: 1.9',
    'font-size: 16px',
    'color: #2b2f36'
].join('; ');

const MAX_PARAGRAPH_CHARS = 96;

export function renderWeChatArticleHtml(markdown: string, imageUrls: Map<string, string>): string {
    const blocks = tokenizeBlocks(replaceImageReferences(markdown, imageUrls));
    const output: string[] = [];
    let sectionIndex = 0;

    for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index];
        if (block.type === 'heading') {
            sectionIndex += 1;
            output.push(renderSectionHeading(block.text, sectionIndex));
        } else if (block.type === 'paragraph') {
            for (const paragraph of splitParagraph(block.text)) {
                output.push(`<p style="${PARAGRAPH_STYLE}">${inlineMarkdown(paragraph)}</p>`);
            }
        } else if (block.type === 'list') {
            const tag = block.ordered ? 'ol' : 'ul';
            output.push(`<${tag} style="${LIST_STYLE}">`);
            for (const item of block.items) {
                output.push(`<li style="margin: 0 0 8px;">${inlineMarkdown(item)}</li>`);
            }
            output.push(`</${tag}>`);
        } else if (block.type === 'image') {
            output.push(renderImage(block.html));
            const next = blocks[index + 1];
            if (next?.type === 'caption') {
                output.push(`<p data-caption="true" style="${CAPTION_STYLE}">${inlineMarkdown(next.text)}</p>`);
                index += 1;
            }
        } else if (block.type === 'caption') {
            output.push(`<p data-caption="true" style="${CAPTION_STYLE}">${inlineMarkdown(block.text)}</p>`);
        }
    }

    return output.join('');
}

type Block =
    | { type: 'heading'; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'caption'; text: string }
    | { type: 'image'; html: string }
    | { type: 'list'; ordered: boolean; items: string[] };

function tokenizeBlocks(markdown: string): Block[] {
    const lines = markdown.split(/\r?\n/);
    const blocks: Block[] = [];
    let paragraph: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;

    const flushParagraph = () => {
        if (paragraph.length > 0) {
            const text = paragraph.join(' ').trim();
            const caption = text.match(/^\*([^*]+)\*$/);
            const boldHeading = text.match(/^\*\*([^*]+)\*\*$/) || text.match(/^__([^_]+)__$/);
            if (caption) {
                blocks.push({ type: 'caption', text: caption[1] });
            } else if (boldHeading && boldHeading[1].trim().length <= 36) {
                blocks.push({ type: 'heading', text: boldHeading[1].trim() });
            } else {
                blocks.push({ type: 'paragraph', text });
            }
            paragraph = [];
        }
    };
    const flushList = () => {
        if (list) blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
        list = null;
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
        const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
        const ordered = trimmed.match(/^\d+\.\s+(.+)$/);

        if (!trimmed) {
            flushParagraph();
            flushList();
        } else if (heading) {
            flushParagraph();
            flushList();
            blocks.push({ type: 'heading', text: heading[2] });
        } else if (/^<img\s/.test(trimmed)) {
            flushParagraph();
            flushList();
            blocks.push({ type: 'image', html: trimmed });
        } else if (unordered || ordered) {
            flushParagraph();
            const isOrdered = Boolean(ordered);
            if (!list || list.ordered !== isOrdered) {
                flushList();
                list = { ordered: isOrdered, items: [] };
            }
            list.items.push((unordered || ordered)![1]);
        } else {
            flushList();
            paragraph.push(trimmed);
        }
    }
    flushParagraph();
    flushList();
    return blocks;
}

function replaceImageReferences(markdown: string, imageUrls: Map<string, string>): string {
    let value = markdown;
    for (const [path, url] of imageUrls) {
        const escapedPath = escapeRegExp(path);
        value = value
            .replace(new RegExp(`!\\[\\[${escapedPath}(?:\\|[^\\]]*)?\\]\\]`, 'g'), `<img src="${escapeHtml(url)}">`)
            .replace(new RegExp(`!\\[[^\\]]*\\]\\(<?${escapedPath}>?(?:\\s+["'][^"']*["'])?\\)`, 'g'), `<img src="${escapeHtml(url)}">`);
    }
    return value;
}

function splitParagraph(value: string): string[] {
    if (value.length <= MAX_PARAGRAPH_CHARS) return [value];
    const sentences = value.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [value];
    const result: string[] = [];
    let current = '';

    for (const sentence of sentences) {
        const next = current ? `${current}${sentence}` : sentence;
        if (next.length > MAX_PARAGRAPH_CHARS && current) {
            result.push(current);
            current = sentence;
        } else {
            current = next;
        }
    }
    if (current) result.push(current);
    return result.flatMap(splitOversizedChunk);
}

function splitOversizedChunk(value: string): string[] {
    if (value.length <= MAX_PARAGRAPH_CHARS) return [value];
    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += MAX_PARAGRAPH_CHARS) {
        chunks.push(value.slice(offset, offset + MAX_PARAGRAPH_CHARS));
    }
    return chunks;
}

function renderSectionHeading(text: string, index: number): string {
    return `<section data-section-index="${index}" style="${SECTION_STYLE}">` +
        `<span style="${SECTION_INDEX_STYLE}">${String(index).padStart(2, '0')}</span>` +
        `<span style="${SECTION_TEXT_STYLE}">${inlineMarkdown(text)}</span>` +
        '</section>';
}

function renderImage(html: string): string {
    const source = html.match(/\ssrc="([^"]+)"/)?.[1] || '';
    return `<section data-image-block="true" style="${IMAGE_SECTION_STYLE}">` +
        `<img src="${source}" style="${IMAGE_STYLE}">` +
        '</section>';
}

function inlineMarkdown(value: string): string {
    return escapeHtml(value)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>');
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
