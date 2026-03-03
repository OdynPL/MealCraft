import { UserRole } from './auth';

export type ActivityArea = 'auth' | 'recipes' | 'settings' | 'admin' | 'system';
export type ActivityStatus = 'success' | 'info' | 'warning' | 'error';

export interface ActivityActor {
  id?: number;
  email?: string;
  name?: string;
  role?: UserRole;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  area: ActivityArea;
  action: string;
  status: ActivityStatus;
  actor?: ActivityActor;
  target?: string;
  details?: string;
  metadata?: Record<string, string | number | boolean | null>;
}
