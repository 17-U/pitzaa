import { BullModule } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { CatalogModule } from '../src/catalog/catalog.module';
import { DisputesModule } from '../src/disputes/disputes.module';
import { DisputesMaintenanceProcessor } from '../src/disputes/maintenance/disputes-maintenance.processor';
import { GiftCardsModule } from '../src/gift-cards/gift-cards.module';
import { GroupsModule } from '../src/groups/groups.module';
import { MembershipPaymentsModule } from '../src/membership-payments/membership-payments.module';
import { MessagingModule } from '../src/messaging/messaging.module';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReviewsModule } from '../src/reviews/reviews.module';
import { SMS_PROVIDER, SmsProvider } from '../src/sms/sms-provider.interface';
import { VaultModule } from '../src/vault/vault.module';

class CapturingSmsProvider implements SmsProvider {
  messages: { to: string; message: string }[] = [];

  async send(to: string, message: string): Promise<void> {
    this.messages.push({ to, message });
  }
}

function extractOtpCode(message: string): string {
  const match = /(\d{6})/.exec(message);
  if (!match) {
    throw new Error(`No OTP code found in message: ${message}`);
  }
  return match[1];
}

describe('Disputes, messaging, notifications & reviews (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let disputesMaintenanceProcessor: DisputesMaintenanceProcessor;
  let sms: CapturingSmsProvider;
  let serviceId: string;
  let brandId: string;

  const PHONE_PREFIX = '+237699300';

  beforeAll(async () => {
    sms = new CapturingSmsProvider();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../../.env', '.env'],
        }),
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: { url: config.getOrThrow<string>('REDIS_URL') },
            prefix: 'pitzaa-test',
          }),
        }),
        PrismaModule,
        AuthModule,
        CatalogModule,
        GroupsModule,
        MembershipPaymentsModule,
        VaultModule,
        GiftCardsModule,
        MessagingModule,
        NotificationsModule,
        DisputesModule,
        ReviewsModule,
      ],
    })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    disputesMaintenanceProcessor = app.get(DisputesMaintenanceProcessor);

    const service = await prisma.service.create({
      data: {
        name: `Streamix disputes e2e ${Date.now()}`,
        category: 'Streaming',
        maxSlots: 4,
        recommendedPricePerSlotXaf: 1000,
        allowsSharing: true,
      },
    });
    serviceId = service.id;

    const brand = await prisma.giftCardBrand.create({
      data: {
        name: `Amazon disputes e2e ${Date.now()}`,
        country: 'US',
        resaleAllowed: true,
      },
    });
    brandId = brand.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { phone: { startsWith: PHONE_PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.ledgerEntry.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.review.deleteMany({
        where: {
          OR: [{ authorId: { in: userIds } }, { targetId: { in: userIds } }],
        },
      });
      await prisma.dispute.deleteMany({
        where: { raisedById: { in: userIds } },
      });
      await prisma.giftCardCodeAccessLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.giftCardOrder.deleteMany({
        where: {
          OR: [
            { listing: { sellerId: { in: userIds } } },
            { buyerId: { in: userIds } },
          ],
        },
      });
      await prisma.giftCardListing.deleteMany({
        where: { sellerId: { in: userIds } },
      });
      await prisma.membershipPayment.deleteMany({
        where: { membership: { userId: { in: userIds } } },
      });
      await prisma.groupMembership.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.credentialVault.deleteMany({
        where: { group: { ownerId: { in: userIds } } },
      });
      await prisma.subscriptionGroup.deleteMany({
        where: { ownerId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.service.deleteMany({ where: { id: serviceId } });
    await prisma.giftCardBrand.deleteMany({ where: { id: brandId } });
    await prisma.otpCode.deleteMany({
      where: { phone: { startsWith: PHONE_PREFIX } },
    });
    await app.close();
  });

  async function requestAndExtractOtp(
    path: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    await request(app.getHttpServer())
      .post(path)
      .send(body)
      .expect((res) => {
        if (res.status >= 400) {
          throw new Error(
            `Unexpected status ${res.status}: ${JSON.stringify(res.body)}`,
          );
        }
      });
    const lastMessage = sms.messages.at(-1);
    if (!lastMessage) {
      throw new Error('No OTP message captured');
    }
    return extractOtpCode(lastMessage.message);
  }

  async function registerUser(
    phone: string,
  ): Promise<{ userId: string; accessToken: string }> {
    const code = await requestAndExtractOtp(
      '/auth/register-or-login/request-otp',
      { phone },
    );
    const res = await request(app.getHttpServer())
      .post('/auth/register-or-login/verify-otp')
      .send({ phone, code })
      .expect(201);
    return { userId: res.body.user.id, accessToken: res.body.accessToken };
  }

  async function setPin(accessToken: string, pin = '1234'): Promise<void> {
    await request(app.getHttpServer())
      .post('/auth/me/pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ pin })
      .expect(204);
  }

  async function promoteToAdmin(userId: string): Promise<void> {
    // SUPER_ADMIN plutôt que SUPPORT : certains tests vérifient aussi une annonce
    // de carte cadeau, réservé à SUPER_ADMIN/MODERATOR (pas SUPPORT).
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'SUPER_ADMIN' },
    });
  }

  /** Raccourci de test uniquement : aucun code applicatif ne modifie un solde hors du grand livre. */
  async function fundWallet(userId: string, amountXaf: number): Promise<void> {
    await prisma.wallet.update({
      where: { userId },
      data: { availableBalanceXaf: amountXaf },
    });
  }

  async function createPaidMembership(
    ownerPhone: string,
    memberPhone: string,
    pricePerSlotXaf = 1000,
  ): Promise<{
    owner: { userId: string; accessToken: string };
    member: { userId: string; accessToken: string };
    membershipPaymentId: string;
    amountXaf: number;
  }> {
    const owner = await registerUser(ownerPhone);
    const member = await registerUser(memberPhone);
    await setPin(member.accessToken);
    await fundWallet(member.userId, 100_000);

    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        serviceId,
        pricePerSlotXaf,
        totalSlots: 2,
        autoAcceptJoinRequests: true,
      })
      .expect(201);

    const joinRes = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/join`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(201);

    const payRes = await request(app.getHttpServer())
      .post(`/memberships/${joinRes.body.id}/payments`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ pin: '1234', method: 'WALLET', monthsCount: 1 })
      .expect(201);

    return {
      owner,
      member,
      membershipPaymentId: payRes.body.id,
      amountXaf: payRes.body.amountXaf,
    };
  }

  it('creates a conversation and notifies the owner when a membership dispute is opened', async () => {
    const ownerPhone = `${PHONE_PREFIX}001`;
    const { owner, member, membershipPaymentId } = await createPaidMembership(
      ownerPhone,
      `${PHONE_PREFIX}002`,
    );

    await request(app.getHttpServer())
      .post(`/memberships/payments/${membershipPaymentId}/no-access`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ reason: "Je n'ai pas reçu les identifiants du groupe." })
      .expect(201);

    const dispute = await prisma.dispute.findFirstOrThrow({
      where: { membershipPaymentId },
    });
    expect(dispute.status).toBe('OPEN');
    expect(dispute.raisedById).toBe(member.userId);
    expect(dispute.againstId).toBe(owner.userId);

    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { disputeId: dispute.id },
    });
    expect(conversation.type).toBe('DISPUTE');

    const ownerNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: owner.userId, type: 'DISPUTE_OPENED' },
    });
    expect(ownerNotification.channel).toBe('IN_APP');
    // DISPUTE_OPENED fait partie des types jugés assez critiques pour justifier un SMS.
    expect(
      sms.messages.some(
        (m) => m.to === ownerPhone && m.message.includes('litige'),
      ),
    ).toBe(true);

    // Les deux parties voient le litige depuis /disputes/mine.
    const ownerMine = await request(app.getHttpServer())
      .get('/disputes/mine')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(
      ownerMine.body.some((d: { id: string }) => d.id === dispute.id),
    ).toBe(true);
  });

  it('lets the counterparty respond with a redacted message, moving the dispute to arbitration', async () => {
    const { owner, member, membershipPaymentId } = await createPaidMembership(
      `${PHONE_PREFIX}003`,
      `${PHONE_PREFIX}004`,
    );

    await request(app.getHttpServer())
      .post(`/memberships/payments/${membershipPaymentId}/no-access`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ reason: "Je n'ai pas reçu les identifiants du groupe." })
      .expect(201);

    const dispute = await prisma.dispute.findFirstOrThrow({
      where: { membershipPaymentId },
    });

    // Seule la partie mise en cause (le propriétaire) peut répondre.
    await request(app.getHttpServer())
      .post(`/disputes/${dispute.id}/respond`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ message: 'Je réponds à ma propre contestation' })
      .expect(403);

    const respondRes = await request(app.getHttpServer())
      .post(`/disputes/${dispute.id}/respond`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        message:
          "Contactez-moi au 0612345678, l'invitation a bien été envoyée.",
      })
      .expect(201);
    expect(respondRes.body.status).toBe('UNDER_ARBITRATION');

    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { disputeId: dispute.id },
    });
    const messages = await request(app.getHttpServer())
      .get(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    expect(messages.body).toHaveLength(1);
    expect(messages.body[0].content).toContain('[masqué]');
    expect(messages.body[0].content).not.toContain('0612345678');
    expect(messages.body[0].flagged).toBe(true);

    const raiserNotifications = await prisma.notification.findMany({
      where: { userId: member.userId },
    });
    expect(raiserNotifications.length).toBeGreaterThan(0);
  });

  it('auto-escalates to arbitration once the response window has elapsed', async () => {
    const { member, membershipPaymentId } = await createPaidMembership(
      `${PHONE_PREFIX}005`,
      `${PHONE_PREFIX}006`,
    );

    await request(app.getHttpServer())
      .post(`/memberships/payments/${membershipPaymentId}/no-access`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ reason: 'Toujours aucun accès.' })
      .expect(201);

    const dispute = await prisma.dispute.findFirstOrThrow({
      where: { membershipPaymentId },
    });

    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { responseDeadlineAt: new Date(Date.now() - 1000) },
    });
    await disputesMaintenanceProcessor.process({
      name: 'escalate-overdue-disputes',
    } as never);

    const escalated = await prisma.dispute.findUniqueOrThrow({
      where: { id: dispute.id },
    });
    expect(escalated.status).toBe('UNDER_ARBITRATION');
    expect(escalated.arbitrationDeadlineAt).not.toBeNull();
  });

  it('lets the raiser cancel before any response, reverting the payment to PAID', async () => {
    const { member, membershipPaymentId } = await createPaidMembership(
      `${PHONE_PREFIX}007`,
      `${PHONE_PREFIX}008`,
    );

    await request(app.getHttpServer())
      .post(`/memberships/payments/${membershipPaymentId}/no-access`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ reason: 'Je retire ma contestation.' })
      .expect(201);

    const dispute = await prisma.dispute.findFirstOrThrow({
      where: { membershipPaymentId },
    });

    const cancelRes = await request(app.getHttpServer())
      .post(`/disputes/${dispute.id}/cancel`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(201);
    expect(cancelRes.body.status).toBe('CANCELLED');

    const paymentAfterCancel = await prisma.membershipPayment.findUniqueOrThrow(
      {
        where: { id: membershipPaymentId },
      },
    );
    expect(paymentAfterCancel.status).toBe('PAID');
  });

  it('resolves in favor of the initiator: full refund and a trust penalty for the owner', async () => {
    const { owner, member, membershipPaymentId, amountXaf } =
      await createPaidMembership(`${PHONE_PREFIX}009`, `${PHONE_PREFIX}010`);
    const admin = await registerUser(`${PHONE_PREFIX}011`);
    await promoteToAdmin(admin.userId);

    const ownerBefore = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
    });

    await request(app.getHttpServer())
      .post(`/memberships/payments/${membershipPaymentId}/no-access`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ reason: "Je n'ai pas reçu les identifiants du groupe." })
      .expect(201);
    const dispute = await prisma.dispute.findFirstOrThrow({
      where: { membershipPaymentId },
    });

    // Un utilisateur non-admin ne peut pas trancher.
    await request(app.getHttpServer())
      .post(`/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ outcome: 'INITIATOR', notes: 'Je me donne raison' })
      .expect(403);

    const resolveRes = await request(app.getHttpServer())
      .post(`/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        outcome: 'INITIATOR',
        notes: 'Aucune preuve de livraison des accès.',
      })
      .expect(201);
    expect(resolveRes.body.status).toBe('RESOLVED_FOR_INITIATOR');

    const memberWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: member.userId },
    });
    expect(memberWallet.availableBalanceXaf).toBe(100_000);
    expect(amountXaf).toBeGreaterThan(0);

    const ownerWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(ownerWallet.escrowBalanceXaf).toBe(0);
    expect(ownerWallet.availableBalanceXaf).toBe(0);

    const paymentAfterResolve =
      await prisma.membershipPayment.findUniqueOrThrow({
        where: { id: membershipPaymentId },
      });
    expect(paymentAfterResolve.status).toBe('REFUNDED');

    const ownerAfter = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
    });
    expect(ownerAfter.trustScore).toBe(ownerBefore.trustScore - 15);

    const bothNotified = await prisma.notification.findMany({
      where: {
        type: 'DISPUTE_RESOLVED',
        userId: { in: [owner.userId, member.userId] },
      },
    });
    expect(bothNotified).toHaveLength(2);
  });

  it('resolves in favor of the counterparty: normal escrow release and a trust penalty for the payer', async () => {
    const { owner, member, membershipPaymentId, amountXaf } =
      await createPaidMembership(`${PHONE_PREFIX}012`, `${PHONE_PREFIX}013`);
    const admin = await registerUser(`${PHONE_PREFIX}014`);
    await promoteToAdmin(admin.userId);

    const memberBefore = await prisma.user.findUniqueOrThrow({
      where: { id: member.userId },
    });

    await request(app.getHttpServer())
      .post(`/memberships/payments/${membershipPaymentId}/no-access`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ reason: 'Je pense ne pas avoir accès.' })
      .expect(201);
    const dispute = await prisma.dispute.findFirstOrThrow({
      where: { membershipPaymentId },
    });

    await request(app.getHttpServer())
      .post(`/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        outcome: 'COUNTERPARTY',
        notes: 'Capture fournie par le propriétaire.',
      })
      .expect(201);

    const ownerWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(ownerWallet.escrowBalanceXaf).toBe(0);
    expect(ownerWallet.availableBalanceXaf).toBeGreaterThan(0);

    const paymentAfterResolve =
      await prisma.membershipPayment.findUniqueOrThrow({
        where: { id: membershipPaymentId },
      });
    expect(paymentAfterResolve.status).toBe('ESCROW_RELEASED');

    const ownerAfter = await prisma.user.findUniqueOrThrow({
      where: { id: owner.userId },
    });
    expect(ownerAfter.lifetimeSalesXaf).toBe(amountXaf);

    const memberAfter = await prisma.user.findUniqueOrThrow({
      where: { id: member.userId },
    });
    expect(memberAfter.trustScore).toBe(memberBefore.trustScore - 15);
  });

  it('opens and resolves a dispute on a gift card order', async () => {
    const seller = await registerUser(`${PHONE_PREFIX}015`);
    const buyer = await registerUser(`${PHONE_PREFIX}016`);
    const admin = await registerUser(`${PHONE_PREFIX}017`);
    await promoteToAdmin(admin.userId);
    await setPin(buyer.accessToken);
    await fundWallet(buyer.userId, 100_000);

    const listingRes = await request(app.getHttpServer())
      .post('/gift-cards/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({
        brandId,
        balanceXaf: 25_000,
        askingPriceXaf: 20_000,
        code: 'DISPUTE-CODE',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/gift-cards/listings/${listingRes.body.id}/verify`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(201);

    const buyRes = await request(app.getHttpServer())
      .post(`/gift-cards/listings/${listingRes.body.id}/buy`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ pin: '1234', method: 'WALLET' })
      .expect(201);
    const orderId = buyRes.body.id;

    await request(app.getHttpServer())
      .post(`/gift-cards/orders/${orderId}/reveal-code`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/gift-cards/orders/${orderId}/dispute`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ reason: 'Le code affiche déjà « utilisé » chez le fournisseur.' })
      .expect(201);

    const order = await prisma.giftCardOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.status).toBe('DISPUTED');

    const dispute = await prisma.dispute.findFirstOrThrow({
      where: { giftCardOrderId: orderId },
    });
    expect(dispute.raisedById).toBe(buyer.userId);
    expect(dispute.againstId).toBe(seller.userId);

    await request(app.getHttpServer())
      .post(`/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ outcome: 'INITIATOR', notes: 'Code effectivement déjà utilisé.' })
      .expect(201);

    const buyerWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: buyer.userId },
    });
    expect(buyerWallet.availableBalanceXaf).toBe(100_000);

    const orderAfterResolve = await prisma.giftCardOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(orderAfterResolve.status).toBe('REFUNDED');
  });

  it('lets both parties leave mutual reviews once a dispute-resolved transaction is terminal', async () => {
    const { owner, member, membershipPaymentId } = await createPaidMembership(
      `${PHONE_PREFIX}018`,
      `${PHONE_PREFIX}019`,
    );
    const admin = await registerUser(`${PHONE_PREFIX}020`);
    await promoteToAdmin(admin.userId);

    await request(app.getHttpServer())
      .post(`/memberships/payments/${membershipPaymentId}/no-access`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ reason: 'Litige pour test des avis.' })
      .expect(201);
    const dispute = await prisma.dispute.findFirstOrThrow({
      where: { membershipPaymentId },
    });
    await request(app.getHttpServer())
      .post(`/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ outcome: 'COUNTERPARTY', notes: 'Accès prouvé.' })
      .expect(201);

    const memberReviewRes = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ membershipPaymentId, rating: 4, comment: 'Finalement correct.' })
      .expect(201);
    expect(memberReviewRes.body.targetId).toBe(owner.userId);

    // On ne peut pas laisser deux avis pour la même transaction.
    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ membershipPaymentId, rating: 1 })
      .expect(400);

    const ownerReviewRes = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ membershipPaymentId, rating: 5 })
      .expect(201);
    expect(ownerReviewRes.body.targetId).toBe(member.userId);

    const ownerSummary = await request(app.getHttpServer())
      .get(`/reviews/users/${owner.userId}`)
      .expect(200);
    expect(ownerSummary.body.reviewsCount).toBe(1);
    expect(ownerSummary.body.averageRating).toBe(4);

    const memberAfterReview = await prisma.user.findUniqueOrThrow({
      where: { id: member.userId },
    });
    // -15 (litige perdu) puis +4 (avis 5 étoiles reçu) par rapport au score initial de 0.
    expect(memberAfterReview.trustScore).toBe(-15 + 4);
  });
});
