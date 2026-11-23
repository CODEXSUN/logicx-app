// Vite injects the owning root package metadata for this running build.
export const buildMetadata = Object.freeze(__LOGICX_BUILD_METADATA__)
export const buildLabel = `${buildMetadata.appName} - V${buildMetadata.version}`
