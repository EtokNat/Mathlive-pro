import { describe, it, expect, vi } from 'vitest';
import { createLogger } from './logger';

describe('Logger', () => {
  it('should format log correctly', () => {
    const logger = createLogger('TEST');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('hello', { key: 'value' });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[TEST]')
    );
    spy.mockRestore();
  });
});
