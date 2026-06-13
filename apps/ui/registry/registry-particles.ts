import type { Registry } from "shadcn/schema";

import type { RegistryCategory } from "./registry-categories";

type ParticleItem = Omit<Registry["items"][number], "categories"> & {
  categories?: RegistryCategory[];
};

// Origin-UI particle gallery removed; the showcase now centers on ChatInput
// (rendered directly at /chat-input). Re-add entries here only if the
// registry-driven gallery is brought back.
export const particles: ParticleItem[] = [];
