import { useRef } from 'react';

/**
 * Hook to detect if this is the first mount of the component
 * Useful for animations that should only run on initial mount, not on navigation
 * 
 * Returns true only on the first render, false on subsequent renders
 */
export function useIsFirstMount(): boolean {
  const isFirstMountRef = useRef(true);
  
  if (isFirstMountRef.current) {
    isFirstMountRef.current = false;
    return true;
  }
  
  return false;
}

