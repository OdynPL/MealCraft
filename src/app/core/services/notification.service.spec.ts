import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { NotificationService } from './notification.service';
import { vi } from 'vitest';

describe('NotificationService', () => {
  let service: NotificationService;
  let documentMock: Document;
  let body: HTMLElement;

  beforeEach(() => {
    body = document.createElement('body');
    documentMock = {
      ...document,
      body,
      createElement: ((tag: string) => document.createElement(tag)),
      querySelector: (() => null),
    } as unknown as Document;

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: DOCUMENT, useValue: documentMock },
      ],
    });
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show a success toast', () => {
    const open = service['open'] = vi.fn();
    service.success('Success!');
    expect(open).toHaveBeenCalledWith('Success!', 'snackbar-success');
  });

  it('should show an info toast', () => {
    const open = service['open'] = vi.fn();
    service.info('Info!');
    expect(open).toHaveBeenCalledWith('Info!', 'snackbar-info');
  });

  it('should show an error toast', () => {
    const open = service['open'] = vi.fn();
    service.error('Error!');
    expect(open).toHaveBeenCalledWith('Error!', 'snackbar-error');
  });

  it('should create and show a toast in the DOM', () => {
    documentMock.querySelector = () => null;
    const appendSpy = vi.spyOn(body, 'appendChild');
    service['open']('Test message', 'snackbar-info');
    const container = body.querySelector('.app-toast-container');
    expect(container).toBeTruthy();
    expect(appendSpy).toHaveBeenCalled();
    const toast = container!.querySelector('.app-toast');
    expect(toast).toBeTruthy();
    expect(toast!.textContent).toBe('Test message');
    expect(toast!.className).toContain('snackbar-info');
    expect(toast!.getAttribute('role')).toBe('status');
    expect(toast!.getAttribute('aria-live')).toBe('polite');
    expect(toast!.getAttribute('aria-atomic')).toBe('true');
  });

  it('should reuse the toast container if it exists', () => {
    const container = document.createElement('div');
    container.className = 'app-toast-container';
    documentMock.querySelector = () => container;
    body.appendChild(container);
    service['toastContainer'] = null;
    const result = service['getContainer']();
    expect(result).toBe(container);
    expect(service['toastContainer']).toBe(container);
  });
});
