// Main plugin export
export { ParquetHttpfsPlugin } from "./ParquetHttpfsPlugin.js";

// Type definitions
export * from "./types/interfaces.js";

// Managers
export { AuthenticationManager } from "./managers/AuthenticationManager.js";
export { DuckDBManager } from "./managers/DuckDBManager.js";
export { SchemaManager } from "./managers/SchemaManager.js";

// Providers
export { BaseProvider } from "./providers/BaseProvider.js";
export { AWSProvider } from "./providers/AWSProvider.js";
export { CloudflareProvider } from "./providers/CloudflareProvider.js";

// Default export for easy importing
import { ParquetHttpfsPlugin } from "./ParquetHttpfsPlugin.js";
export default ParquetHttpfsPlugin;