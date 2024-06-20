import { S3Client } from '@aws-sdk/client-s3';
import { NodeJsClient } from '@smithy/types';

// Initial configuration
let accessKeyId = process.env.AWS_ACCESS_KEY_ID;
let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
let region = process.env.AWS_DEFAULT_REGION;
let endpoint = process.env.AWS_S3_ENDPOINT;

let s3Client = initializeS3Client();

function initializeS3Client() {
  return new S3Client({
    region: region,
    endpoint: endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  }) as NodeJsClient<S3Client>;
}

function updateConfig(newConfig: {
  accessKeyId: any;
  secretAccessKey: any;
  region: string;
  endpoint: string;
}) {
  if (newConfig.accessKeyId !== undefined) {
    accessKeyId = newConfig.accessKeyId;
  }
  if (newConfig.secretAccessKey !== undefined) {
    secretAccessKey = newConfig.accessKeyId;
  }
  if (newConfig.region !== undefined) {
    region = newConfig.region;
  }
  if (newConfig.endpoint !== undefined) {
    endpoint = newConfig.endpoint;
  }
  if (
    newConfig.accessKeyId ||
    newConfig.secretAccessKey ||
    newConfig.region ||
    newConfig.endpoint
  ) {
    // Reinitialize the S3 client
    s3Client = initializeS3Client();
  }
}

function getConfig() {
  return {
    accessKeyId,
    secretAccessKey,
    region,
    endpoint,
    s3Client,
  };
}

module.exports = {
  getConfig,
  updateConfig,
};
