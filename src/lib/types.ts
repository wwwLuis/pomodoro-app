export interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartNext: boolean;
  soundEnabled: boolean;
  alwaysOnTop: boolean;
  musicEnabled: boolean;
  musicPlaylistUrl: string;
  musicPlaylistId: string;
  musicPlaylistName: string;
  musicVolume: number;
  backupEnabled: boolean;
  backupPath: string;
}

export interface GoogleAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userName: string;
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
  musicEnabled: false,
  musicPlaylistUrl: "",
  musicPlaylistId: "",
  musicPlaylistName: "",
  musicVolume: 50,
  backupEnabled: false,
  backupPath: "",
};
