# FlowSync

FlowSync is a collaborative design feedback platform built for modern product and creative teams.

It allows designers, developers, and stakeholders to upload visual assets (UI mockups, banners, social posts), review them together in real time, and receive AI-assisted suggestions to improve clarity, contrast, readability, and overall presentation.

## Why FlowSync?

Most teams still review designs via screenshots in chat, email threads, or static comments inside heavy tools. That creates:

- Fragmented feedback
- No single source of truth for versions
- Slow iteration cycles
- Missing rationale behind changes

FlowSync centralizes this workflow into a lightweight, focused web app that looks and behaves like a real SaaS product.

## Core Features (MVP)

- **Authentication & Teams** – Users can sign up, log in, and join teams.
- **Projects & Assets** – Create projects and upload design files (e.g. PNG/JPEG).
- **Real-time Comments** – Comment on specific assets and see new comments instantly (no refresh).
- **Live Presence** – See who is currently viewing the same asset.
- **AI Suggestions (v1)** – Basic automated checks on uploaded designs (e.g. potential low contrast areas, text too small, cluttered layout).
- **Version History (Lightweight)** – Track multiple uploads for the same design and keep context.

## Tech Stack

**Frontend**
- React (Vite or CRA)
- TypeScript (optional but recommended)
- State management via React Query / Context
- WebSocket client for real-time updates

**Backend**
- Python (FastAPI)
- REST API for core CRUD operations
- WebSockets for real-time collaboration
- SQLAlchemy / Pydantic for models & validation

**Database**
- PostgreSQL

**Storage**
- Local storage in development for uploaded assets
- S3-compatible storage (or similar) planned for production-style deployment

## High-Level Architecture

- The **React frontend** consumes a **FastAPI REST API** for auth, projects, assets, and AI suggestions.
- A **WebSocket channel** is used for real-time comments and presence per project/asset.
- **PostgreSQL** stores users, teams, projects, assets, comments, and suggestion logs.
- The backend exposes an endpoint that runs a simple analysis on uploaded images and returns structured suggestions.


