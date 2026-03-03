import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ActivityLogComponent } from './activity-log';
import { ActivityLogEntry } from '../../../core/models/activity-log';
import { ActivityLogService } from '../../../core/services/activity-log.service';

class MockActivityLogService {
  private readonly entriesState = signal<ActivityLogEntry[]>([]);
  readonly entries = computed(() => this.entriesState());

  clear = vi.fn(() => {
    this.entriesState.set([]);
  });

  setEntries(entries: ActivityLogEntry[]): void {
    this.entriesState.set(entries);
  }
}

class MockMatDialog {
  open = vi.fn().mockReturnValue({
    afterClosed: () => of(true)
  });
}

describe('ActivityLogComponent', () => {
  let component: ActivityLogComponent;
  let fixture: ComponentFixture<ActivityLogComponent>;
  let activityLog: MockActivityLogService;
  let dialog: MockMatDialog;

  const entries: ActivityLogEntry[] = [
    {
      id: '1',
      timestamp: new Date('2026-03-01T10:00:00Z').toISOString(),
      area: 'admin',
      action: 'user-update',
      status: 'success',
      actor: { name: 'Admin One', email: 'admin@test.com' },
      details: 'Updated user profile'
    },
    {
      id: '2',
      timestamp: new Date('2026-03-01T11:00:00Z').toISOString(),
      area: 'auth',
      action: 'login-failed',
      status: 'warning',
      actor: { email: 'user@test.com' },
      details: 'Invalid password'
    },
    {
      id: '3',
      timestamp: new Date('2026-03-01T12:00:00Z').toISOString(),
      area: 'recipes',
      action: 'recipe-create',
      status: 'info',
      actor: { name: 'Chef' },
      details: 'Created recipe'
    }
  ];

  beforeEach(async () => {
    const activityLogMock = new MockActivityLogService();
    activityLogMock.setEntries(entries);
    const dialogMock = new MockMatDialog();

    await TestBed.configureTestingModule({
      imports: [ActivityLogComponent],
      providers: [
        { provide: ActivityLogService, useValue: activityLogMock },
        { provide: MatDialog, useValue: dialogMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityLogComponent);
    component = fixture.componentInstance;
    activityLog = TestBed.inject(ActivityLogService) as unknown as MockActivityLogService;
    dialog = TestBed.inject(MatDialog) as unknown as MockMatDialog;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter entries by search, area and status', () => {
    (component as any).onSearch({ target: { value: 'invalid password' } } as unknown as Event);
    expect((component as any).filteredEntries().length).toBe(1);

    (component as any).setAreaFilter('auth');
    expect((component as any).filteredEntries().length).toBe(1);

    (component as any).setStatusFilter('warning');
    expect((component as any).filteredEntries()[0].id).toBe('2');
  });

  it('should paginate entries', () => {
    (component as any).setPageSize('2');
    expect((component as any).pagedEntries().length).toBe(2);

    (component as any).nextPage();
    expect((component as any).pageIndex()).toBe(1);
    expect((component as any).pagedEntries().length).toBe(1);

    (component as any).prevPage();
    expect((component as any).pageIndex()).toBe(0);
  });

  it('should clear log when confirmed', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    (component as any).dialog = { open: dialog.open };

    await (component as any).clearLog();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(activityLog.clear).toHaveBeenCalledTimes(1);
    expect((component as any).pageIndex()).toBe(0);
  });

  it('should not clear log when confirmation is cancelled', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });
    (component as any).dialog = { open: dialog.open };

    await (component as any).clearLog();

    expect(activityLog.clear).not.toHaveBeenCalled();
  });

  it('should export csv when rows exist', () => {
    const urlRef = URL as unknown as { createObjectURL?: (blob: Blob) => string; revokeObjectURL?: (url: string) => void };
    const originalCreate = urlRef.createObjectURL;
    const originalRevoke = urlRef.revokeObjectURL;
    const createObjectURL = vi.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = vi.fn();
    urlRef.createObjectURL = createObjectURL;
    urlRef.revokeObjectURL = revokeObjectURL;

    const anchor = document.createElement('a');
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const removeSpy = vi.spyOn(anchor, 'remove').mockImplementation(() => {});
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return anchor;
      }
      return HTMLElement.prototype.ownerDocument!.createElement(tagName);
    });

    (component as any).exportCsv();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
    clickSpy.mockRestore();
    removeSpy.mockRestore();
    urlRef.createObjectURL = originalCreate;
    urlRef.revokeObjectURL = originalRevoke;
  });
});
