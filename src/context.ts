import type { Logger } from './logger.js';
import type { TicketService } from './tickets/service.js';
import type { TicketStore } from './tickets/store.js';

export interface AppContext {
  readonly store: TicketStore;
  readonly tickets: TicketService;
  readonly logger: Logger;
}
