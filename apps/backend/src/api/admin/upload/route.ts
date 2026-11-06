import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * S3 signed upload pipeline (build plan Section 12.6).
 *
 * Original uploads go to S3; responsive AVIF/WebP renditions are generated
 * separately (worker). Private commission/seller-application files use
 * private object ACLs and short-lived signed URLs.
 *
 * Requires: AWS_REGION, AWS_S3_BUCKET, AWS_S3_ACCESS_KEY_ID,
 * AWS_S3_SECRET_ACCESS_KEY, and (optionally) MEDIA_DOMAIN for CloudFront.
 */

const BUCKET = process.env.AWS_S3_BUCKET || "";
const REGION = process.env.AWS_REGION || "ap-south-1";
const MEDIA_DOMAIN = process.env.MEDIA_DOMAIN || "";

const s3 = new S3Client({
  region: REGION,
  credentials:
    process.env.AWS_S3_ACCESS_KEY_ID && process.env.AWS_S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
        }
      : undefined,
});

// Allowed upload kinds and their constraints.
const UPLOAD_POLICY: Record<
  string,
  { maxBytes: number; contentTypes: string[]; prefix: string; public: boolean }
> = {
  product: {
    maxBytes: 10 * 1024 * 1024,
    contentTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    prefix: "public/products/",
    public: true,
  },
  artist: {
    maxBytes: 5 * 1024 * 1024,
    contentTypes: ["image/jpeg", "image/png", "image/webp"],
    prefix: "public/artists/",
    public: true,
  },
  commission: {
    maxBytes: 8 * 1024 * 1024,
    contentTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    prefix: "private/commissions/",
    public: false,
  },
  partner: {
    maxBytes: 8 * 1024 * 1024,
    contentTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    prefix: "private/partners/",
    public: false,
  },
};

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!BUCKET) {
    return res.status(501).json({
      error:
        "Media uploads not configured. Set AWS_S3_BUCKET and credentials.",
    });
  }

  const body = (req.body as unknown) as {
    kind?: string;
    filename?: string;
    content_type?: string;
  };
  const { kind, filename, content_type } = body;
  const policy = UPLOAD_POLICY[kind ?? ""];
  if (!policy) {
    return res.status(400).json({ error: `Unsupported upload kind "${kind}".` });
  }
  if (!policy.contentTypes.includes(content_type ?? "")) {
    return res.status(400).json({
      error: `Content type "${content_type}" not allowed for "${kind}".`,
    });
  }

  // Randomized storage key — no user-controlled path traversal.
  const key = `${policy.prefix}${crypto.randomUUID()}-${
    (filename ?? "upload").replace(/[^a-zA-Z0-9._-]/g, "_")
  }`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: content_type,
      ...(policy.public ? {} : { ACL: "private" }),
    });
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300, // 5 minutes
    });

    // Public read URL (CloudFront or S3) for public uploads.
    let publicUrl: string | null = null;
    if (policy.public) {
      publicUrl = MEDIA_DOMAIN
        ? `https://${MEDIA_DOMAIN}/${key}`
        : `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
    }

    return res.status(200).json({
      uploadUrl,
      key,
      publicUrl,
      expiresIn: 300,
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create upload URL.",
    });
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return res.status(400).json({ error: "Missing key." });
  }

  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    return res.status(200).json({ url: signedUrl, expiresIn: 300 });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to sign download URL.",
    });
  }
}
