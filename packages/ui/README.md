# Swiss UI

Shared shadcn/ui primitives for the React PWA and WXT extension. Screens, layout, state, and platform behavior belong to the hosts; business logic belongs to `@swiss/core`.

```tsx
import { Button } from '@swiss/ui/components/button';
import { Input } from '@swiss/ui/components/input';
```

Import `@swiss/ui/styles.css` from a host's stylesheet, declare that host's Tailwind `@source`, and use the Tailwind Vite plugin. The shared stylesheet scans primitive source and supplies the dark theme tokens. Hosts compose the same primitives and theme; host CSS handles page layout and crop geometry.

Component source comes from the shadcn/ui New York registry and is distributed under the [MIT license](LICENSE.md). Imports route `cn` through `#lib/utils` and sibling primitives through `#components/*`. Sidebar uses in-memory collapse/drawer state and returns mobile focus to its trigger, without upstream cookie persistence. Field uses native labelled controls; Progress forwards its value to Radix for accessible progress updates. Input Group uses presentational wrappers; hosts compose the trailing password reveal button and own visibility state. The pinned shadcn CLI can add components through either host's `components.json`; see [web conventions](../../docs/web.md#ui-components).
