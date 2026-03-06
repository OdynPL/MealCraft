

import { TestBed } from '@angular/core/testing';
import { PaginationService } from './pagination.service';
import { ConfigurationService } from './configuration.service';


const mockConfig = {
  uiSmallViewportMaxWidth: 600,
  uiMediumViewportMaxWidth: 1200,
  uiSmallViewportPageSize: 5,
  uiMediumViewportPageSize: 10,
  uiLargeViewportPageSize: 20,
  minPageSize: 2,
  maxPageSize: 50,
  uiPageSizeOptions: [5, 10, 20, 50],
  defaultPageSize: 10,
};

class MockConfigService {
  uiSmallViewportMaxWidth = mockConfig.uiSmallViewportMaxWidth;
  uiMediumViewportMaxWidth = mockConfig.uiMediumViewportMaxWidth;
  uiSmallViewportPageSize = mockConfig.uiSmallViewportPageSize;
  uiMediumViewportPageSize = mockConfig.uiMediumViewportPageSize;
  uiLargeViewportPageSize = mockConfig.uiLargeViewportPageSize;
  minPageSize = mockConfig.minPageSize;
  maxPageSize = mockConfig.maxPageSize;
  uiPageSizeOptions = mockConfig.uiPageSizeOptions;
  defaultPageSize = mockConfig.defaultPageSize;
}


// No need for a mock class, just use the plain object



describe('PaginationService', () => {
  let service: PaginationService;
  let config: typeof mockConfig;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PaginationService,
        { provide: ConfigurationService, useClass: MockConfigService }
      ]
    });
    service = TestBed.inject(PaginationService);
    config = mockConfig;
  });

  it('should return small page size for small width', () => {
    expect(service.recommendedPageSizeForWidth(400)).toBe(config.uiSmallViewportPageSize);
  });

  it('should return medium page size for medium width', () => {
    expect(service.recommendedPageSizeForWidth(800)).toBe(config.uiMediumViewportPageSize);
  });

  it('should return large page size for large width', () => {
    expect(service.recommendedPageSizeForWidth(1300)).toBe(config.uiLargeViewportPageSize);
  });

  it('should clamp page size to min', () => {
    expect(service.clampPageSize(1)).toBe(config.minPageSize);
  });

  it('should clamp page size to max', () => {
    expect(service.clampPageSize(100)).toBe(config.maxPageSize);
  });

  it('should return the same page size if within range', () => {
    expect(service.clampPageSize(10)).toBe(10);
  });

  it('should return page size options', () => {
    expect(service.getPageSizeOptions()).toEqual(config.uiPageSizeOptions);
  });

  it('should return default page size', () => {
    expect(service.getDefaultPageSize()).toBe(config.defaultPageSize);
  });

  it('should return max page size', () => {
    expect(service.getMaxPageSize()).toBe(config.maxPageSize);
  });

  it('should return min page size', () => {
    expect(service.getMinPageSize()).toBe(config.minPageSize);
  });
});
