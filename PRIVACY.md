# ApplyPilot AI: Privacy Policy

_Last updated: November 2026_

ApplyPilot AI is a browser extension that helps you fill in job applications, write cover letters and track your applications. This policy explains what data it handles and where that data goes.

## What is stored, and where

| Data | Where it is stored |
|---|---|
| Profile (name, contact details, education, experience, skills, projects) | Your browser only (`chrome.storage.local`) |
| Resumes (files and extracted text) | Your browser only (IndexedDB) |
| Tracked applications, cover letters, saved answers, activity log | Your browser only |
| Settings (backend URL, AI consent, autofill preferences) | Your browser only |

ApplyPilot has no user accounts. We do not run a database of users and do not receive your stored data.

## When data leaves your browser

Data is sent **only when you click an AI action** (Analyze, Match, Optimize, Generate cover letter, Generate answer, Extract profile), and **only after you turn on "Allow AI processing"**. When you do:

- The text that action needs (the job description, plus your profile or resume text where relevant) goes over HTTPS to the ApplyPilot backend set in Settings.
- The backend forwards it to [Groq](https://groq.com/privacy-policy/) to generate the result and returns the result to you. The backend does not store requests or log their contents.

Nothing is sent in the background. Autofill, field detection and resume text extraction all run locally in your browser.

## Web page access

When you open the popup on a page, the extension reads that page to find form fields. It also reads the job posting text when you click Analyze or Save job. Page content is treated as untrusted. Instructions found inside job descriptions are never followed. The extension **never submits a form** for you.

## What we don't do

- We don't sell or share your data, and we don't use it for advertising.
- We don't store passwords or login details.
- We don't track your browsing history.

## Your controls

Settings → Data lets you export everything as JSON, or delete your profile, resumes, applications or all data at any time. Uninstalling the extension also removes all locally stored data.

## Contact

Questions: open an issue in the project repository, or email the maintainer listed on the Chrome Web Store page.
