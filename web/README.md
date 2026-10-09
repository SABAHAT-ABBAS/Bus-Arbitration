# Bus Arbitration Simulator (Web)

A React + TypeScript + Tailwind web application that simulates bus arbitration behavior across multiple hardware devices.

## What is included

- `src/App.tsx` — main dashboard layout with controls, live visualizer, and performance charts
- `src/model/simulation.ts` — simulation engine implementing Daisy Chain, Round Robin, Centralized Parallel, and Dynamic Priority arbitration
- `src/types.ts` — strongly typed device and metric definitions
- Tailwind CSS styling with a modern dashboard UI

## Setup

1. Install Node.js and npm from https://nodejs.org/
2. Open this folder in a terminal:
   ```bash
   cd "c:\Users\susma\Desktop\Bus Arbitration\web"
   npm install
   ```
3. Run the app:
   ```bash
   npm run dev
   ```

## Notes

- The simulation includes dynamic request generation, hold-time execution, waiting counters, and starvation tracking.
- Adjustable controls are available for algorithm selection, clock speed, traffic intensity, and device parameters.
