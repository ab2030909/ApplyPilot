// Background service worker: context-menu "Save job" and first-run onboarding.
import { ApplicationService } from '../services/ApplicationService';
import { sanitizeJobText } from '../services/JobService';
import type { PageInfo } from '../services/FieldDetectionService';

const MENU_ID = 'applypilot-save-job';

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: 'Save this job to ApplyPilot', contexts: ['page', 'selection'] });
  });
  if (details.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('index.html#/overview') });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => (window as any).__applypilot?.pageInfo() ?? null });
    const page = res[0]?.result as PageInfo | null;
    if (!page) throw new Error('no page info');
    await ApplicationService.add({
      title: sanitizeJobText(page.title, 200),
      company: sanitizeJobText(page.company, 200),
      location: sanitizeJobText(page.location, 200),
      url: page.url,
      description: sanitizeJobText(page.description),
      status: 'Saved',
    });
    chrome.action.setBadgeBackgroundColor({ color: '#FF6B35' });
    chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2500);
  } catch {
    chrome.action.setBadgeText({ text: '!', tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2500);
  }
});
