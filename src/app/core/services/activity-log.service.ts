import { Injectable, computed, inject, signal } from '@angular/core';

import { ActivityActor, ActivityArea, ActivityLogEntry, ActivityStatus } from '../models/activity-log';
import { ConfigurationService } from './configuration.service';

interface RecordActivityOptions {
  action: string;
  area: ActivityArea;
  status?: ActivityStatus;
  actor?: ActivityActor;
  target?: string;
  details?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private readonly config = inject(ConfigurationService);
  private readonly entriesState = signal<ActivityLogEntry[]>(this.readEntries());

  readonly entries = computed(() => this.entriesState());

  record(options: RecordActivityOptions): void {
    const nextEntry: ActivityLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
      area: options.area,
      action: options.action,
      status: options.status ?? 'info',
      actor: options.actor,
      target: options.target,
      details: options.details,
      metadata: options.metadata
    };

    this.entriesState.update((current) => {
      const next = [nextEntry, ...current].slice(0, this.config.activityLogMaxEntries);
      this.writeEntries(next);
      return next;
    });
  }

  clear(): void {
    this.entriesState.set([]);
    this.writeEntries([]);
  }

  private readEntries(): ActivityLogEntry[] {
    try {
      const raw = globalThis.localStorage?.getItem(this.config.activityLogStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => this.normalizeEntry(item))
        .filter((item): item is ActivityLogEntry => item !== null)
        .slice(0, this.config.activityLogMaxEntries);
    } catch {
      return [];
    }
  }

  private normalizeEntry(value: unknown): ActivityLogEntry | null {
    if (!isObject(value)) {
      return null;
    }

    const id = String(value['id'] ?? '').trim();
    const timestamp = String(value['timestamp'] ?? '').trim();
    const area = String(value['area'] ?? '').trim() as ActivityArea;
    const action = String(value['action'] ?? '').trim();
    const status = String(value['status'] ?? '').trim() as ActivityStatus;

    if (!id || !timestamp || !action || !isArea(area) || !isStatus(status)) {
      return null;
    }

    const actor = isObject(value['actor']) ? this.normalizeActor(value['actor']) : undefined;
    const target = normalizeOptionalString(value['target']);
    const details = normalizeOptionalString(value['details']);
    const metadata = isObject(value['metadata'])
      ? normalizeMetadata(value['metadata'])
      : undefined;

    return {
      id,
      timestamp,
      area,
      action,
      status,
      actor,
      target,
      details,
      metadata
    };
  }

  private normalizeActor(value: Record<string, unknown>): ActivityActor | undefined {
    const actor: ActivityActor = {
      id: Number.isFinite(Number(value['id'])) ? Number(value['id']) : undefined,
      email: normalizeOptionalString(value['email']),
      name: normalizeOptionalString(value['name']),
      role: value['role'] === 'admin' || value['role'] === 'user'
        ? value['role']
        : undefined
    };

    if (!actor.id && !actor.email && !actor.name && !actor.role) {
      return undefined;
    }

    return actor;
  }

  private writeEntries(entries: ActivityLogEntry[]): void {
    try {
      globalThis.localStorage?.setItem(this.config.activityLogStorageKey, JSON.stringify(entries));
    } catch {
      return;
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isArea(value: string): value is ActivityArea {
  return value === 'auth' || value === 'recipes' || value === 'settings' || value === 'admin' || value === 'system';
}

function isStatus(value: string): value is ActivityStatus {
  return value === 'success' || value === 'info' || value === 'warning' || value === 'error';
}

function normalizeOptionalString(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMetadata(
  metadata: Record<string, unknown>
): Record<string, string | number | boolean | null> | undefined {
  const next: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[key] = value;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}
