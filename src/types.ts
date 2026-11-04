export type PriorityLevel = 'p1' | 'p2' | 'p3';
export type TaskCategory = 'kerja' | 'pribadi' | 'belajar' | 'keuangan' | 'kesehatan' | 'lainnya';
export type PlanHorizon = 'mingguan' | 'bulanan' | 'q1' | 'tahunan';
export type PlanStatus = 'progress' | 'draft' | 'hold' | 'achieved';
export type RecurringInterval = 'none' | 'daily' | 'weekly' | 'monthly';

export interface TaskEntity {
  id: string;
  title: string;
  notes: string;
  date: string;
  time: string;
  hasAlarm: boolean;
  priority: PriorityLevel;
  category: TaskCategory;
  recurring: RecurringInterval;
  done: boolean;
  createdAt: string;
}

export interface SubtaskEntity {
  title: string;
  done: boolean;
}

export interface PlanEntity {
  id: string;
  title: string;
  notes: string;
  date: string;
  horizon: PlanHorizon;
  status: PlanStatus;
  subtasks: SubtaskEntity[];
  createdAt: string;
}

export interface AppConfig {
  activeDomain: 'tugas' | 'planning';
  activeSubFilter: string;
  activeView: string;
  searchQuery: string;
  soundEnabled: boolean;
  theme: 'dark' | 'light';
  streakCount: number;
  lastStreakDate: string;
}

