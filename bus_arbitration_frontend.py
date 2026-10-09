import time
import tkinter as tk
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from bus_arbitration_backend import BusArbitrationModel, DEFAULT_ALGORITHMS


class BusArbitrationApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Bus Arbitration Simulator")
        self.root.geometry("1600x900")
        self.root.configure(bg="#1e1e1e")

        self.model = BusArbitrationModel()
        self.running = False
        self.update_interval = tk.IntVar(value=1000)

        self.create_gui()
        self.update_display()
        self.update_graphs()

    def create_gui(self) -> None:
        self.create_top_controls()
        self.create_main_content()
        self.create_charts()

    def create_top_controls(self) -> None:
        top_frame = tk.Frame(self.root, bg="#1e1e1e")
        top_frame.pack(fill="x", padx=16, pady=10)

        title = tk.Label(
            top_frame,
            text="Bus Arbitration and System Bus Management Simulator",
            font=("Arial", 20, "bold"),
            bg="#1e1e1e",
            fg="cyan"
        )
        title.pack(side="left", padx=8)

        control_frame = tk.Frame(self.root, bg="#1e1e1e")
        control_frame.pack(fill="x", padx=16, pady=8)

        algo_label = tk.Label(
            control_frame,
            text="Algorithm:",
            font=("Arial", 12, "bold"),
            bg="#1e1e1e",
            fg="white"
        )
        algo_label.pack(side="left", padx=(0, 8))

        self.algorithm_var = tk.StringVar(value=self.model.current_algorithm)
        self.algorithm_menu = ttk.Combobox(
            control_frame,
            values=DEFAULT_ALGORITHMS,
            textvariable=self.algorithm_var,
            state="readonly",
            width=24
        )
        self.algorithm_menu.bind("<<ComboboxSelected>>", self.on_algorithm_change)
        self.algorithm_menu.pack(side="left", padx=(0, 16))
        self.algorithm_menu.set(self.model.current_algorithm)

        self.cycle_slider = ttk.Scale(
            control_frame,
            from_=200,
            to=2000,
            variable=self.update_interval,
            orient="horizontal",
            length=220
        )
        self.cycle_slider.pack(side="left", padx=(0, 8))

        self.slider_label = tk.Label(
            control_frame,
            text=f"Interval: {self.update_interval.get()} ms",
            font=("Arial", 12),
            bg="#1e1e1e",
            fg="white"
        )
        self.slider_label.pack(side="left", padx=(0, 20))
        self.update_interval.trace_add("write", self.on_interval_change)

        start_button = tk.Button(
            control_frame,
            text="Start",
            command=self.start_simulation,
            bg="#2ecc71",
            fg="white",
            font=("Arial", 11, "bold"),
            width=10
        )
        start_button.pack(side="left", padx=4)

        stop_button = tk.Button(
            control_frame,
            text="Stop",
            command=self.stop_simulation,
            bg="#e74c3c",
            fg="white",
            font=("Arial", 11, "bold"),
            width=10
        )
        stop_button.pack(side="left", padx=4)

        reset_button = tk.Button(
            control_frame,
            text="Reset",
            command=self.reset_simulation,
            bg="#f39c12",
            fg="black",
            font=("Arial", 11, "bold"),
            width=10
        )
        reset_button.pack(side="left", padx=4)

        report_button = tk.Button(
            control_frame,
            text="Show Report",
            command=self.show_report,
            bg="#3498db",
            fg="white",
            font=("Arial", 11, "bold"),
            width=12
        )
        report_button.pack(side="left", padx=4)

    def create_main_content(self) -> None:
        content_frame = tk.Frame(self.root, bg="#1e1e1e")
        content_frame.pack(fill="both", expand=True, padx=16, pady=(0, 16))

        left_panel = tk.Frame(content_frame, bg="#2b2b2b")
        left_panel.pack(side="left", fill="y", padx=(0, 12), pady=4)

        device_title = tk.Label(
            left_panel,
            text="Devices",
            font=("Arial", 16, "bold"),
            bg="#2b2b2b",
            fg="cyan"
        )
        device_title.pack(pady=(8, 6))

        self.device_frames = {}
        for device in self.model.devices:
            frame = tk.Frame(left_panel, bg="#3a3a3a", bd=2, relief="ridge")
            frame.pack(fill="x", padx=10, pady=8)

            name_label = tk.Label(
                frame,
                text=device.name,
                font=("Arial", 13, "bold"),
                bg="#3a3a3a",
                fg="white"
            )
            name_label.pack(anchor="w", padx=10, pady=(10, 2))

            status_label = tk.Label(
                frame,
                text="Idle",
                font=("Arial", 11),
                bg="#3a3a3a",
                fg="#2ecc71"
            )
            status_label.pack(anchor="w", padx=10)

            wait_label = tk.Label(
                frame,
                text="Waiting Time: 0",
                font=("Arial", 10),
                bg="#3a3a3a",
                fg="#f1c40f"
            )
            wait_label.pack(anchor="w", padx=10)

            priority_label = tk.Label(
                frame,
                text=f"Priority: {device.priority}",
                font=("Arial", 10),
                bg="#3a3a3a",
                fg="#e67e22"
            )
            priority_label.pack(anchor="w", padx=10, pady=(0, 10))

            self.device_frames[device.name] = {
                "frame": frame,
                "status": status_label,
                "wait": wait_label,
                "priority": priority_label,
            }

        self.bus_status_label = tk.Label(
            left_panel,
            text="BUS STATUS: FREE",
            font=("Arial", 16, "bold"),
            bg="#2b2b2b",
            fg="#2ecc71"
        )
        self.bus_status_label.pack(pady=(20, 10))

        log_title = tk.Label(
            left_panel,
            text="System Log",
            font=("Arial", 15, "bold"),
            bg="#2b2b2b",
            fg="cyan"
        )
        log_title.pack(pady=(10, 4))

        self.log_box = ScrolledText(
            left_panel,
            width=44,
            height=20,
            bg="#111111",
            fg="#7bed9f",
            font=("Consolas", 10),
            insertbackground="white"
        )
        self.log_box.pack(padx=10, pady=10)
        self.log_box.configure(state="disabled")

        chart_panel = tk.Frame(content_frame, bg="#1e1e1e")
        chart_panel.pack(side="right", fill="both", expand=True)
        self.chart_panel = chart_panel

    def create_charts(self) -> None:
        self.fig, self.ax = plt.subplots(2, 2, figsize=(10, 7))
        self.fig.patch.set_facecolor("#1e1e1e")
        for axis in self.ax.flat:
            axis.set_facecolor("#1e1e1e")
            axis.tick_params(colors="white")
            for spine in axis.spines.values():
                spine.set_color("white")

        self.canvas = FigureCanvasTkAgg(self.fig, master=self.chart_panel)
        self.canvas.get_tk_widget().pack(fill="both", expand=True)

    def on_algorithm_change(self, event=None) -> None:
        selected = self.algorithm_menu.get()
        self.model.set_algorithm(selected)
        self.log(f"Algorithm changed to: {selected}")

    def on_interval_change(self, *args) -> None:
        self.slider_label.configure(text=f"Interval: {self.update_interval.get()} ms")

    def start_simulation(self) -> None:
        if not self.running:
            self.running = True
            self.log("Simulation Started")
            self.run_cycle()

    def stop_simulation(self) -> None:
        if self.running:
            self.running = False
            self.log("Simulation Stopped")

    def reset_simulation(self) -> None:
        self.stop_simulation()
        self.model.reset()
        self.update_display()
        self.update_graphs()
        self.clear_log()
        self.log("Simulation Reset")

    def show_report(self) -> None:
        report_window = tk.Toplevel(self.root)
        report_window.title("Simulation Report")
        report_window.geometry("650x360")
        report_window.configure(bg="#1e1e1e")

        report_text = ScrolledText(
            report_window,
            bg="#111111",
            fg="white",
            font=("Consolas", 11),
            wrap="none"
        )
        report_text.pack(fill="both", expand=True, padx=10, pady=10)

        df = self.model.get_report_dataframe()
        report_text.insert(tk.END, df.to_string(index=False))
        report_text.configure(state="disabled")

    def run_cycle(self) -> None:
        if not self.running:
            return

        result = self.model.step()
        bus_owner = result["bus_owner"]
        if bus_owner is not None:
            self.log(
                f"{bus_owner.name} acquired the bus with {self.model.current_algorithm}"
            )
        else:
            self.log("No device acquired the bus this cycle.")

        self.update_display()
        self.update_graphs()
        self.root.after(self.update_interval.get(), self.run_cycle)

    def update_display(self) -> None:
        for device in self.model.devices:
            frame_data = self.device_frames[device.name]
            if device is self.model.current_bus_owner:
                frame_data["frame"].config(bg="#00aa00")
                frame_data["status"].config(text="USING BUS", fg="white", bg="#00aa00")
            elif device.requesting:
                frame_data["frame"].config(bg="#aa6600")
                frame_data["status"].config(text="WAITING", fg="white", bg="#aa6600")
            else:
                frame_data["frame"].config(bg="#3a3a3a")
                frame_data["status"].config(text="IDLE", fg="#2ecc71", bg="#3a3a3a")

            frame_data["wait"].config(text=f"Waiting Time: {device.waiting_time}", bg=frame_data["frame"].cget("bg"))
            frame_data["priority"].config(text=f"Priority: {device.priority}", bg=frame_data["frame"].cget("bg"))

        if self.model.current_bus_owner:
            self.bus_status_label.config(text=f"BUS STATUS: {self.model.current_bus_owner.name}", fg="#f1c40f")
        else:
            self.bus_status_label.config(text="BUS STATUS: FREE", fg="#2ecc71")

    def update_graphs(self) -> None:
        for axis in self.ax.flat:
            axis.clear()
            axis.set_facecolor("#1e1e1e")
            axis.tick_params(colors="white")
            for spine in axis.spines.values():
                spine.set_color("white")

        self.ax[0][0].plot(self.model.waiting_times, color="#ff6b6b", linewidth=2)
        self.ax[0][0].set_title("Average Waiting Time", color="white")
        self.ax[0][0].set_xlabel("Cycle", color="white")
        self.ax[0][0].set_ylabel("Waiting Time", color="white")

        self.ax[0][1].plot(self.model.throughput_history, color="#54a0ff", linewidth=2)
        self.ax[0][1].set_title("Throughput", color="white")
        self.ax[0][1].set_xlabel("Cycle", color="white")
        self.ax[0][1].set_ylabel("Completed / Cycle", color="white")

        self.ax[1][0].plot(self.model.utilization_history, color="#1dd1a1", linewidth=2)
        self.ax[1][0].set_title("Bus Utilization", color="white")
        self.ax[1][0].set_xlabel("Cycle", color="white")
        self.ax[1][0].set_ylabel("Utilization %", color="white")

        device_labels = [device.name for device in self.model.devices]
        starvation_values = [device.starvation_count for device in self.model.devices]
        self.ax[1][1].bar(device_labels, starvation_values, color="#feca57")
        self.ax[1][1].set_title("Starvation Count", color="white")
        self.ax[1][1].set_ylabel("Count", color="white")

        self.fig.tight_layout()
        self.canvas.draw()

    def log(self, message: str) -> None:
        self.log_box.configure(state="normal")
        self.log_box.insert(tk.END, f"[{time.strftime('%H:%M:%S')}] {message}\n")
        self.log_box.see(tk.END)
        self.log_box.configure(state="disabled")

    def clear_log(self) -> None:
        self.log_box.configure(state="normal")
        self.log_box.delete(1.0, tk.END)
        self.log_box.configure(state="disabled")


if __name__ == "__main__":
    import time
    root = tk.Tk()
    app = BusArbitrationApp(root)
    root.mainloop()
