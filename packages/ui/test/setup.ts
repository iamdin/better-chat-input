import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

afterEach(async () => {
  const { cleanup } = await import("@testing-library/react/pure");
  cleanup();
});
