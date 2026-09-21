<div align="center">

# Sentria

### Cybersecurity incident triage, correlation, and intelligence

Turn messy security reports into structured incidents that security teams can understand, prioritize, and act on.

**Live Application:** [sentria-app.vercel.app](https://sentria-app.vercel.app) | **GitHub:** [raymondstudio/sentria](https://github.com/raymondstudio/sentria)

<br />

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Gen%20AI-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)
[![Zod](https://img.shields.io/badge/Validation-Zod-3E67B1?style=flat-square)](https://zod.dev/)

<br />

**Government & Public Sector · Cybersecurity · AI-assisted Incident Intelligence**

</div>

---

## Overview

Security incidents rarely arrive as clean SOC alerts.

They arrive as emails, WhatsApp messages, forwarded screenshots, helpdesk complaints, fragments of conversations, and reports written by people who may not know what information matters.

One report might say:

> "I got a message from ICT saying my account will be blocked if I don't verify it. There was a link."

Another might contain a screenshot with the important URL buried inside it.

A third might describe the same campaign in completely different words.

Sentria takes these raw reports and turns them into structured security intelligence.

It identifies what happened, estimates how serious the incident is, extracts technical indicators, detects sensitive information, recommends where the incident should go, and groups reports that appear to describe the same underlying event.

The result is a security queue organized around **risk and relevance**, rather than simply the order in which messages arrived.

---

## Why Sentria exists

The first report of a cyber incident is often the least structured piece of information in the investigation.

The reporter may not know:

- what type of attack occurred
- whether the incident is serious
- which technical details matter
- who should receive the report
- whether someone else has already reported the same event
- which personal information should be removed before the report is shared

That creates a difficult triage problem.

A security team can receive multiple reports describing one incident, while a genuinely urgent account compromise waits behind routine phishing reports.

Sentria is designed to reduce that manual triage burden by turning unstructured reports into a consistent incident representation.

---

## What Sentria does

```text
                 Raw security evidence
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Messages       Reports       Screenshots
          │              │              │
          └──────────────┼──────────────┘
                         ↓
                 ┌───────────────┐
                 │    SENTRIA    │
                 │               │
                 │ Normalization │
                 │ Classification│
                 │ Severity      │
                 │ Extraction    │
                 │ Privacy       │
                 │ Correlation   │
                 │ Routing       │
                 └───────┬───────┘
                         ↓
                Structured incident
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
       Priority       Related        Assigned
        queue         reports          team
```

---

## Key Features

- **Adversarial Hardening**: Defends against prompt-injection via XML-sandboxing incident evidence during AI inference.
- **Privacy-aware Sanitization**: Automatically scrubs PII (names, phone numbers, account identifiers) while retaining technical IoCs.
- **File-system Persistence**: Stores incidents natively via a robust FileSystem repository (supports Vercel serverless deployments via `/tmp` directory).
- **Incident Correlation**: Dynamically maps repeated patterns and automatically clusters overlapping campaigns.
- **Evaluation Dashboard**: Contains 159 labelled, synthetic ground-truth cases demonstrating 90%+ classification accuracy across formal, informal, and pidgin dialects.
- **Dynamic UX**: Features a glowing severity-driven color system and real-time dashboard state updates.

---

## Local Deployment

1. **Clone & Install Dependencies:**
   ```bash
   npm install
   ```
2. **Environment Setup:**
   Create a `.env` file with your Google Gemini API key:
   ```env
   GEMINI_API_KEY="your-api-key"
   ```
3. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to view the application.

## Vercel Deployment

Sentria runs on Vercel out-of-the-box. For permanent persistent storage in production, it integrates with Upstash Redis (Serverless). When running locally without environment variables, it automatically falls back to a file-system JSON store (`.incident-store/`).