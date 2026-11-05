// things that happen, for anything that has to wait on them: 'chapter-begun', 'feedback-sent'
export const events = new EventTarget();
export const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));
export const once = type => new Promise(r => events.addEventListener(type, e => r(e.detail), { once: true }));
