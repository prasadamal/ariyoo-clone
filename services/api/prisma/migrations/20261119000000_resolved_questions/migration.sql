-- Askers can mark a question answered (and say whether it helped); experts build a visible record.
ALTER TABLE "Session" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "helpful" BOOLEAN;
