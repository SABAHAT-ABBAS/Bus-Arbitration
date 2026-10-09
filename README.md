# Bus Arbitration Simulator

**Explore how competing hardware devices share a system bus, one arbitration cycle at a time.**

[![License](https://img.shields.io/badge/license-TBD-lightgrey.svg)](#license)
[![Tech Stack](https://img.shields.io/badge/stack-React%20%7C%20TypeScript%20%7C%20Vite-3178C6.svg)](#technology-stack)
[![Live Demo](https://img.shields.io/badge/live%20demo-not%20published-lightgrey.svg)](#live-demo)

## About the Project

A system bus may be requested by a processor, memory controller, DMA controller, or peripheral at the same time. Before any requester can transfer data, an arbitration policy must select one bus master. That policy affects throughput, waiting time, fairness, implementation cost, and the possibility that a low-priority device waits indefinitely.

The **Bus Arbitration Simulator** makes those tradeoffs visible. Its browser-based simulator generates device requests and advances a configurable, cycle-level model. Animated bus schematics show arbitration and busy signals, while live metrics and charts help compare the behavior of different policies. A separate Python/Tkinter desktop simulator is also included.

The models are intended for learning and experimentation. They are abstractions for comparing arbitration behavior, not timing-accurate hardware implementations.

## Technology Stack

- **Web:** React 18, TypeScript, Vite, Tailwind CSS
- **Charts and icons:** Recharts and Lucide React
- **Desktop:** Python, Tkinter, Matplotlib, NumPy, and pandas

## Live Demo

No hosted demo URL is configured yet. Add the deployment URL here when the web app is published.

## Arbitration Schemes Covered

| Scheme | How the model selects a requester | Hardware complexity | Latency and fairness | Central failure risk | Signal / wiring overhead |
| --- | --- | --- | --- | --- | --- |
| **Daisy Chain** | The grant propagates serially through devices in their displayed order; the first requesting device captures it. | Low | Arbitration can take longer as the grant propagates. Fixed physical order favors earlier devices and can starve later ones. | Central arbiter failure prevents grants; a broken link can also interrupt downstream propagation. | Low: shared request/busy signaling and a serial grant path. |
| **Round Robin** | A centralized arbiter scans cyclically from the position after the previous grant. | Moderate | Bounded cyclic priority gives requesters a fairer opportunity under sustained contention; scan position influences wait time. | Central arbiter failure prevents arbitration. | Moderate: shared arbitration logic and a grant path. |
| **Centralized Fixed Priority** | The arbiter grants the requesting device with the highest configured base priority. | Moderate | A direct priority decision can be quick; lower-priority devices may starve under continuous higher-priority traffic. | Central arbiter failure prevents arbitration. | Moderate: independent request inputs and a decoded grant. |
| **Centralized Parallel** | The model chooses among simultaneous requests by priority, then waiting time, then hold duration; the visualizer displays encoder/decoder activity. | High | Parallel evaluation supports a fast decision as requester count grows, at the cost of more arbitration logic. Priority bias may remain. | Central arbiter failure prevents arbitration. | High: parallel request lines and encoded grant/decoder signals. |
| **Dynamic Priority** | A score combines base priority, waiting time, and recent request frequency: `base priority + alpha * waiting time - beta * request frequency`. | Moderate to high | Aging can improve access for long-waiting devices; the traffic-frequency penalty also changes preference. Fairness depends on weights and workload. | Central arbiter failure prevents arbitration. | Moderate: centralized policy logic plus request state/history. |

These are qualitative architectural tradeoffs, not measured guarantees. In particular, the simulator's Dynamic Priority method is an aging/request-frequency policy; **LRU arbitration is not currently implemented**.

## Features and Capabilities

- Choose among five arbitration policies and inspect the selected policy's hardware view.
- Run automatically, pause, advance one cycle at a time, or reset the simulation.
- Set the cycle interval, maximum cycle count, and global request traffic intensity.
- Tune each built-in device's request rate, bus hold duration, and base priority.
- Watch device request, bus-use, waiting, completion, and starvation states update live.
- Inspect animated request/grant/busy signal paths, including daisy-chain propagation and centralized arbitration schematics.
- Track elapsed cycles, throughput, bus utilization, and average waiting time.
- Review utilization, throughput/wait-time, and starvation charts as the run progresses.
- Adjust `alpha` (waiting-time aging) and `beta` (request-frequency penalty) for Dynamic Priority.

The current web UI uses a fixed set of built-in devices. It does not yet provide device addition/removal or an exportable signal trace/timing log.

## Project Architecture

```text
.
|-- README.md
|-- Bus Arbitration.py              # Python desktop app entry point
|-- bus_arbitration_backend.py      # Python simulation model
|-- bus_arbitration_frontend.py     # Tkinter desktop UI and charts
|-- requirements.txt               # Python dependencies
`-- web/
    |-- index.html
    |-- package.json
    |-- vite.config.ts
    |-- tailwind.config.js
    |-- postcss.config.js
    |-- tsconfig.json
    `-- src/
        |-- App.tsx                  # Web dashboard and visualizer
        |-- index.css
        |-- main.tsx
        |-- types.ts                 # Shared simulation types
        `-- model/
            `-- simulation.ts        # Web simulation engine
```

## Getting Started

### Web application

**Prerequisites:** Node.js 18 or newer and npm.

```bash
git clone <repository-url>
cd <repository-directory>/web
npm install
npm run dev
```

Open the local URL printed by Vite (by default, `http://localhost:4173`). Run a production build with:

```bash
npm run build
```

To serve the generated build locally for a production-style preview:

```bash
npm run preview
```

### Python desktop application

**Prerequisites:** Python 3.9 or newer with Tkinter available. On some Linux distributions, Tkinter must be installed through the system package manager.

From the repository root:

```bash
python -m venv .venv
```

Activate the environment, then install and launch:

```bash
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python "Bus Arbitration.py"
```

```bash
# macOS / Linux
source .venv/bin/activate
python -m pip install -r requirements.txt
python "Bus Arbitration.py"
```

## Simulation Guide

1. Start the web app, select an arbitration scheme, and adjust global traffic or device request rates to create the contention level you want to study.
2. Choose **Start** for automatic cycles or **Step Forward** to inspect cycle-by-cycle decisions. Use **Pause** to hold the current state and **Reset** to begin again.
3. Follow the active requests and grant/busy signals in the visualizer, then compare throughput, waiting time, utilization, and starvation indicators in the dashboard.

Request generation is probabilistic, so separate runs with the same settings can produce different results. For a meaningful comparison, use similar traffic settings and run lengths across policies; repeated runs are preferable when drawing conclusions.

## Roadmap

- Add and remove devices from the web interface.
- Export cycle-by-cycle signal traces and timing diagrams.
- Add additional arbitration policies, such as explicit LRU, with configurable priority rules.
- Add repeatable seeded workloads to make policy comparisons reproducible.
- Expand automated tests for arbitration decisions and metric calculations.

## Contributing

Contributions are welcome. To propose a change:

1. Open an issue describing the behavior, bug, or enhancement.
2. Create a focused branch and keep changes scoped to the relevant simulator or documentation.
3. Add or update tests for changes to arbitration behavior or metrics.
4. Run the web production build with `npm run build`; for Python changes, verify the desktop application and affected model behavior.
5. Submit a pull request with a concise summary, verification steps, and screenshots for user-interface changes where useful.

Please keep the web and Python implementations' behavior clearly distinguished when they differ, and avoid presenting an educational simulation as cycle-accurate hardware.

## License

No license has been specified in this repository yet. Add a `LICENSE` file and replace the badge above once the project license is chosen. Until then, reuse and redistribution permissions are not granted by this README.

## Author

**Author:** Add author name or organization here.