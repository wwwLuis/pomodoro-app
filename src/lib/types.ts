export interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartNext: boolean;
  soundEnabled: boolean;
  alwaysOnTop: boolean;
}

export interface Task {
  id: string;
  name: string;
  completedPomodoros: number;
  targetPomodoros: number;
  createdAt: number;
  completed: boolean;
}

export interface PomodoroSession {
  id: string;
  taskId: string | null;
  type: SessionType;
  startedAt: number;
  completedAt: number;
  duration: number;
}

export type TimerState = "idle" | "running" | "paused";
export type SessionType = "work" | "shortBreak" | "longBreak";

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: false,
  soundEnabled: true,
  alwaysOnTop: false,
};
