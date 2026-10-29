# Third-party dependencies

| Package | Use | License |
|---|---|---|
| three | 3D rendering | MIT |
| vite | dev server / bundler | MIT |
| typescript | type checking | Apache-2.0 |
| vitest | unit tests | MIT |
| eslint, @eslint/js, typescript-eslint, globals | linting (dev only) | MIT / Apache-2.0 / MIT (verify after install) |

Verify licenses with `npm ls` / each package's LICENSE after install.
## Third-party assets
| Asset | Files | Source / licence |
|---|---|---|
| Human character with jumping animation ("Unarmed Jump") | public/models/character/character.fbx, base_color.png (resized to 1024 px from the original 2048 px) | The FBX embeds creator metadata identifying Mixamo, Inc. / mixamo.com. The author confirms the FBX and texture were downloaded together from Mixamo. Adobe's [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) says Mixamo characters and animations may be used royalty-free in video games. The exact character/download record is not recorded here. This is not described as an open-source asset. The metallic texture from the original pack is not used. |

Everything else (geometry, sounds) is procedural.
