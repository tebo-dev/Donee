import { useOutletContext } from 'react-router-dom';

export function useWorkspaceShell() {
  return useOutletContext<{
    createWorkspace: (trigger?: HTMLElement) => void;
  }>();
}
