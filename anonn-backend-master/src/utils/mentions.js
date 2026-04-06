/**
 * Parses @mentions from comment content.
 * Returns a deduplicated array of mentioned usernames (without the @ prefix).
 */
export function parseMentions(content) {
    const matches = content.match(/@([a-zA-Z0-9_]+)/g) || [];
    return [...new Set(matches.map(m => m.slice(1)))];
}
