-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN     "isWinner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "winCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OutreachEvent" ADD COLUMN     "followUpSentAt" TIMESTAMP(3),
ADD COLUMN     "segment" TEXT NOT NULL DEFAULT 'pas',
ADD COLUMN     "sentiment" TEXT,
ADD COLUMN     "toEmails" TEXT[],
ADD COLUMN     "variantIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CompanyMemory" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" TEXT,
    "techStack" TEXT,
    "recentNews" TEXT,
    "hiringStatus" TEXT,
    "fundingStage" TEXT,
    "rawFacts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "calendarUrl" TEXT,
    "senderCompany" TEXT,
    "signatureHtml" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPassEnc" TEXT,
    "fromAlias" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelItem" (
    "id" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMemory_domain_key" ON "CompanyMemory"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "SenderProfile_userId_key" ON "SenderProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelItem_funnelId_resultId_key" ON "FunnelItem"("funnelId", "resultId");

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelItem" ADD CONSTRAINT "FunnelItem_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelItem" ADD CONSTRAINT "FunnelItem_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
