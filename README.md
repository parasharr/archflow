# ArchFlow AI

**ArchFlow AI** is an AI-powered System Design Dashboard & Motion-Graphics Flowchart Explainer Studio built with Next.js, `shadcn/ui`, Mermaid.js, and Firebase.

Describe any project—full-stack web apps, mobile apps, backend/microservices, AI/ML pipelines, IoT/hardware systems, or business workflows—and generate complete architectures, every individual flow, interactive zoomable diagrams, and narrated explainer videos.

---

## Features

- **Dashboard UI (`shadcn/ui`)**
  - Collapsible sidebar navigation (**Overview**, **Design Studio**, **Saved Designs**, **AI Providers & Settings**)
  - Dashboard Overview with KPI cards and recent cloud-saved architectures
- **AI System Design Studio (`/studio`)**
  - Supports any project type with configurable **Target Scale** and **Focus Area**
  - Generates an **Overall System Architecture**, **Every Flow** (individual Mermaid flowcharts + step-by-step walkthroughs), **Components**, and **Tradeoffs**
  - Multi-provider AI support: **Pollinations AI** (no key required), **Google Gemini 2.5 Flash**, **Groq Llama 3.3 70B**, and **OpenRouter Free Models**
- **Interactive Zoomable Diagrams**
  - Scroll to zoom (`40%`–`300%`), drag to pan, fullscreen modal view, animated data-flow arrows, step-by-step **Simulate** playback, Mermaid source view, copy, and SVG export
- **AI Flowchart Explainer Video**
  - Generates a scene-by-scene AI narration script (`/api/video`) covering every step
  - Renders a `1280×720` motion-graphics presentation on HTML5 Canvas with per-node camera zoom & pan, glowing HUD brackets, data-packet trails, a live mini radar map, step checklist, kinetic subtitles, and audio equalizer bars
  - Natural browser `speechSynthesis` AI voiceover synced to each step, playback speed (`0.75x`–`1.5x`), clickable step pills, persistent caching (**View Video**), and **Download Video (`.webm`)** export
- **Firebase Authentication & Cloud Persistence**
  - **Google Sign-In** and **Email & Password** login/registration
  - Stores user profiles in Firestore `users/{uid}` and saved projects (including User ID and generated video storyboards) in Firestore `projects`
  - Includes [firestore.rules](firestore.rules) for owner-scoped security

---

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS v4, `shadcn/ui` (`base-nova`), Lucide Icons
- **Diagrams & Video**: Mermaid.js, HTML5 Canvas (`captureStream` + `MediaRecorder`), Web Speech API (`speechSynthesis`)
- **Backend & Cloud**: Next.js Route Handlers (`/api/design`, `/api/video`), Firebase Auth, Cloud Firestore, Firebase Analytics

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your Firebase web app config (and any optional AI provider keys):

```env
# Optional Free AI API Keys (Pollinations AI works with no key)
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=

# Firebase Web App Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

### 3. Configure Firebase

1. In **Firebase Console → Authentication → Sign-in method**, enable **Email/Password** and **Google**.
2. In **Firebase Console → Firestore Database → Rules**, paste the contents of [firestore.rules](firestore.rules) and click **Publish**.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```text
app/
├── api/
│   ├── design/route.ts       # Multi-provider AI system design & flows API
│   └── video/route.ts        # AI step-by-step video storyboard API
├── components/
│   ├── AppSidebar.tsx        # Dashboard sidebar navigation
│   ├── AuthDialog.tsx        # Google & Email/Password login/register modal
│   ├── AuthProvider.tsx      # Firebase Auth state & users collection sync
│   ├── DashboardShell.tsx    # Top bar & sidebar layout shell
│   ├── DesignProvider.tsx    # Cloud projects, video cache & provider settings
│   ├── FlowVideoPlayer.tsx   # Motion-graphics Canvas video player & .webm exporter
│   └── MermaidDiagram.tsx    # Zoomable, pannable & simulatable Mermaid viewer
├── history/page.tsx          # Saved Designs table (cloud projects + User ID)
├── settings/page.tsx         # AI Providers, API keys & studio defaults
├── studio/page.tsx           # Project Prompt & interactive design canvas
├── layout.tsx                # Root layout with providers
└── page.tsx                  # Dashboard Overview
lib/
├── designs.ts                # Shared types, providers & chart hash helper
└── firebase.ts               # Firebase App, Auth, Firestore & Analytics init
firestore.rules               # Firestore security rules for users & projects
```

---

## Scripts

- `npm run dev` — Start development server
- `npm run lint` — Run ESLint
- `npx next build --webpack` — Production build
