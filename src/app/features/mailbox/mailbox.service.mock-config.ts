import { Injectable } from '@angular/core';
import { ConfigurationService } from '../../core/services/configuration.service';

@Injectable()
export class MockConfigurationService extends ConfigurationService {
  // No override needed, just inherit the value/type from base class
  // This mock exists only for test DI compatibility
  constructor() {
    super();
    // No additional logic, but constructor required for inject() compatibility
  }
}
