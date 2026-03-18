export function wsUrl(baseUrl, conversationId, userId) {
  const secure = baseUrl.startsWith("https://");
  const protocol = secure ? "wss://" : "ws://";
  const host = baseUrl.replace(/^https?:\/\//, "");
  return `${protocol}${host}/ws/${encodeURIComponent(conversationId)}/${encodeURIComponent(userId)}`;
}
