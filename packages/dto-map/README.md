# DTO mapping helpers (`@poc-plattform-kit/dto-map`)

Small, boring helpers for Nest **response** DTOs. Prefer this over a full mapper
library until mapping complexity clearly outgrows hand maps.

## Convention

| Layer | Owns |
| --- | --- |
| Service | Domain / Prisma-shaped records (`Date`, stored enums) |
| `*.mapper.ts` (colocated with controller or feature) | Wire DTOs for HTTP / OpenAPI |
| Controller | Call the mapper; no `toISOString` / field reshaping inline |

Example file next to a controller:

```text
pillars/permissions/src/access-request.controller.ts
pillars/permissions/src/access-request.mapper.ts
```

```ts
import { toIsoString, toIsoStringRequired } from '@poc-plattform-kit/dto-map';

export function toAccessRequestResponseDto(row: AccessRequestRecord): AccessRequestResponseDto {
  return {
    // …
    decidedAt: toIsoString(row.decidedAt),
    createdAt: toIsoStringRequired(row.createdAt),
  };
}
```

Swagger: nullable strings need `@ApiProperty({ type: String, nullable: true })` so
Orval emits `string | null`, not `{ [key: string]: unknown } | null`.

## When to introduce a mapper library

Keep hand mappers + this package while transforms stay shallow (dates, nulls,
light renames). **Plan a library** (AutoMapper / nestjs-automapper / similar)
when several of these show up:

- Nested entity graphs mapped to multiple response shapes
- Frequent field renames across API versions
- The same entity needs 3+ response DTOs with overlapping rules
- Pillar `*.mapper.ts` files grow large or copy-paste transform blocks

Track adoption as a follow-up ClickUp task (do not bolt a library into a feature
PR). Keep the `*.mapper.ts` boundary so a future library stays an implementation
detail behind the same exports.

Filed: [86d3zn2aw — Adopt mapper library when DTO mapping complexity grows](https://app.clickup.com/t/86d3zn2aw).
