const list = document.querySelector('#issue-list');
const empty = document.querySelector('#empty');
const search = document.querySelector('#search');
const sort = document.querySelector('#sort');
let conversations = [];

function localIssueNumber(href) {
  try {
    const url = new URL(href, location.href);
    if (url.hostname !== 'github.com') return null;
    const match = url.pathname.match(/^\/(?:apple|apple-aiml-research)\/ml-hypersim\/(?:issues|pull)\/(\d+)/i);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function isIssueAttachment(href) {
  try {
    const url = new URL(href, location.href);
    return (url.hostname === 'github.com' && url.pathname.startsWith('/user-attachments/assets/'))
      || /^(?:private-)?user-images\.githubusercontent\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function linkedIssueNumber() {
  const queryNumber = new URLSearchParams(location.search).get('issue');
  const hashMatch = location.hash.match(/^#(?:issue-)?(\d+)$/i);
  const value = queryNumber || hashMatch?.[1];
  return /^\d+$/.test(value || '') ? Number(value) : null;
}

function normalize(conversation) {
  const subject = conversation.subject || 'Untitled conversation';
  const joined = (conversation.messages || []).map((message) => `${message.content || ''}\n${message.bodyText || ''}`).join('\n');
  const match = subject.match(/\((?:(Issue|Pull Request|Pull request|PR)\s*)?#(\d+)\)/i);
  const number = match ? Number(match[2]) : null;
  const kind = !match ? 'other' : /pull request|\bPR\b/i.test(match[1] || '') || (!match[1] && /\bpull request\b|merged commit|files changed/i.test(joined)) ? 'pull' : 'issue';
  const title = subject.replace(/^(?:Re:\s*)?\[apple\/ml-hypersim\]\s*/i, '').replace(/\s*\((?:(?:Issue|Pull Request|Pull request|PR)\s*)?#\d+\)\s*$/i, '');
  const first = conversation.messages?.[0];
  const last = conversation.messages?.at(-1);
  return { ...conversation, subject, title, number, kind, first, last, haystack: `${subject}\n${conversation.listText}\n${joined}`.toLowerCase() };
}

function mergeSplitThreads(rawConversations) {
  const merged = [];
  const byNumber = new Map();
  rawConversations.map(normalize).forEach((item) => {
    if (item.number === null || !byNumber.has(item.number)) {
      merged.push(item);
      if (item.number !== null) byNumber.set(item.number, item);
      return;
    }
    const target = byNumber.get(item.number);
    target.messages = [...(item.messages || []), ...(target.messages || [])];
    target.first = target.messages[0];
    target.last = target.messages.at(-1);
    target.haystack += `\n${item.haystack}`;
  });
  return merged;
}

function richBody(message) {
  const body = document.createElement('div');
  body.className = 'message-body';
  if (!message.bodyHtml) {
    body.textContent = message.bodyText || message.content || '(No message text recovered)';
    return body;
  }

  const template = document.createElement('template');
  template.innerHTML = message.bodyHtml;
  template.content.querySelectorAll('strong').forEach((author) => {
    const banner = author.parentElement;
    const isActivityBanner = /\b(?:created an issue|left a comment|opened a pull request|commented)\b/i.test(banner?.textContent || '');
    const hasIssueLink = [...(banner?.children || [])].some((child) => child.tagName === 'A' && /apple\/ml-hypersim#\d+/i.test(child.textContent));
    if (banner && isActivityBanner && hasIssueLink) banner.remove();
  });
  template.content.querySelectorAll('p').forEach((node) => {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    const isDeliveryFooter = text.includes('You are receiving this because') || (text.includes('Reply to this email directly') && text.includes('unsubscribe'));
    const isMobileFooter = text.includes('Triage notifications on the go with GitHub Mobile');
    const isMalformedEmptyLink = /^\]\(\s*url\s*\)$/i.test(text);
    if (isDeliveryFooter || isMobileFooter || isMalformedEmptyLink) node.remove();
  });
  template.content.querySelectorAll('[style]').forEach((node) => {
    const style = node.getAttribute('style').replace(/\s/g, '').toLowerCase();
    if (style.includes('display:none') || style.includes('visibility:hidden') || style.includes('opacity:0') || style.includes('font-size:0')) node.remove();
  });
  template.content.querySelectorAll('img[data-emoji]').forEach((node) => node.replaceWith(document.createTextNode(node.alt || '')));
  template.content.querySelectorAll('script, style, iframe, object, embed, form, input, button, meta, base, link, svg, img, wbr, .adM, .adL, .HOEnZb, .yj6qo, .ajU, .adm').forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || ['id', 'class', 'src', 'srcset', 'srcdoc', 'style', 'color', 'face', 'size', 'bgcolor', 'data-saferedirecturl'].includes(name)) {
        node.removeAttribute(attribute.name);
      } else if (name === 'href' && !/^(https?:|mailto:)/i.test(value)) {
        node.removeAttribute(attribute.name);
      }
    }
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      const href = node.href;
      const issueNumber = localIssueNumber(href);
      if (issueNumber !== null) {
        node.href = `#issue-${issueNumber}`;
        node.target = '_self';
        node.removeAttribute('rel');
      } else {
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
      }
    }
  });
  template.content.querySelectorAll('a[href]').forEach((captionLink) => {
    if (!isIssueAttachment(captionLink.href)) return;
    const href = captionLink.href;
    const label = captionLink.textContent.replace(/\s*\(view on web\)\.?\s*$/i, '').trim() || 'Issue attachment';
    const wrapper = document.createElement('span');
    wrapper.className = 'issue-attachment';
    const imageLink = document.createElement('a');
    imageLink.href = href;
    imageLink.target = '_blank';
    imageLink.rel = 'noopener noreferrer';
    const image = document.createElement('img');
    image.src = href;
    image.alt = label;
    image.loading = 'lazy';
    image.decoding = 'async';
    imageLink.append(image);
    captionLink.replaceWith(wrapper);
    wrapper.append(imageLink);
  });
  body.append(template.content);
  if (!body.textContent.trim()) {
    const note = document.createElement('p');
    note.className = 'empty-message';
    note.textContent = 'No description was present in the recovered notification.';
    body.append(note);
  }
  return body;
}

function messagesForDisplay(messages = []) {
  const isClosure = (message) => /^\s*Closed\s+#\d+\b/i.test(message.content || message.bodyText || '');
  const ordered = [];
  for (let index = 0; index < messages.length;) {
    const date = messages[index].date;
    const group = [];
    while (index < messages.length && messages[index].date === date) group.push(messages[index++]);
    ordered.push(...group.filter((message) => !isClosure(message)), ...group.filter(isClosure));
  }
  return ordered;
}

function issueElement(item) {
  const article = document.createElement('article');
  article.className = 'issue';
  article.dataset.index = item.index;
  if (item.number) article.id = `issue-${item.number}`;

  const row = document.createElement('div');
  row.className = 'issue-row';
  const heading = document.createElement('div');
  const button = document.createElement('button');
  button.className = 'issue-toggle';
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  const author = item.first?.sender || 'GitHub';
  const when = item.first?.date ? ` · ${item.first.date}` : '';
  button.innerHTML = '<span class="issue-title"></span>';
  button.querySelector('.issue-title').textContent = item.title;
  const meta = document.createElement('span');
  meta.className = 'meta';
  if (item.number) {
    const permalink = document.createElement('a');
    permalink.className = 'issue-permalink';
    permalink.href = `#issue-${item.number}`;
    permalink.textContent = `#${item.number}`;
    permalink.addEventListener('click', () => requestAnimationFrame(() => expandLinkedConversation({ scroll: true })));
    meta.append(permalink, document.createTextNode(' · '));
  }
  meta.append(document.createTextNode(`${author}${when}`));
  heading.append(button, meta);
  const messageCount = item.messages?.length || 0;
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = `${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`;
  row.append(heading, count);

  const conversation = document.createElement('div');
  conversation.className = 'conversation';
  conversation.hidden = true;
  messagesForDisplay(item.messages).forEach((message, index) => {
    const block = document.createElement('section');
    block.className = 'message';
    const head = document.createElement('div');
    head.className = 'message-head';
    const sender = document.createElement('strong');
    sender.textContent = message.sender || message.email || 'Unknown sender';
    head.append(sender, document.createTextNode(` ${index === 0 ? 'opened this conversation' : 'replied'} · ${message.date || 'date unavailable'}`));
    const body = richBody(message);
    block.append(head, body);
    conversation.append(block);
  });

  button.addEventListener('click', () => {
    conversation.hidden = !conversation.hidden;
    button.setAttribute('aria-expanded', String(!conversation.hidden));
  });
  article.append(row, conversation);
  return article;
}

function expandLinkedConversation({ scroll = false } = {}) {
  const number = linkedIssueNumber();
  if (number === null) return;
  const article = document.querySelector(`#issue-${number}`);
  if (!article) return;
  const conversation = article.querySelector('.conversation');
  const button = article.querySelector('.issue-toggle');
  conversation.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  if (scroll) requestAnimationFrame(() => article.scrollIntoView({ block: 'start' }));
}

function render() {
  const query = search.value.trim().toLowerCase();
  let filtered = conversations.filter((item) => !query || item.haystack.includes(query));
  filtered.sort((a, b) => sort.value === 'oldest' ? b.index - a.index : sort.value === 'number-desc' ? (b.number ?? -1) - (a.number ?? -1) : sort.value === 'number-asc' ? (a.number ?? Infinity) - (b.number ?? Infinity) : a.index - b.index);
  list.replaceChildren(...filtered.map(issueElement));
  empty.hidden = filtered.length !== 0;
  document.querySelector('#visible-count').textContent = filtered.length;
  document.querySelector('#state-summary').textContent = '';
  expandLinkedConversation();
}

for (const control of [search, sort]) control.addEventListener('input', render);
document.querySelector('#expand-all').addEventListener('click', () => document.querySelectorAll('.conversation').forEach((node) => { node.hidden = false; node.parentElement.querySelector('.issue-toggle').setAttribute('aria-expanded', 'true'); }));
document.querySelector('#collapse-all').addEventListener('click', () => document.querySelectorAll('.conversation').forEach((node) => { node.hidden = true; node.parentElement.querySelector('.issue-toggle').setAttribute('aria-expanded', 'false'); }));
window.addEventListener('hashchange', () => {
  if (linkedIssueNumber() === null) return;
  if (!document.querySelector(location.hash)) {
    search.value = '';
    render();
  }
  expandLinkedConversation({ scroll: true });
});

function loadArchive(data) {
    conversations = mergeSplitThreads(data.conversations);
    document.querySelector('#archive-summary').textContent = `${conversations.length} conversations · ${data.summary.githubNotificationMessages} messages`;
    render();
    expandLinkedConversation({ scroll: true });
}

if (window.HYPERSIM_ISSUES) {
  loadArchive(window.HYPERSIM_ISSUES);
} else if (location.protocol !== 'file:') {
  fetch('./hypersim-issues.json')
    .then((response) => { if (!response.ok) throw new Error(`${response.status} ${response.statusText}`); return response.json(); })
    .then(loadArchive)
    .catch((error) => {
      empty.hidden = false;
      empty.textContent = `Could not load the archive: ${error.message}`;
    });
} else {
    empty.hidden = false;
    empty.textContent = 'The archive data file has not been generated yet.';
    document.querySelector('#archive-summary').textContent = 'Data file missing';
}
