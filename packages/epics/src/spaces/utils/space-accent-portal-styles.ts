import type * as React from 'react';
import {
  DEFAULT_SPACE_SCOPE_STYLE,
  getDefaultSpaceScopeStyle,
} from './space-accent-scope-style';

export type SpaceAccentPortalStyles = React.CSSProperties;

/** Delegates to scope defaults so portal bridge stays in sync with page accent wrapper */
export function getDefaultSpacePortalStyles(): SpaceAccentPortalStyles {
  return getDefaultSpaceScopeStyle();
}

export const defaultSpacePortalStyles: SpaceAccentPortalStyles =
  DEFAULT_SPACE_SCOPE_STYLE;
