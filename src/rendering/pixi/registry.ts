import { Option } from 'effect'

import type { PreviewHandle } from './pixiHost'

// Live preview handles keyed by host id, mirroring the map example's host
// registry. The Model never holds a handle; Commands reach the live viewport
// through this registry while the Mount owns its lifecycle.

const handles = new Map<string, PreviewHandle>()

export const setPreviewHandle = (
  hostId: string,
  handle: PreviewHandle,
): void => {
  handles.set(hostId, handle)
}

export const getPreviewHandle = (
  hostId: string,
): Option.Option<PreviewHandle> => Option.fromNullishOr(handles.get(hostId))

export const removePreviewHandle = (
  hostId: string,
  handle: PreviewHandle,
): void => {
  if (handles.get(hostId) === handle) {
    handles.delete(hostId)
  }
}
