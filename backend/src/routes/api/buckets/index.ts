import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  ListBucketsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION,
  endpoint: process.env.AWS_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const command = new ListBucketsCommand({});

    try {
      const { Owner, Buckets } = await client.send(command);
      reply.send({
        owner: Owner,
        buckets: Buckets,
      });
    } catch (error) {
      console.error('Error listing buckets', error);
      reply.code(500).send({ error: error.message });
    }
  });

  fastify.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const { bucketName } = req.body as any;
    const createBucketCommand = new CreateBucketCommand({
      Bucket: bucketName,
    });

    try {
      const data = await client.send(createBucketCommand);
      reply.send({ message: 'Bucket created successfully', data });
    } catch (error) {
      console.error('Error creating bucket', error);
      reply.code(500).send({ message: error });
    }
  });

  fastify.delete('/:bucketName', async (req: FastifyRequest, reply: FastifyReply) => {
    const { bucketName } = req.params as any;

    const deleteBucketCommand = new DeleteBucketCommand({
      Bucket: bucketName,
    });

    try {
      await client.send(deleteBucketCommand);
      reply.send({ message: 'Bucket deleted successfully' });
    } catch (error) {
      console.error('Error deleting bucket', error);
      reply.code(500).send({ error: error.message });
    }
  });
};
