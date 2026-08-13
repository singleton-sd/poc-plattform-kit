import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiDocumentConfig } from './swagger.config';

describe('tenant group OpenAPI contract', () => {
  it('models required nullable scalars with their concrete types', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    const document = SwaggerModule.createDocument(app, buildOpenApiDocumentConfig());

    const schemas = document.components?.schemas as Record<
      string,
      { required?: string[]; properties?: Record<string, Record<string, unknown>> }
    >;

    expect(schemas.TenantGroupResponseDto.properties?.description).toMatchObject({
      type: 'string',
      nullable: true,
    });
    expect(schemas.TenantGroupResponseDto.required).toContain('description');
    expect(schemas.TenantGroupMembershipResponseDto.properties?.syncError).toMatchObject({
      type: 'string',
      nullable: true,
    });
    expect(schemas.TenantGroupMembershipResponseDto.properties?.syncedAt).toMatchObject({
      type: 'string',
      format: 'date-time',
      nullable: true,
    });
    expect(schemas.TenantGroupMembershipResponseDto.required).toEqual(
      expect.arrayContaining(['syncError', 'syncedAt']),
    );

    await app.close();
  });
});
