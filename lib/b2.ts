import { S3Client } from '@aws-sdk/client-s3'

// The signing region is the segment of the endpoint host, e.g. eu-central-003
// in https://s3.eu-central-003.backblazeb2.com - presigned URLs are only valid
// when signed for the bucket's real region.
const B2_REGION = process.env.B2_ENDPOINT?.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/)?.[1] ?? 'us-west-000'

export const b2 = new S3Client({
  region: B2_REGION,
  endpoint: process.env.B2_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
})

export const B2_BUCKET = process.env.B2_BUCKET_NAME!
