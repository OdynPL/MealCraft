import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpCacheService } from './http-cache.service';
import { HttpResponse } from '@angular/common/http';


describe('HttpCacheService', () => {
  let service: HttpCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpCacheService]
    });
    service = TestBed.inject(HttpCacheService);
    service.clearAll(); // Ensure clean state
  });

  it('should return null if no entry exists', () => {
    expect(service.get('/foo')).toBeNull();
  });

  it('should store and retrieve a response', () => {
    const resp = new HttpResponse({ body: { foo: 'bar' } });
    service.set('/foo', resp);
    const cached = service.get('/foo');
    expect(cached).toBeTruthy();
    expect(cached?.body).toEqual({ foo: 'bar' });
    expect(cached).not.toBe(resp); // Should be a clone
  });

  it('should expire entries after TTL', () => {
    const resp = new HttpResponse({ body: 123 });
    service.set('/expire', resp);
    // Simulate expiry
    const now = Date.now;
    Date.now = () => now() + 31_000;
    expect(service.get('/expire')).toBeNull();
    Date.now = now; // Restore
  });

  it('should clear entries by prefix', () => {
    const resp = new HttpResponse({ body: 1 });
    service.set('/api/foo', resp);
    service.set('/api/bar', resp);
    service.set('/other', resp);
    service.clearByPrefix('/api');
    expect(service.get('/api/foo')).toBeNull();
    expect(service.get('/api/bar')).toBeNull();
    expect(service.get('/other')).not.toBeNull();
  });

  it('should clear all entries', () => {
    const resp = new HttpResponse({ body: 1 });
    service.set('/a', resp);
    service.set('/b', resp);
    service.clearAll();
    expect(service.get('/a')).toBeNull();
    expect(service.get('/b')).toBeNull();
  });
});
