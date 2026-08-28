'use client';

import { useEffect } from 'react';

/**
 * GlobalErrorHandler intercepts benign browser runtime notifications such as:
 * - "ResizeObserver loop completed with undelivered notifications." (benign W3C layout loop warning)
 * - "ResizeObserver loop limit exceeded"
 * - Raw unhandled DOM Event bubbling that serializes as {"isTrusted": true}
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const errorHandler = (event: ErrorEvent) => {
      if (
        event.message &&
        (event.message.includes('ResizeObserver loop') ||
          event.message.includes('undelivered notifications') ||
          event.message.includes('Script error.'))
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return true;
      }
    };

    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (
        reason &&
        typeof reason === 'string' &&
        (reason.includes('ResizeObserver') || reason.includes('undelivered notifications'))
      ) {
        event.preventDefault();
        return;
      }

      // If rejection is an Event object (which serializes to {"isTrusted": true})
      if (reason instanceof Event) {
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('error', errorHandler, true);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler, true);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
  }, []);

  return null;
}
