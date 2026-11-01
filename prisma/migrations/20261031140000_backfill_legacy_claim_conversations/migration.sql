-- Give existing found-item claims a private conversation without dropping history.
INSERT INTO "ChatConversation" ("id", "createdAt", "updatedAt")
SELECT 'legacy_claim_' || md5("id"), "createdAt", "createdAt"
FROM "Claim"
WHERE "foundItemId" IS NOT NULL AND "conversationId" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "Claim"
SET "conversationId" = 'legacy_claim_' || md5("id")
WHERE "foundItemId" IS NOT NULL AND "conversationId" IS NULL;

INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt")
SELECT 'legacy_participant_' || md5(c."id" || ':claimant'), c."conversationId", c."userId", c."createdAt"
FROM "Claim" c
WHERE c."conversationId" LIKE 'legacy_claim_%'
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt")
SELECT 'legacy_participant_' || md5(c."id" || ':finder'), c."conversationId", f."userId", c."createdAt"
FROM "Claim" c
JOIN "FoundItem" f ON f."id" = c."foundItemId"
WHERE c."conversationId" LIKE 'legacy_claim_%'
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "Message" ("id", "conversationId", "senderId", "content", "type", "createdAt")
SELECT 'legacy_claim_message_' || md5(c."id"), c."conversationId", c."userId",
       COALESCE(NULLIF(c."message", ''), 'The original claim request did not include a message.'),
       'TEXT', c."createdAt"
FROM "Claim" c
WHERE c."conversationId" LIKE 'legacy_claim_%'
ON CONFLICT ("id") DO NOTHING;
