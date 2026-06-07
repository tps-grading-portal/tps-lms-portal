-- Migration: 20260606000003_chat_custom_channels
-- Custom public/private channels

ALTER TABLE "chat_channels"
    ADD COLUMN "isPrivate"   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "createdById" TEXT;
