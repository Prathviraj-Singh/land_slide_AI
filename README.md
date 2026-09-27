# LandslideShield AI 🛡️⛰️

AI-Powered Landslide Early Warning & Risk Management System built with Next.js 14 (App Router, TypeScript).

## Project Structure Overview

- **`app/`**: Next.js App Router route definitions and layouts (thin routing layer, no business logic).
  - `citizen/`: Citizen-facing risk view and report submission.
  - `authority/`: Authority dashboard and zone monitoring.
  - `api/`: Route handlers delegating to backend services.
- **`components/`**: Frontend reusable React components (maps, charts, panels, report forms).
- **`server/`**: Dedicated backend layer (database, service logic, ML inference, external data integrations, email alerts).
- **`ml-training/`**: Isolated offline Python environment for model training and ONNX export (never deployed).
- **`public/`**: Static assets and public resources.
- **`styles/`**: Global styling rules.

## Getting Started

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```
