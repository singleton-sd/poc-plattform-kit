import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

// Sanity check per AGENTS.md: an interface-typed constructor param with no
// concrete registered provider crashes app boot with "Nest can't resolve
// dependencies...". Compiling the whole AppModule catches that class of
// wiring mistake for every module registered here, including
// TenantInvitationController/Service added by this ticket.
describe('AppModule', () => {
  it('resolves the full DI graph', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
