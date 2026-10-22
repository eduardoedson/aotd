import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no IntersectionObserver; tests trigger loading through the fallback button.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// Pages change document.title; every test starts from the same known title.
const INITIAL_TITLE = document.title;

beforeEach(() => {
  document.title = INITIAL_TITLE;
});

afterEach(() => {
  cleanup();
  document.title = INITIAL_TITLE;
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});
