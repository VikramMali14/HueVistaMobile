import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api';

/**
 * Project query hooks. Keys are namespaced under 'projects' (NOT 'shades'), so
 * the offline persister never writes user projects to disk.
 */

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() });
}

export function useProject(id?: string) {
  return useQuery({
    queryKey: ['projects', id ?? null],
    queryFn: () => projectsApi.get(id as string),
    enabled: !!id,
    // While SAM 2 runs, poll for the segmentation result.
    refetchInterval: (query) => (query.state.data?.status === 'SEGMENTING' ? 2000 : false),
  });
}
