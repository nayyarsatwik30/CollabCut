import { S3Client } from '@aws-sdk/client-s3'

export const b2 = new S3Client({
  region: 'us-west-000',
  endpoint: process.env.B2_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
})

export const B2_BUCKET = process.env.B2_BUCKET_NAME!
