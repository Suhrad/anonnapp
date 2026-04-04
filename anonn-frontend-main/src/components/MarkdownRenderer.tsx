import DOMPurify from "dompurify";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const renderMarkdown = (text: string) => {
    if (!text) return "";

    // Convert markdown to HTML
    let html = text;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2 mt-4">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-3 mt-4">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 mt-4">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    // Underline
    html = html.replace(/__(.*?)__/g, '<u class="underline">$1</u>');

    // Inline code
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-sm font-mono">$1</code>');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg overflow-x-auto my-3"><code class="text-sm font-mono">$1</code></pre>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">$1</a>');

    // Lists
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>');
    html = html.replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>');

    // Wrap consecutive list items in ul/ol
    html = html.replace(/(&#60;li[\s\S]*?&#60;\/li>)/g, '<ul class="list-disc ml-4 mb-3">$1</ul>');

    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-gray-300 dark:border-slate-600 pl-4 py-2 my-3 bg-gray-50 dark:bg-slate-800 italic">$1</blockquote>');

    // Line breaks
    html = html.replace(/\n/g, '<br />');

    // Clean up nested lists
    html = html.replace(/<\/ul>\s*<ul[^>]*>/g, '');

    // Comprehensive XSS protection with DOMPurify
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'strong', 'b', 'em', 'i', 'u',
        'code', 'pre',
        'a', 'li', 'ul', 'ol',
        'blockquote', 'br', 'p', 'span',
        'div'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      ADD_ATTR: ['target', 'rel'],
      FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
      FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
      USE_PROFILES: { html: true },
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_TRUSTED_TYPE: false
    });
  };

  return (
    <div
      className={`prose prose-gray dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}
