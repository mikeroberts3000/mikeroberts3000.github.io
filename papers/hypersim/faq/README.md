# apple/ml-hypersim issue archive

This folder contains a recovered archive of the GitHub notification conversations found by the Gmail query `subject:"[apple/ml-hypersim]"`.

## Browse it

Open `index.html` directly. The interface supports full-text search, sorting, expandable message histories, and inline issue attachments. Link to a recovered issue with a fragment such as `index.html#issue-49`; the matching conversation expands automatically. It deliberately avoids status and type filters because the email archive may omit lifecycle notifications and every record originated as email. The companion JavaScript data file allows it to work from a local `file://` URL without running a server.

## Data

`issues.json` is the readable source archive. Each conversation preserves its Gmail thread ID, subject, Gmail list text, expected/extracted message counts, and normalized messages with sender, address, date, recipients, and full notification content. Every message also includes `bodyText` and Gmail's visible rich `bodyHtml`, preserving links, lists, quoted text, inline code, and code blocks.

`issues.js` contains the same archive as a JavaScript assignment so browsers can load the archive when `index.html` is opened directly. The web interface sanitizes the saved HTML before displaying it, removes notification-delivery boilerplate, redirects old GitHub issue links to the corresponding local conversation, and loads recovered GitHub attachment URLs inline. Repository, source-code, and other non-issue links retain their original destinations.
